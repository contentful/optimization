import type {
  InsightsEvent as AnalyticsEvent,
  ExperienceEvent as PersonalizationEvent,
} from '@contentful/optimization-api-client'
import {
  AnalyticsStateful,
  type AnalyticsProductConfigDefaults,
  type AnalyticsStates,
} from './analytics'
import type { ConsentController } from './Consent'
import CoreBase, { type CoreConfig } from './CoreBase'
import {
  PersonalizationStateful,
  type PersonalizationProductConfig,
  type PersonalizationProductConfigDefaults,
  type PersonalizationStates,
} from './personalization'
import type { ProductConfig } from './ProductBase'
import { consent, event, toObservable, type Observable } from './signals'

/**
 * Combined observable state exposed by the stateful core.
 *
 * @public
 * @see {@link AnalyticsStates}
 * @see {@link PersonalizationStates}
 */
export interface CoreStates extends AnalyticsStates, PersonalizationStates {
  /** Current consent value (if any). */
  consent: Observable<boolean | undefined>
  /** Stream of the most recent event emitted (analytics or personalization). */
  eventStream: Observable<AnalyticsEvent | PersonalizationEvent | undefined>
}

/**
 * Default values used to preconfigure the stateful core and products.
 *
 * @public
 */
export interface CoreConfigDefaults {
  /** Global consent default applied at construction time. */
  consent?: boolean
  /** Defaults forwarded to the personalization product. */
  personalization?: Omit<PersonalizationProductConfigDefaults, 'consent'>
  /** Defaults forwarded to the analytics product. */
  analytics?: Omit<AnalyticsProductConfigDefaults, 'consent'>
}

/**
 * Configuration for {@link CoreStateful}.
 *
 * @public
 * @see {@link CoreConfig}
 */
export interface CoreStatefulConfig extends CoreConfig {
  /**
   * Allow-listed event type strings permitted when consent is not set.
   *
   * @see {@link ProductConfig.allowedEventTypes}
   */
  allowedEventTypes?: ProductConfig['allowedEventTypes']

  /** Optional set of default values applied on initialization. */
  defaults?: CoreConfigDefaults

  /** Function used to obtain an anonymous user identifier. */
  getAnonymousId?: PersonalizationProductConfig['getAnonymousId']

  /**
   * Initial duplication prevention configuration for component events.
   *
   * @see {@link ProductConfig.preventedComponentEvents}
   */
  preventedComponentEvents?: ProductConfig['preventedComponentEvents']
}

/**
 * Core runtime that constructs stateful product instances and exposes shared
 * states, including consent and the event stream.
 *
 * @public
 * @remarks
 * @see {@link CoreBase}
 * @see {@link ConsentController}
 */
class CoreStateful extends CoreBase implements ConsentController {
  /** Stateful analytics product. */
  readonly analytics: AnalyticsStateful
  /** Stateful personalization product. */
  readonly personalization: PersonalizationStateful

  /**
   * Create a stateful core with optional default consent and product defaults.
   *
   * @param config - Core and defaults configuration.
   * @example
   * ```ts
   * const core = new CoreStateful({
   *   clientId: 'app',
   *   environment: 'prod',
   *   defaults: { consent: true }
   * })
   * core.consent(true)
   * ```
   */
  constructor(config: CoreStatefulConfig) {
    super(config)

    const { allowedEventTypes, defaults, getAnonymousId, preventedComponentEvents } = config

    if (defaults?.consent !== undefined) {
      const { consent: defaultConsent } = defaults
      consent.value = defaultConsent
    }

    this.analytics = new AnalyticsStateful(this.api, this.eventBuilder, {
      allowedEventTypes,
      preventedComponentEvents,
      defaults: {
        consent: defaults?.consent ?? undefined,
        ...defaults?.analytics,
      },
    })

    this.personalization = new PersonalizationStateful(this.api, this.eventBuilder, {
      allowedEventTypes,
      getAnonymousId,
      preventedComponentEvents,
      defaults: {
        consent: defaults?.consent ?? undefined,
        ...defaults?.personalization,
      },
    })
  }

  /**
   * Expose merged observable state for consumers.
   */
  get states(): CoreStates {
    return {
      ...this.analytics.states,
      ...this.personalization.states,
      consent: toObservable(consent),
      eventStream: toObservable(event),
    }
  }

  /**
   * Reset internal state. Consent is intentionally preserved.
   *
   * @remarks
   * Resetting personalization also resets analytics dependencies as a
   * consequence of the current shared-state design.
   */
  reset(): void {
    this.personalization.reset()
  }

  /**
   * Update consent state
   *
   * @param accept - `true` if the user has granted consent; `false` otherwise.
   */
  consent(accept: boolean): void {
    consent.value = accept
  }
}

export default CoreStateful
