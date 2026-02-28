import type {
  InsightsEvent as AnalyticsEvent,
  ChangeArray,
  ExperienceEvent as PersonalizationEvent,
  Profile,
  SelectedPersonalizationArray,
} from '@contentful/optimization-api-client'
import { AnalyticsStateful, type AnalyticsProductConfig, type AnalyticsStates } from './analytics'
import type { BlockedEvent } from './BlockedEvent'
import type { ConsentController } from './Consent'
import CoreBase, { type CoreConfig } from './CoreBase'
import {
  acquireStatefulRuntimeSingleton,
  releaseStatefulRuntimeSingleton,
} from './lib/singleton/StatefulRuntimeSingleton'
import {
  PersonalizationStateful,
  type PersonalizationProductConfig,
  type PersonalizationStates,
} from './personalization'
import type { ProductConfig } from './ProductBase'
import {
  batch,
  blockedEvent,
  changes,
  consent,
  event,
  flags,
  online,
  personalizations,
  previewPanelAttached,
  previewPanelOpen,
  profile,
  signalFns,
  signals,
  toObservable,
  type Observable,
  type SignalFns,
  type Signals,
} from './signals'
import { PREVIEW_PANEL_SIGNAL_FNS_SYMBOL, PREVIEW_PANEL_SIGNALS_SYMBOL } from './symbols'

/**
 * Symbol-keyed signal bridge shared between core and first-party preview tooling.
 *
 * @public
 */
export interface PreviewPanelSignalObject {
  /** Signals instance populated by {@link CoreStateful.registerPreviewPanel}. */
  [PREVIEW_PANEL_SIGNALS_SYMBOL]?: Signals | null | undefined
  /** Signal helper functions populated by {@link CoreStateful.registerPreviewPanel}. */
  [PREVIEW_PANEL_SIGNAL_FNS_SYMBOL]?: SignalFns | null | undefined
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
  /** Whether the preview panel has been attached to the host runtime. */
  previewPanelAttached: Observable<boolean>
  /** Whether the preview panel is currently open in the host runtime. */
  previewPanelOpen: Observable<boolean>
  /** Stream of the most recent blocked event payload. */
  blockedEventStream: Observable<BlockedEvent | undefined>
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
 * Stateful analytics configuration.
 *
 * @public
 */
export type CoreStatefulAnalyticsConfig = NonNullable<CoreConfig['analytics']> & {
  /**
   * Queue policy for stateful analytics event buffering and flush retries.
   *
   * @see {@link AnalyticsProductConfig.queuePolicy}
   */
  queuePolicy?: AnalyticsProductConfig['queuePolicy']
}

/**
 * Stateful personalization configuration.
 *
 * @public
 */
export type CoreStatefulPersonalizationConfig = NonNullable<CoreConfig['personalization']> & {
  /**
   * Queue policy for stateful personalization offline event buffering.
   *
   * @see {@link PersonalizationProductConfig.queuePolicy}
   */
  queuePolicy?: PersonalizationProductConfig['queuePolicy']
}

const splitScopedQueuePolicy = <
  TQueuePolicy,
  TScopedConfig extends {
    queuePolicy?: TQueuePolicy
  },
>(
  config: TScopedConfig | undefined,
): {
  apiConfig: Omit<TScopedConfig, 'queuePolicy'> | undefined
  queuePolicy: TQueuePolicy | undefined
} => {
  if (config === undefined) {
    return {
      apiConfig: undefined,
      queuePolicy: undefined,
    }
  }

  const { queuePolicy, ...apiConfig } = config
  const resolvedApiConfig = Object.keys(apiConfig).length > 0 ? apiConfig : undefined

  return {
    apiConfig: resolvedApiConfig,
    queuePolicy,
  }
}

/**
 * Configuration for {@link CoreStateful}.
 *
 * @public
 * @see {@link CoreConfig}
 */
export interface CoreStatefulConfig extends CoreConfig {
  /**
   * Configuration for the analytics (Insights) API client plus stateful queue behavior.
   */
  analytics?: CoreStatefulAnalyticsConfig

  /**
   * Configuration for the personalization (Experience) API client plus stateful queue behavior.
   */
  personalization?: CoreStatefulPersonalizationConfig

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
   * Callback invoked whenever an event call is blocked by checks.
   */
  onEventBlocked?: ProductConfig['onEventBlocked']
}

let statefulInstanceCounter = 0

/**
 * Core runtime that constructs stateful product instances and exposes shared
 * states, including consent, blocked events, and the event stream.
 *
 * @remarks
 * Extends {@link CoreBase} with stateful capabilities, including
 * consent management via {@link ConsentController}.
 * @see {@link CoreBase}
 * @see {@link ConsentController}
 * @public
 */
class CoreStateful extends CoreBase implements ConsentController {
  private readonly singletonOwner: string
  private destroyed = false

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
    const { apiConfig: analyticsApiConfig, queuePolicy: analyticsRuntimeQueuePolicy } =
      splitScopedQueuePolicy<AnalyticsProductConfig['queuePolicy'], CoreStatefulAnalyticsConfig>(
        config.analytics,
      )
    const { apiConfig: personalizationApiConfig, queuePolicy: personalizationRuntimeQueuePolicy } =
      splitScopedQueuePolicy<
        PersonalizationProductConfig['queuePolicy'],
        CoreStatefulPersonalizationConfig
      >(config.personalization)
    const baseConfig: CoreConfig = {
      ...config,
      analytics: analyticsApiConfig,
      personalization: personalizationApiConfig,
    }

    super(baseConfig)

    this.singletonOwner = `CoreStateful#${++statefulInstanceCounter}`
    acquireStatefulRuntimeSingleton(this.singletonOwner)

    try {
      const { allowedEventTypes, defaults, getAnonymousId, onEventBlocked } = config

      if (defaults?.consent !== undefined) {
        const { consent: defaultConsent } = defaults
        consent.value = defaultConsent
      }

      this.analytics = new AnalyticsStateful({
        api: this.api,
        builder: this.eventBuilder,
        config: {
          allowedEventTypes,
          queuePolicy: analyticsRuntimeQueuePolicy,
          onEventBlocked,
          defaults: {
            consent: defaults?.consent,
            profile: defaults?.profile,
          },
        },
        interceptors: this.interceptors,
      })

      this.personalization = new PersonalizationStateful({
        api: this.api,
        builder: this.eventBuilder,
        config: {
          allowedEventTypes,
          getAnonymousId,
          queuePolicy: personalizationRuntimeQueuePolicy,
          onEventBlocked,
          defaults: {
            consent: defaults?.consent,
            changes: defaults?.changes,
            profile: defaults?.profile,
            personalizations: defaults?.personalizations,
          },
        },
        interceptors: this.interceptors,
      })
    } catch (error) {
      releaseStatefulRuntimeSingleton(this.singletonOwner)
      throw error
    }
  }

  /**
   * Release singleton ownership for stateful runtime usage.
   *
   * @remarks
   * This method is idempotent and should be called when a stateful SDK instance
   * is no longer needed (e.g. tests, hot reload, explicit teardown).
   */
  destroy(): void {
    if (this.destroyed) return

    this.destroyed = true
    releaseStatefulRuntimeSingleton(this.singletonOwner)
  }

  /**
   * Expose merged observable state for consumers.
   *
   * @returns The combined {@link CoreStates} observable object.
   */
  get states(): CoreStates {
    return {
      blockedEventStream: toObservable(blockedEvent),
      consent: toObservable(consent),
      eventStream: toObservable(event),
      flags: toObservable(flags),
      personalizations: toObservable(personalizations),
      previewPanelAttached: toObservable(previewPanelAttached),
      previewPanelOpen: toObservable(previewPanelOpen),
      profile: toObservable(profile),
    }
  }

  /**
   * Reset internal state. Consent and preview panel state are intentionally preserved.
   *
   * @remarks
   * Resetting personalization also resets analytics dependencies as a
   * consequence of the current shared-state design.
   * @example
   * ```ts
   * core.reset()
   * ```
   */
  reset(): void {
    batch(() => {
      blockedEvent.value = undefined
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
   * @example
   * ```ts
   * await core.flush()
   * ```
   */
  async flush(): Promise<void> {
    await this.analytics.flush()
    await this.personalization.flush()
  }

  /**
   * Update consent state
   *
   * @param accept - `true` if the user has granted consent; `false` otherwise.
   * @example
   * ```ts
   * core.consent(true)
   * ```
   */
  consent(accept: boolean): void {
    consent.value = accept
  }

  /**
   * Read current online state.
   *
   * @example
   * ```ts
   * if (this.online) {
   *   await this.flush()
   * }
   * ```
   */
  protected get online(): boolean {
    return online.value ?? false
  }

  /**
   * Update online state.
   *
   * @param isOnline - `true` if the runtime is online; `false` otherwise.
   * @example
   * ```ts
   * this.online = navigator.onLine
   * ```
   */
  protected set online(isOnline: boolean) {
    online.value = isOnline
  }

  /**
   * Register a preview panel compatible object to receive direct signal access.
   * This enables the preview panel to modify SDK state for testing and simulation.
   *
   * @param previewPanel - An object implementing PreviewPanelSignalObject
   * @remarks
   * This method is intended for use by the Preview Panel component.
   * Direct signal access allows immediate state updates without API calls.
   * @example
   * ```ts
   * const previewBridge: PreviewPanelSignalObject = {}
   * core.registerPreviewPanel(previewBridge)
   * ```
   */
  registerPreviewPanel(previewPanel: PreviewPanelSignalObject): void {
    Reflect.set(previewPanel, PREVIEW_PANEL_SIGNALS_SYMBOL, signals)
    Reflect.set(previewPanel, PREVIEW_PANEL_SIGNAL_FNS_SYMBOL, signalFns)
  }
}

export default CoreStateful
