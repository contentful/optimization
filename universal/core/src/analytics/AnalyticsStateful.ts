import type ApiClient from '@contentful/optimization-api-client'
import {
  InsightsEvent as AnalyticsEvent,
  type BatchInsightsEventArray,
  type ComponentViewBuilderArgs,
  type EventBuilder,
  type InsightsEventArray,
  type ExperienceEvent as PersonalizationEvent,
  type Profile,
} from '@contentful/optimization-api-client'
import { logger } from 'logger'
import type { ConsentGuard } from '../Consent'
import { guardedBy } from '../lib/decorators'
import type { ProductConfig } from '../ProductBase'
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
 * Maximum number of queued events before an automatic flush is triggered.
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
   * @param api - Optimization API client.
   * @param builder - Event builder for constructing events.
   * @param config - Product configuration and default state values.
   */
  constructor(api: ApiClient, builder: EventBuilder, config?: AnalyticsProductConfig) {
    super(api, builder, config)

    const { defaults } = config ?? {}

    if (defaults?.profile !== undefined) {
      const { profile: defaultProfile } = defaults
      profileSignal.value = defaultProfile
    }

    effect(() => {
      const id = profileSignal.value?.id

      logger.info(
        `[Analytics] Analytics ${consent.value ? 'will' : 'will not'} be collected due to consent (${consent.value})`,
      )

      logger.info(`[Analytics] Profile ${id && `with ID ${id}`} has been ${id ? 'set' : 'cleared'}`)
    })

    effect(() => {
      if (onlineSignal.value) void this.flush()
    })
  }

  /**
   * Reset analytics‑related signals and the last emitted event.
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
   */
  onBlockedByConsent(name: string, payload: unknown[]): void {
    logger.warn(
      `[Anaylytics] Event "${name}" was blocked due to lack of consent; payload: ${JSON.stringify(payload)}`,
    )
  }

  /**
   * Guard used to suppress duplicate component/flag view events based on a
   * duplication key and the component identifier.
   *
   * @param _name - The operation name (unused).
   * @param payload - Tuple of [builderArgs, duplicationScope].
   * @returns `true` if the event is NOT a duplicate and should proceed.
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
   */
  onBlockedByDuplication(name: string, payload: unknown[]): void {
    const componentType = name === 'trackFlagView' ? 'flag' : 'component'

    logger.info(
      `[Analytics] Duplicate "${componentType} view" event detected, skipping; payload: ${JSON.stringify(payload)}`,
    )
  }

  /**
   * Queue a component view event for the active profile.
   *
   * @param payload - Component view builder arguments.
   * @param _duplicationScope - Optional string used to scope duplication (used
   * by guards); an empty string `''` is converted to the `undefined` scope
   */
  @guardedBy('isNotDuplicated', { onBlocked: 'onBlockedByDuplication' })
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackComponentView(
    payload: ComponentViewBuilderArgs,
    _duplicationScope = '',
  ): Promise<void> {
    logger.info(`[Analytics] Processing "component view" event for`, payload.componentId)

    await this.enqueueEvent(this.builder.buildComponentView(payload))
  }

  /**
   * Queue a flag view event for the active profile.
   *
   * @param payload - Flag view builder arguments.
   * @param _duplicationScope - Optional string used to scope duplication (used
   * by guards); an empty string `''` is converted to the `undefined` scope
   */
  @guardedBy('isNotDuplicated', { onBlocked: 'onBlockedByDuplication' })
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackFlagView(payload: ComponentViewBuilderArgs, _duplicationScope = ''): Promise<void> {
    logger.debug(`[Analytics] Processing "flag view" event for`, payload.componentId)

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

    const intercepted = await this.interceptor.event.run(event)

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
   */
  async flush(): Promise<void> {
    logger.debug(`[Analytics] Flushing event queue`)

    const batches: BatchInsightsEventArray = []

    this.queue.forEach((events, profile) => batches.push({ profile, events }))

    if (!batches.length) return

    const sendSuccess = await this.api.insights.sendBatchEvents(batches)

    if (sendSuccess) this.queue.clear()
  }
}

export default AnalyticsStateful
