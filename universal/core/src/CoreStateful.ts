import type {
  InsightsEvent as AnalyticsEvent,
  ChangeArray,
  ExperienceEvent as PersonalizationEvent,
  Profile,
  SelectedPersonalizationArray,
} from '@contentful/optimization-api-client'
import { AnalyticsStateful, type AnalyticsStates } from './analytics'
import type { ConsentController } from './Consent'
import CoreBase, { type CoreConfig } from './CoreBase'
import {
  PersonalizationStateful,
  type PersonalizationProductConfig,
  type PersonalizationStates,
} from './personalization'
import type { ProductConfig } from './ProductBase'
import {
  batch,
  changes,
  consent,
  event,
  flags,
  online,
  personalizations,
  profile,
  signals,
  toObservable,
  type Observable,
  type Signals,
} from './signals'

/**
 * Interface for objects that can be registered with the preview panel system.
 * When registered, the object receives direct access to SDK signals for state manipulation.
 *
 * @public
 */
export interface PreviewPanelCompatibleObject {
  /** Signals instance that will be populated by registerPreviewPanel */
  signals: Signals | null
}

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
  /** Default active profile used for personalization and analytics. */
  profile?: Profile
  /** Initial diff of changes produced by the service. */
  changes?: ChangeArray
  /** Preselected personalization variants (e.g., winning treatments). */
  personalizations?: SelectedPersonalizationArray
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
        consent: defaults?.consent,
        profile: defaults?.profile,
      },
    })

    this.personalization = new PersonalizationStateful(this.api, this.eventBuilder, {
      allowedEventTypes,
      getAnonymousId,
      preventedComponentEvents,
      defaults: {
        consent: defaults?.consent,
        changes: defaults?.changes,
        profile: defaults?.profile,
        personalizations: defaults?.personalizations,
      },
    })
  }

  /**
   * Expose merged observable state for consumers.
   */
  get states(): CoreStates {
    return {
      consent: toObservable(consent),
      eventStream: toObservable(event),
      flags: toObservable(flags),
      personalizations: toObservable(personalizations),
      profile: toObservable(profile),
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
    batch(() => {
      event.value = undefined
      changes.value = undefined
      profile.value = undefined
      personalizations.value = undefined
    })
  }

  /**
   * Flush the queues for both the analytics and personalization products.
   * @remarks
   * The personalization queue is only populated if events have been triggered
   * while a device is offline.
   */
  async flush(): Promise<void> {
    await this.analytics.flush()
    await this.personalization.flush()
  }

  /**
   * Update consent state
   *
   * @param accept - `true` if the user has granted consent; `false` otherwise.
   */
  consent(accept: boolean): void {
    consent.value = accept
  }

  /**
   * Update online state
   *
   * @param isOnline - `true` if the browser is online; `false` otherwise.
   */
  protected online(isOnline: boolean): void {
    online.value = isOnline
  }

  /**
   * Register a preview panel compatible object to receive direct signal access.
   * This enables the preview panel to modify SDK state for testing and simulation.
   *
   * @param previewPanel - An object implementing PreviewPanelCompatibleObject
   * @remarks
   * This method is intended for use by the Preview Panel component.
   * Direct signal access allows immediate state updates without API calls.
   */
  registerPreviewPanel(previewPanel: PreviewPanelCompatibleObject): void {
    previewPanel.signals = signals
  }
}

export default CoreStateful
