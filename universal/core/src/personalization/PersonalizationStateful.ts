import {
  type InsightsEvent as AnalyticsEvent,
  type ChangeArray,
  type ComponentViewBuilderArgs,
  type Flags,
  type IdentifyBuilderArgs,
  type Json,
  type MergeTagEntry,
  type OptimizationData,
  type PageViewBuilderArgs,
  parseWithFriendlyError,
  ExperienceEvent as PersonalizationEvent,
  type ExperienceEventArray as PersonalizationEventArray,
  type Profile,
  type ScreenViewBuilderArgs,
  type SelectedPersonalizationArray,
  type TrackBuilderArgs,
} from '@contentful/optimization-api-client'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { isEqual } from 'es-toolkit/predicate'
import { createScopedLogger } from 'logger'
import type { BlockedEvent } from '../BlockedEvent'
import type { ConsentGuard } from '../Consent'
import { guardedBy } from '../lib/decorators'
import { toPositiveInt } from '../lib/number'
import {
  type QueueFlushPolicy,
  QueueFlushRuntime,
  type ResolvedQueueFlushPolicy,
  resolveQueueFlushPolicy,
} from '../lib/queue'
import type { ProductBaseOptions, ProductConfig } from '../ProductBase'
import {
  batch,
  blockedEvent as blockedEventSignal,
  changes as changesSignal,
  consent as consentSignal,
  effect,
  event as eventSignal,
  flags as flagsSignal,
  type Observable,
  online as onlineSignal,
  personalizations as personalizationsSignal,
  profile as profileSignal,
  toObservable,
} from '../signals'
import PersonalizationBase from './PersonalizationBase'
import type { ResolvedData } from './resolvers'

const logger = createScopedLogger('Personalization')

/**
 * Default state values for {@link PersonalizationStateful} applied at construction time.
 *
 * @public
 */
export interface PersonalizationProductConfigDefaults {
  /** Whether personalization is allowed by default. */
  consent?: boolean
  /** Initial diff of changes produced by the service. */
  changes?: ChangeArray
  /** Default active profile used for personalization. */
  profile?: Profile
  /** Preselected personalization variants (e.g., winning treatments). */
  personalizations?: SelectedPersonalizationArray
}

/**
 * Configuration for {@link PersonalizationStateful}.
 *
 * @public
 */
export interface PersonalizationProductConfig extends ProductConfig {
  /** Default signal values applied during initialization. */
  defaults?: PersonalizationProductConfigDefaults

  /**
   * Policy that controls the offline personalization queue size and drop telemetry.
   */
  queuePolicy?: PersonalizationQueuePolicy

  /**
   * Function used to obtain an anonymous user identifier.
   *
   * @remarks
   * If a `getAnonymousId` function has been provided, the returned value will
   * take precedence over the `id` property of the current {@link Profile}
   * signal value
   *
   * @returns A string identifier, or `undefined` if no anonymous ID is available.
   */
  getAnonymousId?: () => string | undefined
}

/**
 * Context payload emitted when offline personalization events are dropped due to queue bounds.
 *
 * @public
 */
export interface PersonalizationOfflineQueueDropContext {
  /** Number of dropped events. */
  droppedCount: number
  /** Dropped events in oldest-first order. */
  droppedEvents: PersonalizationEventArray
  /** Configured queue max size. */
  maxEvents: number
  /** Queue size after enqueueing the current event. */
  queuedEvents: number
}

/**
 * Policy options for the stateful personalization offline queue.
 *
 * @public
 */
export interface PersonalizationQueuePolicy {
  /**
   * Maximum number of personalization events retained while offline.
   */
  maxEvents?: number

  /**
   * Callback invoked whenever oldest events are dropped due to queue bounds.
   */
  onDrop?: (context: PersonalizationOfflineQueueDropContext) => void

  /**
   * Policy that controls offline queue flush retries, backoff, and circuit
   * behavior after repeated failures.
   */
  flushPolicy?: QueueFlushPolicy
}

/**
 * Observables exposed by {@link PersonalizationStateful} that mirror internal signals.
 *
 * @public
 */
export interface PersonalizationStates {
  /** Observable stream of the latest blocked event payload (or `undefined`). */
  blockedEventStream: Observable<BlockedEvent | undefined>
  /** Observable stream of the latest {@link AnalyticsEvent} or {@link PersonalizationEvent} (or `undefined`). */
  eventStream: Observable<AnalyticsEvent | PersonalizationEvent | undefined>
  /** Live view of effective flags for the current profile (if available). */
  flags: Observable<Flags | undefined>
  /** Live view of the current profile. */
  profile: Observable<Profile | undefined>
  /** Live view of selected personalizations (variants). */
  personalizations: Observable<SelectedPersonalizationArray | undefined>
}

/**
 * Options for configuring {@link PersonalizationStateful} functionality.
 *
 * @public
 * @see {@link ProductBaseOptions}
 */
export type PersonalizationStatefulOptions = ProductBaseOptions & {
  /** Configuration specific to the Personalization product */
  config?: PersonalizationProductConfig
}

const OFFLINE_QUEUE_MAX_EVENTS = 100

interface ResolvedQueuePolicy {
  maxEvents: number
  onDrop?: PersonalizationQueuePolicy['onDrop']
  flushPolicy: ResolvedQueueFlushPolicy
}

const resolvePersonalizationQueuePolicy = (
  policy: PersonalizationQueuePolicy | undefined,
): ResolvedQueuePolicy => ({
  maxEvents: toPositiveInt(policy?.maxEvents, OFFLINE_QUEUE_MAX_EVENTS),
  onDrop: policy?.onDrop,
  flushPolicy: resolveQueueFlushPolicy(policy?.flushPolicy),
})

/**
 * Stateful personalization product that manages consent, profile, flags, and
 * selected variants while emitting Experience events and updating state.
 *
 * @public
 * @remarks
 * The class maintains reactive signals and exposes read‑only observables via
 * {@link PersonalizationStateful.states}. Events are validated via schema parsers and
 * run through interceptors before being submitted. Resulting state is merged
 * back into signals.
 */
class PersonalizationStateful extends PersonalizationBase implements ConsentGuard {
  /** In-memory ordered queue for offline personalization events. */
  private readonly offlineQueue = new Set<PersonalizationEvent>()
  /** Resolved offline queue policy values. */
  private readonly queuePolicy: ResolvedQueuePolicy
  /** Shared queue flush retry runtime state machine. */
  private readonly flushRuntime: QueueFlushRuntime

  /** Exposed observable state references. */
  readonly states: PersonalizationStates = {
    blockedEventStream: toObservable(blockedEventSignal),
    eventStream: toObservable(eventSignal),
    flags: toObservable(flagsSignal),
    profile: toObservable(profileSignal),
    personalizations: toObservable(personalizationsSignal),
  }

  /**
   * Function that provides an anonymous ID when available.
   *
   * @internal
   */
  getAnonymousId: () => string | undefined

  /**
   * Create a new stateful personalization instance.
   *
   * @param options - Options to configure the personalization product for stateful environments.
   * @example
   * ```ts
   * const personalization = new PersonalizationStateful({ api, builder, config: { getAnonymousId }, interceptors })
   * ```
   */
  constructor(options: PersonalizationStatefulOptions) {
    const { api, builder, config, interceptors } = options

    super({ api, builder, config, interceptors })

    const { defaults, getAnonymousId, queuePolicy } = config ?? {}

    this.queuePolicy = resolvePersonalizationQueuePolicy(queuePolicy)
    this.flushRuntime = new QueueFlushRuntime({
      policy: this.queuePolicy.flushPolicy,
      onRetry: () => {
        void this.flush()
      },
      onCallbackError: (callbackName, error) => {
        logger.warn(`Personalization flush policy callback "${callbackName}" failed`, error)
      },
    })

    if (defaults) {
      const {
        changes: defaultChanges,
        personalizations: defaultPersonalizations,
        profile: defaultProfile,
      } = defaults

      batch(() => {
        changesSignal.value = defaultChanges
        personalizationsSignal.value = defaultPersonalizations
        profileSignal.value = defaultProfile
      })
    }

    if (defaults?.consent !== undefined) {
      const { consent: defaultConsent } = defaults
      consentSignal.value = defaultConsent
    }

    this.getAnonymousId = getAnonymousId ?? (() => undefined)

    // Log signal changes for observability
    effect(() => {
      logger.debug(
        `Profile ${profileSignal.value && `with ID ${profileSignal.value.id}`} has been ${profileSignal.value ? 'set' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.debug(
        `Variants have been ${personalizationsSignal.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(
        `Personalization ${consentSignal.value ? 'will' : 'will not'} take effect due to consent (${consentSignal.value})`,
      )
    })

    effect(() => {
      if (!onlineSignal.value) return

      this.flushRuntime.clearScheduledRetry()
      void this.flush({ force: true })
    })
  }

  /**
   * Reset stateful signals managed by this product.
   *
   * @remarks
   * Clears `changes`, `profile`, and selected `personalizations`.
   * @example
   * ```ts
   * personalization.reset()
   * ```
   */
  reset(): void {
    this.flushRuntime.reset()

    batch(() => {
      changesSignal.value = undefined
      blockedEventSignal.value = undefined
      eventSignal.value = undefined
      profileSignal.value = undefined
      personalizationsSignal.value = undefined
    })
  }

  /**
   * Get the specified Custom Flag's value (derived from the signal).
   * @param name - The name or key of the Custom Flag.
   * @returns The current value of the Custom Flag if found.
   * @example
   * ```ts
   * const flagValue = personalization.getCustomFlag('dark-mode')
   * ```
   * */
  getCustomFlag(name: string, changes: ChangeArray | undefined = changesSignal.value): Json {
    return super.getCustomFlag(name, changes)
  }

  /**
   * Resolve a Contentful entry to a personalized variant using the current
   * or provided selections.
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param entry - The entry to personalize.
   * @param personalizations - Optional selections; defaults to the current signal value.
   * @returns The resolved entry data.
   * @example
   * ```ts
   * const { entry } = personalization.personalizeEntry(baselineEntry)
   * ```
   */
  personalizeEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    personalizations: SelectedPersonalizationArray | undefined = personalizationsSignal.value,
  ): ResolvedData<S, M, L> {
    return super.personalizeEntry<S, M, L>(entry, personalizations)
  }

  /**
   * Resolve a merge tag to a value based on the current (or provided) profile.
   *
   * @param embeddedEntryNodeTarget - The merge‑tag entry node to resolve.
   * @param profile - Optional profile; defaults to the current signal value.
   * @returns The resolved value (type depends on the tag).
   * @remarks
   * Merge tags are references to profile data that can be substituted into content.
   * @example
   * ```ts
   * const name = personalization.getMergeTagValue(mergeTagNode)
   * ```
   */
  getMergeTagValue(
    embeddedEntryNodeTarget: MergeTagEntry,
    profile: Profile | undefined = profileSignal.value,
  ): unknown {
    return super.getMergeTagValue(embeddedEntryNodeTarget, profile)
  }

  /**
   * Determine whether the named operation is permitted based on consent and
   * allowed event type configuration.
   *
   * @param name - Method name; `trackComponentView` is normalized to
   * `'component'` for allow‑list checks.
   * @returns `true` if the operation is permitted; otherwise `false`.
   * @example
   * ```ts
   * if (personalization.hasConsent('track')) { ... }
   * ```
   */
  hasConsent(name: string): boolean {
    return (
      !!consentSignal.value ||
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
   * personalization.onBlockedByConsent('track', [payload])
   * ```
   */
  onBlockedByConsent(name: string, payload: readonly unknown[]): void {
    logger.warn(
      `Event "${name}" was blocked due to lack of consent; payload: ${JSON.stringify(payload)}`,
    )
    this.reportBlockedEvent('consent', 'personalization', name, payload)
  }

  /**
   * Identify the current profile/visitor to associate traits with a profile
   * and update optimization state.
   *
   * @param payload - Identify builder payload.
   * @returns The resulting {@link OptimizationData} for the identified user.
   * @example
   * ```ts
   * const data = await personalization.identify({ userId: 'user-123' })
   * ```
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async identify(payload: IdentifyBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info('Sending "identify" event')

    const event = this.builder.buildIdentify(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  /**
   * Record a page view and update optimization state.
   *
   * @param payload - Page view builder payload.
   * @returns The evaluated {@link OptimizationData} for this page view.
   * @example
   * ```ts
   * const data = await personalization.page({ properties: { title: 'Home' } })
   * ```
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async page(payload: PageViewBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info('Sending "page" event')

    const event = this.builder.buildPageView(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  /**
   * Record a screen view and update optimization state.
   *
   * @param payload - Screen view builder payload.
   * @returns The evaluated {@link OptimizationData} for this screen view.
   * @example
   * ```ts
   * const data = await personalization.screen({ name: 'HomeScreen' })
   * ```
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async screen(payload: ScreenViewBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info(`Sending "screen" event for "${payload.name}"`)

    const event = this.builder.buildScreenView(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  /**
   * Record a custom track event and update optimization state.
   *
   * @param payload - Track builder payload.
   * @returns The evaluated {@link OptimizationData} for this event.
   * @example
   * ```ts
   * const data = await personalization.track({ event: 'button_click' })
   * ```
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async track(payload: TrackBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info(`Sending "track" event "${payload.event}"`)

    const event = this.builder.buildTrack(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  /**
   * Record a "sticky" component view and update optimization state.
   *
   * @param payload - Component view builder payload.
   * @returns The evaluated {@link OptimizationData} for this component view.
   * @example
   * ```ts
   * const data = await personalization.trackComponentView({ componentId: 'hero-banner' })
   * ```
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackComponentView(
    payload: ComponentViewBuilderArgs,
  ): Promise<OptimizationData | undefined> {
    logger.info(`Sending "track personalization" event for ${payload.componentId}`)

    const event = this.builder.buildComponentView(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  /**
   * Intercept, validate, and place an event into the offline event queue; then
   * trigger a size‑based flush if necessary.
   *
   * @param event - The event to enqueue.
   */
  private async sendOrEnqueueEvent(
    event: PersonalizationEvent,
  ): Promise<OptimizationData | undefined> {
    const intercepted = await this.interceptors.event.run(event)

    const validEvent = parseWithFriendlyError(PersonalizationEvent, intercepted)

    eventSignal.value = validEvent

    if (onlineSignal.value) return await this.upsertProfile([validEvent])

    logger.debug(`Queueing ${validEvent.type} event`, validEvent)

    this.enqueueOfflineEvent(validEvent)

    return undefined
  }

  /**
   * Enqueue an offline event, dropping oldest events first when queue bounds are reached.
   *
   * @param event - Event to enqueue.
   */
  private enqueueOfflineEvent(event: PersonalizationEvent): void {
    let droppedEvents: PersonalizationEventArray = []

    if (this.offlineQueue.size >= this.queuePolicy.maxEvents) {
      const dropCount = this.offlineQueue.size - this.queuePolicy.maxEvents + 1
      droppedEvents = this.dropOldestOfflineEvents(dropCount)

      if (droppedEvents.length > 0) {
        logger.warn(
          `Dropped ${droppedEvents.length} oldest personalization offline event(s) due to queue limit (${this.queuePolicy.maxEvents})`,
        )
      }
    }

    this.offlineQueue.add(event)

    if (droppedEvents.length > 0) {
      this.invokeQueueDropCallback({
        droppedCount: droppedEvents.length,
        droppedEvents,
        maxEvents: this.queuePolicy.maxEvents,
        queuedEvents: this.offlineQueue.size,
      })
    }
  }

  /**
   * Drop oldest offline events from the queue.
   *
   * @param count - Number of oldest events to drop.
   * @returns Dropped events in oldest-first order.
   */
  private dropOldestOfflineEvents(count: number): PersonalizationEventArray {
    const droppedEvents: PersonalizationEventArray = []

    for (let index = 0; index < count; index += 1) {
      const oldestEvent = this.offlineQueue.values().next()
      if (oldestEvent.done) break

      this.offlineQueue.delete(oldestEvent.value)
      droppedEvents.push(oldestEvent.value)
    }

    return droppedEvents
  }

  /**
   * Invoke offline queue drop callback in a fault-tolerant manner.
   *
   * @param context - Drop callback payload.
   */
  private invokeQueueDropCallback(context: PersonalizationOfflineQueueDropContext): void {
    try {
      this.queuePolicy.onDrop?.(context)
    } catch (error) {
      logger.warn('Personalization offline queue drop callback failed', error)
    }
  }

  /**
   * Flush the offline queue
   *
   * @param options - Optional flush controls.
   * @param options.force - When `true`, bypass offline/backoff/circuit gates and attempt immediately.
   *
   * @example
   * ```ts
   * await personalization.flush()
   */
  async flush(options: { force?: boolean } = {}): Promise<void> {
    await this.flushOfflineQueue(options)
  }

  /**
   * Flush queued offline events using retry/circuit guards.
   *
   * @param options - Flush controls.
   * @param options.force - When true, bypass online/backoff/circuit gates.
   */
  private async flushOfflineQueue(options: { force?: boolean } = {}): Promise<void> {
    const { force = false } = options

    if (this.flushRuntime.shouldSkip({ force, isOnline: !!onlineSignal.value })) return

    if (this.offlineQueue.size === 0) {
      this.flushRuntime.clearScheduledRetry()
      return
    }

    logger.debug('Flushing offline event queue')

    const queuedEvents = Array.from(this.offlineQueue)
    this.flushRuntime.markFlushStarted()

    try {
      const sendSuccess = await this.tryUpsertQueuedEvents(queuedEvents)

      if (sendSuccess) {
        queuedEvents.forEach((event) => {
          this.offlineQueue.delete(event)
        })
        this.flushRuntime.handleFlushSuccess()
      } else {
        this.flushRuntime.handleFlushFailure({
          queuedBatches: this.offlineQueue.size > 0 ? 1 : 0,
          queuedEvents: this.offlineQueue.size,
        })
      }
    } finally {
      this.flushRuntime.markFlushFinished()
    }
  }

  /**
   * Attempt to send queued events to the Experience API.
   *
   * @param events - Snapshot of queued events to send.
   * @returns `true` when send succeeds; otherwise `false`.
   */
  private async tryUpsertQueuedEvents(events: PersonalizationEventArray): Promise<boolean> {
    try {
      await this.upsertProfile(events)
      return true
    } catch (error) {
      logger.warn('Personalization offline queue flush request threw an error', error)
      return false
    }
  }

  /**
   * Submit events to the Experience API, updating output signals with the
   * returned state.
   *
   * @param events - The events to submit.
   * @returns The {@link OptimizationData} returned by the service.
   * @internal
   * @privateRemarks
   * If a `getAnonymousId` function has been provided, the returned value will
   * take precedence over the `id` property of the current {@link Profile}
   * signal value
   */
  private async upsertProfile(events: PersonalizationEventArray): Promise<OptimizationData> {
    const anonymousId = this.getAnonymousId()
    if (anonymousId) logger.debug(`Anonymous ID found: ${anonymousId}`)

    const data = await this.api.experience.upsertProfile({
      profileId: anonymousId ?? profileSignal.value?.id,
      events,
    })

    await this.updateOutputSignals(data)

    return data
  }

  /**
   * Apply returned optimization state to local signals after interceptor processing.
   *
   * @param data - Optimization state returned by the service.
   * @internal
   */
  private async updateOutputSignals(data: OptimizationData): Promise<void> {
    const intercepted = await this.interceptors.state.run(data)

    const { changes, personalizations, profile } = intercepted

    batch(() => {
      if (!isEqual(changesSignal.value, changes)) changesSignal.value = changes
      if (!isEqual(profileSignal.value, profile)) profileSignal.value = profile
      if (!isEqual(personalizationsSignal.value, personalizations))
        personalizationsSignal.value = personalizations
    })
  }
}

export default PersonalizationStateful
