import {
  InsightsEvent as AnalyticsEvent,
  parseWithFriendlyError,
  type BatchInsightsEventArray,
  type ComponentViewBuilderArgs,
  type InsightsEventArray,
  type ExperienceEvent as PersonalizationEvent,
  type Profile,
} from '@contentful/optimization-api-client'
import { createScopedLogger } from 'logger'
import type { BlockedEvent } from '../BlockedEvent'
import type { ConsentGuard } from '../Consent'
import { guardedBy } from '../lib/decorators'
import { QueueFlushRuntime, resolveQueueFlushPolicy, type QueueFlushPolicy } from '../lib/queue'
import type { ProductBaseOptions, ProductConfig } from '../ProductBase'
import {
  batch,
  blockedEvent as blockedEventSignal,
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

  /**
   * Policy that controls stateful queue flush retries, backoff, and circuit
   * behavior after repeated failures.
   */
  queuePolicy?: QueueFlushPolicy
}

/**
 * Observables exposed by the stateful analytics product.
 *
 * @public
 */
export interface AnalyticsStates {
  /** Observable stream of the latest blocked event payload (or `undefined`). */
  blockedEventStream: Observable<BlockedEvent | undefined>
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
interface QueuedProfileEvents {
  profile: Profile
  events: InsightsEventArray
}

/**
 * Analytics implementation that maintains local state (consent, profile) and
 * queues events until flushed or the queue reaches a maximum size.
 *
 * @remarks
 * Repeated flush failures are managed by the configured {@link QueueFlushPolicy}
 * using bounded backoff and a temporary circuit-open window.
 *
 * @public
 */
class AnalyticsStateful extends AnalyticsBase implements ConsentGuard {
  /** In-memory queue keyed by stable profile identifier. */
  private readonly queue = new Map<Profile['id'], QueuedProfileEvents>()
  /** Shared queue flush retry runtime state machine. */
  private readonly flushRuntime: QueueFlushRuntime

  /** Exposed observable state references. */
  readonly states: AnalyticsStates = {
    blockedEventStream: toObservable(blockedEventSignal),
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

    this.applyDefaults(config?.defaults)

    this.flushRuntime = new QueueFlushRuntime({
      policy: resolveQueueFlushPolicy(config?.queuePolicy),
      onRetry: () => {
        void this.flush()
      },
      onCallbackError: (callbackName, error) => {
        logger.warn(`Analytics flush policy callback "${callbackName}" failed`, error)
      },
    })
    this.initializeEffects()
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
    this.flushRuntime.reset()

    batch(() => {
      blockedEventSignal.value = undefined
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
  onBlockedByConsent(name: string, payload: readonly unknown[]): void {
    logger.warn(
      `Event "${name}" was blocked due to lack of consent; payload: ${JSON.stringify(payload)}`,
    )

    this.reportBlockedEvent('consent', 'analytics', name, payload)
  }

  /**
   * Queue a component view event for the active profile.
   *
   * @param payload - Component view builder arguments.
   * @returns A promise that resolves when the event has been queued.
   * @example
   * ```ts
   * await analytics.trackComponentView({ componentId: 'hero-banner' })
   * ```
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackComponentView(payload: ComponentViewBuilderArgs): Promise<void> {
    logger.info(`Processing "component view" event for ${payload.componentId}`)

    await this.enqueueEvent(this.builder.buildComponentView(payload))
  }

  /**
   * Queue a flag view event for the active profile.
   *
   * @param payload - Flag view builder arguments.
   * @returns A promise that resolves when the event has been queued.
   * @example
   * ```ts
   * await analytics.trackFlagView({ componentId: 'feature-flag-123' })
   * ```
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackFlagView(payload: ComponentViewBuilderArgs): Promise<void> {
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

    const validEvent = parseWithFriendlyError(AnalyticsEvent, intercepted)

    logger.debug(`Queueing ${validEvent.type} event for profile ${profile.id}`, validEvent)

    const { id: profileId } = profile
    const queuedProfileEvents = this.queue.get(profileId)

    eventSignal.value = validEvent

    if (queuedProfileEvents) {
      // Keep the latest profile snapshot for this ID while appending events.
      queuedProfileEvents.profile = profile
      queuedProfileEvents.events.push(validEvent)
    } else {
      this.queue.set(profileId, { profile, events: [validEvent] })
    }

    await this.flushMaxEvents()
  }

  /**
   * Flush the queue automatically when the total number of queued events
   * reaches {@link MAX_QUEUED_EVENTS}.
   */
  private async flushMaxEvents(): Promise<void> {
    if (this.getQueuedEventCount() >= MAX_QUEUED_EVENTS) await this.flush()
  }

  /**
   * Send all queued events grouped by profile and clear the queue.
   *
   * @param options - Optional flush controls.
   * @param options.force - When `true`, bypass offline/backoff/circuit gates and attempt immediately.
   * @remarks Only under rare circumstances should there be more than one
   * profile in a stateful application.
   * @example
   * ```ts
   * await analytics.flush()
   * ```
   */
  async flush(options: { force?: boolean } = {}): Promise<void> {
    const { force = false } = options

    if (this.flushRuntime.shouldSkip({ force, isOnline: !!onlineSignal.value })) return

    logger.debug('Flushing event queue')

    const batches = this.createBatches()

    if (!batches.length) {
      this.flushRuntime.clearScheduledRetry()
      return
    }

    this.flushRuntime.markFlushStarted()

    try {
      const sendSuccess = await this.trySendBatches(batches)

      if (sendSuccess) {
        this.queue.clear()
        this.flushRuntime.handleFlushSuccess()
      } else {
        this.flushRuntime.handleFlushFailure({
          queuedBatches: batches.length,
          queuedEvents: this.getQueuedEventCount(),
        })
      }
    } finally {
      this.flushRuntime.markFlushFinished()
    }
  }

  /**
   * Apply default stateful analytics values when provided.
   *
   * @param defaults - Optional defaults for analytics state.
   */
  private applyDefaults(defaults: AnalyticsProductConfigDefaults | undefined): void {
    if (defaults?.profile === undefined) return

    const { profile: defaultProfile } = defaults
    profileSignal.value = defaultProfile
  }

  /**
   * Initialize reactive effects for consent/profile logging and online flushes.
   */
  private initializeEffects(): void {
    effect(() => {
      const id = profileSignal.value?.id

      logger.info(
        `Analytics ${consent.value ? 'will' : 'will not'} be collected due to consent (${consent.value})`,
      )

      logger.debug(`Profile ${id && `with ID ${id}`} has been ${id ? 'set' : 'cleared'}`)
    })

    effect(() => {
      if (!onlineSignal.value) return

      this.flushRuntime.clearScheduledRetry()
      void this.flush({ force: true })
    })
  }

  /**
   * Build batch payloads grouped by profile from the in-memory queue.
   *
   * @returns Grouped batch payloads.
   */
  private createBatches(): BatchInsightsEventArray {
    const batches: BatchInsightsEventArray = []

    this.queue.forEach(({ profile, events }) => {
      batches.push({ profile, events })
    })

    return batches
  }

  /**
   * Attempt to send queued batches to the Insights API.
   *
   * @param batches - Batches to send.
   * @returns `true` when send succeeds; otherwise `false`.
   */
  private async trySendBatches(batches: BatchInsightsEventArray): Promise<boolean> {
    try {
      return await this.api.insights.sendBatchEvents(batches)
    } catch (error) {
      logger.warn('Analytics queue flush request threw an error', error)
      return false
    }
  }

  /**
   * Compute the total number of queued events across all profiles.
   *
   * @returns Total queued event count.
   */
  private getQueuedEventCount(): number {
    let queuedCount = 0

    this.queue.forEach(({ events }) => {
      queuedCount += events.length
    })

    return queuedCount
  }
}

export default AnalyticsStateful
