import {
  ExperienceEvent as ExperienceEventSchema,
  parseWithFriendlyError,
  type ExperienceEventArray,
  type ExperienceEvent as ExperienceEventPayload,
  type OptimizationData,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { LifecycleInterceptors } from '../CoreBase'
import type { EventOptimizationContext, OptimizationEventStreamEvent } from '../events'
import { QueueFlushRuntime, type ResolvedQueueFlushPolicy } from '../lib/queue'
import {
  experienceRequestState as experienceRequestStateSignal,
  online as onlineSignal,
  profile as profileSignal,
  type ExperienceRequestFailureReason,
} from '../signals'
import { applyOptimizationDataToSignals } from '../state/applyOptimizationDataToSignals'
import { publishEventStream } from './publishEventStream'

const coreLogger = createScopedLogger('CoreStateful')

const classifyExperienceRequestFailure = (error: unknown): ExperienceRequestFailureReason => {
  if (error instanceof Error && error.name === 'AbortError') return 'timeout'
  return 'api-error'
}

/**
 * Context payload emitted when offline Experience events are dropped.
 *
 * @public
 */
export interface ExperienceQueueDropContext {
  /** Number of dropped events. */
  droppedCount: number
  /** Dropped events in oldest-first order. */
  droppedEvents: ExperienceEventArray
  /** Configured queue max size. */
  maxEvents: number
  /** Queue size after enqueueing the current event. */
  queuedEvents: number
}

interface ExperienceQueueOptions {
  getResetToken?: () => object | undefined
  experienceApi: {
    upsertProfile: (payload: {
      profileId?: string
      events: ExperienceEventArray
    }) => Promise<OptimizationData>
  }
  eventInterceptors: LifecycleInterceptors['event']
  flushPolicy: ResolvedQueueFlushPolicy
  getAnonymousId: () => string | undefined
  offlineMaxEvents: number
  onOfflineDrop?: (context: ExperienceQueueDropContext) => void
  stateInterceptors: LifecycleInterceptors['state']
}

/**
 * Internal Experience send/offline runtime used by {@link CoreStateful}.
 *
 * @internal
 */
export class ExperienceQueue {
  private readonly experienceApi: ExperienceQueueOptions['experienceApi']
  private readonly eventInterceptors: ExperienceQueueOptions['eventInterceptors']
  private readonly flushRuntime: QueueFlushRuntime
  private readonly getAnonymousId: ExperienceQueueOptions['getAnonymousId']
  private readonly offlineMaxEvents: number
  private readonly onOfflineDrop?: ExperienceQueueOptions['onOfflineDrop']
  private readonly queuedExperienceEvents = new Set<ExperienceEventPayload>()
  private readonly stateInterceptors: ExperienceQueueOptions['stateInterceptors']
  private activeFlush: Promise<void> | undefined
  private resetToken: object = {}
  private readonly getResetToken: () => object | undefined
  private destroying = false
  private teardownProfileId: string | undefined

  constructor(options: ExperienceQueueOptions) {
    const {
      experienceApi,
      eventInterceptors,
      flushPolicy,
      getAnonymousId,
      offlineMaxEvents,
      onOfflineDrop,
      stateInterceptors,
    } = options

    this.experienceApi = experienceApi
    this.eventInterceptors = eventInterceptors
    this.getAnonymousId = getAnonymousId
    this.offlineMaxEvents = offlineMaxEvents
    this.onOfflineDrop = onOfflineDrop
    this.stateInterceptors = stateInterceptors
    this.getResetToken = options.getResetToken ?? (() => this)
    this.flushRuntime = new QueueFlushRuntime({
      policy: flushPolicy,
      onRetry: () => {
        void this.flush()
      },
      onCallbackError: (callbackName, error) => {
        coreLogger.warn(`Experience flush policy callback "${callbackName}" failed`, error)
      },
    })
  }

  clearScheduledRetry(): void {
    this.flushRuntime.clearScheduledRetry()
  }

  clearQueuedEvents(): void {
    this.resetToken = {}
    this.activeFlush = undefined
    this.queuedExperienceEvents.clear()
    this.flushRuntime.reset()
  }

  async send(
    event: ExperienceEventPayload,
    optimizationContext?: EventOptimizationContext,
  ): Promise<OptimizationData | undefined> {
    const { resetToken: token } = this
    if (!this.isLive(token)) return undefined
    const intercepted = await this.eventInterceptors.run(event)
    if (!this.isLive(token)) return undefined
    const validEvent = parseWithFriendlyError(ExperienceEventSchema, intercepted)

    publishEventStream(
      optimizationContext === undefined
        ? validEvent
        : ({
            ...validEvent,
            optimization: optimizationContext,
          } satisfies OptimizationEventStreamEvent),
    )

    if (!this.isLive(token)) return undefined
    if (onlineSignal.value) return await this.upsertProfile([validEvent])

    coreLogger.debug(`Queueing ${validEvent.type} event`, validEvent)
    this.enqueueEvent(validEvent)

    return undefined
  }

  async flush(options: { force?: boolean } = {}): Promise<void> {
    if (!this.destroying && this.getResetToken() === undefined) return
    if (this.activeFlush !== undefined) {
      await this.activeFlush
      return
    }
    const { force = false } = options

    if (this.flushRuntime.shouldSkip({ force, isOnline: !!onlineSignal.value })) return

    if (this.queuedExperienceEvents.size === 0) {
      this.flushRuntime.clearScheduledRetry()
      return
    }

    coreLogger.debug('Flushing offline Experience event queue')

    const queuedEvents = Array.from(this.queuedExperienceEvents)
    // Install joining before pending-state subscribers can observe this attempt.
    const { promise: attempt, resolve: complete, reject: fail } = Promise.withResolvers<undefined>()
    this.activeFlush = attempt
    void this.flushAttempt(queuedEvents, this.resetToken).then(() => {
      complete(undefined)
    }, fail)
    try {
      await attempt
    } finally {
      if (this.activeFlush === attempt) this.activeFlush = undefined
    }
  }

  private async flushAttempt(queuedEvents: ExperienceEventArray, token: object): Promise<void> {
    this.flushRuntime.markFlushStarted()

    try {
      const sendSuccess = await this.tryUpsertQueuedEvents(queuedEvents)
      if (!this.isDeliveryCurrent(token)) return

      if (sendSuccess) {
        queuedEvents.forEach((queuedEvent) => {
          this.queuedExperienceEvents.delete(queuedEvent)
        })
        this.flushRuntime.handleFlushSuccess()
      } else if (!this.destroying) {
        this.flushRuntime.handleFlushFailure({
          queuedBatches: this.queuedExperienceEvents.size > 0 ? 1 : 0,
          queuedEvents: this.queuedExperienceEvents.size,
        })
      }
    } finally {
      if (this.isDeliveryCurrent(token)) {
        this.flushRuntime.markFlushFinished()
        if (this.destroying) this.clearQueuedEvents()
      }
    }
  }

  async flushOnDestroy(): Promise<void> {
    if (this.destroying) {
      if (this.activeFlush) await this.activeFlush
      return
    }
    this.teardownProfileId = this.getAnonymousId() ?? profileSignal.value?.id
    this.destroying = true
    this.clearScheduledRetry()
    try {
      await this.flush({ force: true })
    } finally {
      this.clearQueuedEvents()
      this.teardownProfileId = undefined
    }
  }

  private isLive(token: object): boolean {
    return !this.destroying && this.isDeliveryCurrent(token)
  }

  private isDeliveryCurrent(token: object): boolean {
    return token === this.resetToken && (this.destroying || this.getResetToken() !== undefined)
  }

  private enqueueEvent(event: ExperienceEventPayload): void {
    let droppedEvents: ExperienceEventArray = []

    if (this.queuedExperienceEvents.size >= this.offlineMaxEvents) {
      const dropCount = this.queuedExperienceEvents.size - this.offlineMaxEvents + 1
      droppedEvents = this.dropOldestEvents(dropCount)

      if (droppedEvents.length > 0) {
        coreLogger.warn(
          `Dropped ${droppedEvents.length} oldest offline event(s) due to queue limit (${this.offlineMaxEvents})`,
        )
      }
    }

    this.queuedExperienceEvents.add(event)

    if (droppedEvents.length > 0) {
      this.invokeOfflineDropCallback({
        droppedCount: droppedEvents.length,
        droppedEvents,
        maxEvents: this.offlineMaxEvents,
        queuedEvents: this.queuedExperienceEvents.size,
      })
    }
  }

  private dropOldestEvents(count: number): ExperienceEventArray {
    const droppedEvents: ExperienceEventArray = []

    for (let index = 0; index < count; index += 1) {
      const oldestEvent = this.queuedExperienceEvents.values().next()
      if (oldestEvent.done) break

      this.queuedExperienceEvents.delete(oldestEvent.value)
      droppedEvents.push(oldestEvent.value)
    }

    return droppedEvents
  }

  private invokeOfflineDropCallback(context: ExperienceQueueDropContext): void {
    try {
      this.onOfflineDrop?.(context)
    } catch (error) {
      coreLogger.warn('Offline queue drop callback failed', error)
    }
  }

  private async tryUpsertQueuedEvents(events: ExperienceEventArray): Promise<boolean> {
    try {
      await this.upsertProfile(events)
      return true
    } catch (error) {
      coreLogger.warn('Experience queue flush request threw an error', error)
      return false
    }
  }

  protected async upsertProfile(
    events: ExperienceEventArray,
  ): Promise<OptimizationData | undefined> {
    const { resetToken: token } = this
    const anonymousId = this.getRequestProfileId()
    if (anonymousId) coreLogger.debug(`Anonymous ID found: ${anonymousId}`)

    if (this.isLive(token)) experienceRequestStateSignal.value = { status: 'pending' }
    if (!this.isDeliveryCurrent(token)) return undefined

    try {
      const data = await this.experienceApi.upsertProfile({
        profileId: anonymousId,
        events,
      })

      if (!this.isDeliveryCurrent(token)) return undefined
      if (this.isLive(token)) {
        await applyOptimizationDataToSignals(data, this.stateInterceptors, () => this.isLive(token))
      }

      return this.isLive(token) ? data : undefined
    } catch (error) {
      if (!this.isLive(token)) return undefined
      experienceRequestStateSignal.value = {
        status: 'failed',
        reason: classifyExperienceRequestFailure(error),
      }
      throw error
    }
  }

  private getRequestProfileId(): string | undefined {
    return this.destroying
      ? this.teardownProfileId
      : (this.getAnonymousId() ?? profileSignal.value?.id)
  }
}
