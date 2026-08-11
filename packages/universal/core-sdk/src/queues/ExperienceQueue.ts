import {
  ExperienceEvent as ExperienceEventSchema,
  parseWithFriendlyError,
  type ExperienceEventArray,
  type ExperienceEvent as ExperienceEventPayload,
  type OptimizationData,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { LifecycleInterceptors } from '../CoreBase'
import type {
  EventEmissionResult,
  EventOptimizationContext,
  OptimizationEventStreamEvent,
} from '../events'
import { QueueFlushRuntime, type ResolvedQueueFlushPolicy } from '../lib/queue'
import {
  event as eventSignal,
  experienceRequestState as experienceRequestStateSignal,
  online as onlineSignal,
  profile as profileSignal,
  type ExperienceRequestFailureReason,
} from '../signals'
import { applyOptimizationDataToSignals } from '../state/applyOptimizationDataToSignals'

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
  experienceApi: {
    upsertProfile: (payload: {
      profileId?: string
      events: ExperienceEventArray
    }) => Promise<OptimizationData>
  }
  eventInterceptors: LifecycleInterceptors['event']
  flushPolicy: ResolvedQueueFlushPolicy
  getAnonymousId: () => string | undefined
  getCurrentStateGeneration: () => number
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
  private readonly getCurrentStateGeneration: ExperienceQueueOptions['getCurrentStateGeneration']
  private readonly offlineMaxEvents: number
  private readonly onOfflineDrop?: ExperienceQueueOptions['onOfflineDrop']
  private readonly queuedExperienceEvents = new Set<ExperienceEventPayload>()
  private readonly stateInterceptors: ExperienceQueueOptions['stateInterceptors']
  private latestRequestId = 0
  private nextRequestId = 0

  constructor(options: ExperienceQueueOptions) {
    const {
      experienceApi,
      eventInterceptors,
      flushPolicy,
      getAnonymousId,
      getCurrentStateGeneration,
      offlineMaxEvents,
      onOfflineDrop,
      stateInterceptors,
    } = options

    this.experienceApi = experienceApi
    this.eventInterceptors = eventInterceptors
    this.getAnonymousId = getAnonymousId
    this.getCurrentStateGeneration = getCurrentStateGeneration
    this.offlineMaxEvents = offlineMaxEvents
    this.onOfflineDrop = onOfflineDrop
    this.stateInterceptors = stateInterceptors
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

  invalidateRequests(): void {
    this.latestRequestId = ++this.nextRequestId
    experienceRequestStateSignal.value = { status: 'idle' }
  }

  clearQueuedEvents(): void {
    this.queuedExperienceEvents.clear()
    this.flushRuntime.reset()
  }

  async send(
    event: ExperienceEventPayload,
    optimizationContext?: EventOptimizationContext,
  ): Promise<OptimizationData | undefined> {
    const result = await this.sendEvent(event, optimizationContext)
    return result.accepted ? result.data : undefined
  }

  async sendCurrentState(
    event: ExperienceEventPayload,
    currentStateGeneration: number,
  ): Promise<EventEmissionResult> {
    if (!this.isCurrentStateAllowed(currentStateGeneration)) return { accepted: false }

    return await this.sendEvent(event, undefined, currentStateGeneration)
  }

  async flush(options: { force?: boolean } = {}): Promise<void> {
    const { force = false } = options

    if (this.flushRuntime.shouldSkip({ force, isOnline: !!onlineSignal.value })) return

    if (this.queuedExperienceEvents.size === 0) {
      this.flushRuntime.clearScheduledRetry()
      return
    }

    coreLogger.debug('Flushing offline Experience event queue')

    const queuedEvents = Array.from(this.queuedExperienceEvents)
    this.flushRuntime.markFlushStarted()

    try {
      const sendSuccess = await this.tryUpsertQueuedEvents(queuedEvents)

      if (sendSuccess) {
        queuedEvents.forEach((event) => {
          this.queuedExperienceEvents.delete(event)
        })
        this.flushRuntime.handleFlushSuccess()
      } else {
        this.flushRuntime.handleFlushFailure({
          queuedBatches: this.queuedExperienceEvents.size > 0 ? 1 : 0,
          queuedEvents: this.queuedExperienceEvents.size,
        })
      }
    } finally {
      this.flushRuntime.markFlushFinished()
    }
  }

  private async sendEvent(
    event: ExperienceEventPayload,
    optimizationContext?: EventOptimizationContext,
    currentStateGeneration?: number,
  ): Promise<EventEmissionResult> {
    const requestId = ++this.nextRequestId
    const intercepted = await this.eventInterceptors.run(event)

    if (
      currentStateGeneration !== undefined &&
      !this.isCurrentStateAllowed(currentStateGeneration)
    ) {
      return { accepted: false }
    }

    const validEvent = parseWithFriendlyError(ExperienceEventSchema, intercepted)

    eventSignal.value =
      optimizationContext === undefined
        ? validEvent
        : ({
            ...validEvent,
            optimization: optimizationContext,
          } satisfies OptimizationEventStreamEvent)

    if (onlineSignal.value) {
      const data = await this.upsertProfile([validEvent], requestId, currentStateGeneration)
      return { accepted: true, data }
    }

    coreLogger.debug(`Queueing ${validEvent.type} event`, validEvent)
    this.enqueueEvent(validEvent)

    return { accepted: true }
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
    requestId = ++this.nextRequestId,
    currentStateGeneration?: number,
  ): Promise<OptimizationData> {
    const isLatestRequest = (): boolean =>
      requestId === this.latestRequestId &&
      this.isCurrent(currentStateGeneration) &&
      experienceRequestStateSignal.value.status === 'pending'
    const anonymousId = this.getAnonymousId()
    if (anonymousId) coreLogger.debug(`Anonymous ID found: ${anonymousId}`)

    if (requestId > this.latestRequestId) {
      this.latestRequestId = requestId
      experienceRequestStateSignal.value = { status: 'pending' }
    }

    try {
      const data = await this.experienceApi.upsertProfile({
        profileId: anonymousId ?? profileSignal.value?.id,
        events,
      })

      if (isLatestRequest()) {
        await applyOptimizationDataToSignals(data, this.stateInterceptors, isLatestRequest)
      }

      return data
    } catch (error) {
      if (isLatestRequest()) {
        experienceRequestStateSignal.value = {
          status: 'failed',
          reason: classifyExperienceRequestFailure(error),
        }
      }
      throw error
    }
  }

  private isCurrent(generation: number | undefined): boolean {
    return generation === undefined || generation === this.getCurrentStateGeneration()
  }

  private isCurrentStateAllowed(generation: number): boolean {
    return !!onlineSignal.value && this.isCurrent(generation)
  }
}
