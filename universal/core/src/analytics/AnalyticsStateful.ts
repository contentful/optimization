import {
  InsightsEvent as AnalyticsEvent,
  type BatchInsightsEventArray,
  type ComponentViewBuilderArgs,
  type InsightsEventArray,
  type ExperienceEvent as PersonalizationEvent,
  type Profile,
} from '@contentful/optimization-api-client'
import { createScopedLogger } from 'logger'
import type { ConsentGuard } from '../Consent'
import { guardedBy } from '../lib/decorators'
import type { ProductBaseOptions, ProductConfig } from '../ProductBase'
import {
  batch,
  consent,
  effect,
  event as eventSignal,
  online as onlineSignal,
  profile as profileSignal,
  toObservable,
  type Observable,
} from '../signals'
import AnalyticsBase from './AnalyticsBase'

const logger = createScopedLogger('Analytics')

/**
 * Default analytics state values applied at construction time.
 *
 * @public
 */
export interface AnalyticsProductConfigDefaults {
  /** Whether analytics collection is allowed by default. */
  consent?: boolean
  /** Default profile to associate with events. */
  profile?: Profile
}

/**
 * Configuration for the stateful analytics implementation.
 *
 * @public
 */
export interface AnalyticsProductConfig extends ProductConfig {
  /**
   * Default signal values applied on initialization.
   */
  defaults?: AnalyticsProductConfigDefaults
}

/**
 * Observables exposed by the stateful analytics product.
 *
 * @public
 */
export interface AnalyticsStates {
  /** Observable stream of the latest {@link AnalyticsEvent} or {@link PersonalizationEvent} (or `undefined`). */
  eventStream: Observable<AnalyticsEvent | PersonalizationEvent | undefined>
  /** Observable stream of the active {@link Profile} (or `undefined`). */
  profile: Observable<Profile | undefined>
}

/**
 * Options for configuring {@link AnalyticsStateful} functionality.
 *
 * @public
 * @see {@link ProductBaseOptions}
 */
export type AnalyticsStatefulOptions = ProductBaseOptions & {
  /** Configuration specific to the Analytics product */
  config?: AnalyticsProductConfig
}

/**
 * Maximum number of queued events before an automatic flush is triggered.
 *
 * @internal
 */
const MAX_QUEUED_EVENTS = 25

/**
 * Analytics implementation that maintains local state (consent, profile) and
 * queues events until flushed or the queue reaches a maximum size.
 *
 * @public
 */
class AnalyticsStateful extends AnalyticsBase implements ConsentGuard {
  /** In‑memory queue keyed by profile. */
  private readonly queue = new Map<Profile, InsightsEventArray>()

  /** Exposed observable state references. */
  readonly states: AnalyticsStates = {
    eventStream: toObservable(eventSignal),
    profile: toObservable(profileSignal),
  }

  /**
   * Create a new stateful analytics instance.
   *
   * @param options - Options to configure the analytics product for stateful environments.
   * @example
   * ```ts
   * const analytics = new AnalyticsStateful({ api, builder, config: { defaults: { consent: true } }, interceptors })
   * ```
   */
  constructor(options: AnalyticsStatefulOptions) {
    const { api, builder, config, interceptors } = options

    super({ api, builder, config, interceptors })

    const { defaults } = config ?? {}

    if (defaults?.profile !== undefined) {
      const { profile: defaultProfile } = defaults
      profileSignal.value = defaultProfile
    }

    effect(() => {
      const id = profileSignal.value?.id

      logger.info(
        `Analytics ${consent.value ? 'will' : 'will not'} be collected due to consent (${consent.value})`,
      )

      logger.debug(`Profile ${id && `with ID ${id}`} has been ${id ? 'set' : 'cleared'}`)
    })

    effect(() => {
      if (onlineSignal.value) void this.flush()
    })
  }

  /**
   * Reset analytics‑related signals and the last emitted event.
   *
   * @example
   * ```ts
   * analytics.reset()
   * ```
   */
  reset(): void {
    batch(() => {
      eventSignal.value = undefined
      profileSignal.value = undefined
    })
  }

  /**
   * Determine whether the named operation is permitted based on consent and
   * allowed event type configuration.
   *
   * @param name - The method name; `'trackComponentView'` is normalized
   * to `'component'` for allow‑list checks.
   * @returns `true` if the operation is permitted; otherwise `false`.
   * @example
   * ```ts
   * if (analytics.hasConsent('track')) { ... }
   * ```
   */
  hasConsent(name: string): boolean {
    return (
      !!consent.value ||
      (this.allowedEventTypes ?? []).includes(
        name === 'trackComponentView' || name === 'trackFlagView' ? 'component' : name,
      )
    )
  }

  /**
   * Hook invoked when an operation is blocked due to missing consent.
   *
   * @param name - The blocked operation name.
   * @param payload - The original arguments supplied to the operation.
   * @example
   * ```ts
   * analytics.onBlockedByConsent('track', [payload])
   * ```
   */
  onBlockedByConsent(name: string, payload: unknown[]): void {
    logger.warn(
      `Event "${name}" was blocked due to lack of consent; payload: ${JSON.stringify(payload)}`,
    )
  }

  /**
   * Guard used to suppress duplicate component/flag view events based on a
   * duplication key and the component identifier.
   *
   * @param _name - The operation name (unused).
   * @param payload - Tuple of [builderArgs, duplicationScope].
   * @returns `true` if the event is NOT a duplicate and should proceed.
   * @example
   * ```ts
   * if (analytics.isNotDuplicated('trackComponentView', [{ componentId: 'hero' }, 'page'])) { ... }
   * ```
   */
  isNotDuplicated(_name: string, payload: [ComponentViewBuilderArgs, string]): boolean {
    const [{ componentId: value }, duplicationScope] = payload

    const isDuplicated = this.duplicationDetector.isPresent(duplicationScope, value)

    if (!isDuplicated) this.duplicationDetector.addValue(duplicationScope, value)

    return !isDuplicated
  }

  /**
   * Hook invoked when an operation is blocked by the duplication guard.
   *
   * @param name - The blocked operation name.
   * @param payload - The original arguments supplied to the operation.
   * @example
   * ```ts
   * analytics.onBlockedByDuplication('trackComponentView', [payload])
   * ```
   */
  onBlockedByDuplication(name: string, payload: unknown[]): void {
    const componentType = name === 'trackFlagView' ? 'flag' : 'component'

    logger.debug(
      `Duplicate "${componentType} view" event detected, skipping; payload: ${JSON.stringify(payload)}`,
    )
  }

  /**
   * Queue a component view event for the active profile.
   *
   * @param payload - Component view builder arguments.
   * @param _duplicationScope - Optional string used to scope duplication (used
   * by guards); an empty string `''` is converted to the `undefined` scope.
   * @returns A promise that resolves when the event has been queued.
   * @example
   * ```ts
   * await analytics.trackComponentView({ componentId: 'hero-banner' })
   * ```
   */
  @guardedBy('isNotDuplicated', { onBlocked: 'onBlockedByDuplication' })
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackComponentView(
    payload: ComponentViewBuilderArgs,
    _duplicationScope = '',
  ): Promise<void> {
    logger.info(`Processing "component view" event for ${payload.componentId}`)

    await this.enqueueEvent(this.builder.buildComponentView(payload))
  }

  /**
   * Queue a flag view event for the active profile.
   *
   * @param payload - Flag view builder arguments.
   * @param _duplicationScope - Optional string used to scope duplication (used
   * by guards); an empty string `''` is converted to the `undefined` scope.
   * @returns A promise that resolves when the event has been queued.
   * @example
   * ```ts
   * await analytics.trackFlagView({ componentId: 'feature-flag-123' })
   * ```
   */
  @guardedBy('isNotDuplicated', { onBlocked: 'onBlockedByDuplication' })
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackFlagView(payload: ComponentViewBuilderArgs, _duplicationScope = ''): Promise<void> {
    logger.debug(`Processing "flag view" event for ${payload.componentId}`)

    await this.enqueueEvent(this.builder.buildFlagView(payload))
  }

  /**
   * Intercept, validate, and place an event into the profile‑scoped queue; then
   * trigger a size‑based flush if necessary.
   *
   * @param event - The event to enqueue.
   */
  private async enqueueEvent(event: AnalyticsEvent): Promise<void> {
    const { value: profile } = profileSignal

    if (!profile) {
      logger.warn('Attempting to emit an event without an Optimization profile')

      return
    }

    const intercepted = await this.interceptors.event.run(event)

    const validEvent = AnalyticsEvent.parse(intercepted)

    logger.debug(`Queueing ${validEvent.type} event for profile ${profile.id}`, validEvent)

    const profileEventQueue = this.queue.get(profile)

    eventSignal.value = validEvent

    if (profileEventQueue) {
      profileEventQueue.push(validEvent)
    } else {
      this.queue.set(profile, [validEvent])
    }

    await this.flushMaxEvents()
  }

  /**
   * Flush the queue automatically when the total number of queued events
   * reaches {@link MAX_QUEUED_EVENTS}.
   */
  private async flushMaxEvents(): Promise<void> {
    if (this.queue.values().toArray().flat().length >= MAX_QUEUED_EVENTS) await this.flush()
  }

  /**
   * Send all queued events grouped by profile and clear the queue.
   * @remarks Only under rare circumstances should there be more than one
   * profile in a stateful application.
   * @example
   * ```ts
   * await analytics.flush()
   * ```
   */
  async flush(): Promise<void> {
    logger.debug('Flushing event queue')

    const batches: BatchInsightsEventArray = []

    this.queue.forEach((events, profile) => batches.push({ profile, events }))

    if (!batches.length) return

    const sendSuccess = await this.api.insights.sendBatchEvents(batches)

    if (sendSuccess) this.queue.clear()
  }
}

export default AnalyticsStateful
