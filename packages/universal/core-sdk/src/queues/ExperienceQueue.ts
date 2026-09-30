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
  private requestProfileId: string | undefined = undefined
  private readonly stateInterceptors: ExperienceQueueOptions['stateInterceptors']

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

  /** Request-private identity is volatile and uses the ordinary queue. @internal */
  bindProfileId(profileId?: string): void {
    this.requestProfileId = profileId
  }

  clearScheduledRetry(): void {
    this.flushRuntime.clearScheduledRetry()
  }

  clearQueuedEvents(): void {
    this.queuedExperienceEvents.clear()
    this.flushRuntime.reset()
  }

  async send(
    event: ExperienceEventPayload,
    optimizationContext?: EventOptimizationContext,
  ): Promise<OptimizationData | undefined> {
    return await this.sendBatch([event], [optimizationContext])
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
        queuedEvents.forEach((queuedEvent) => {
          this.queuedExperienceEvents.delete(queuedEvent)
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

  async sendBatch(
    events: ExperienceEventArray,
    optimizationContexts: ReadonlyArray<EventOptimizationContext | undefined> = [],
  ): Promise<OptimizationData | undefined> {
    if (events.length === 0) throw new TypeError('Experience batches require at least one event.')

    const validEvents: ExperienceEventArray = []
    for (const event of events) {
      const intercepted = await this.eventInterceptors.run(event)
      validEvents.push(parseWithFriendlyError(ExperienceEventSchema, intercepted))
    }

    if (
      !onlineSignal.value &&
      validEvents.length > 1 &&
      this.queuedExperienceEvents.size + validEvents.length > this.offlineMaxEvents
    ) {
      throw new Error('Experience batch exceeds offline queue capacity and was not enqueued.')
    }

    validEvents.forEach((event, index) => {
      const { [index]: optimizationContext } = optimizationContexts
      eventSignal.value =
        optimizationContext === undefined
          ? event
          : ({
              ...event,
              optimization: optimizationContext,
            } satisfies OptimizationEventStreamEvent)
    })

    if (onlineSignal.value) return await this.upsertProfile(validEvents)

    if (validEvents.length > 1) {
      validEvents.forEach((event) => this.queuedExperienceEvents.add(event))
      return undefined
    }

    validEvents.forEach((event) => {
      coreLogger.debug(`Queueing ${event.type} event`, event)
      this.enqueueEvent(event)
    })
    return undefined
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

  protected async upsertProfile(events: ExperienceEventArray): Promise<OptimizationData> {
    const anonymousId = this.getAnonymousId()
    if (anonymousId) coreLogger.debug(`Anonymous ID found: ${anonymousId}`)

    experienceRequestStateSignal.value = { status: 'pending' }

    try {
      const data = await this.experienceApi.upsertProfile({
        profileId: this.requestProfileId ?? anonymousId ?? profileSignal.value?.id,
        events,
      })

      if (this.requestProfileId !== undefined) {
        const {
          profile: { id },
        } = data
        this.requestProfileId = id
      }
      await applyOptimizationDataToSignals(data, this.stateInterceptors)

      return data
    } catch (error) {
      experienceRequestStateSignal.value = {
        status: 'failed',
        reason: classifyExperienceRequestFailure(error),
      }
      throw error
    }
  }
}
