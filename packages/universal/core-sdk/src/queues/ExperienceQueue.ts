import type { ExperienceApiClient } from '@contentful/optimization-api-client'
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
  experienceApi: Pick<ExperienceApiClient, 'upsertProfile'>
  eventInterceptors: LifecycleInterceptors['event']
  flushPolicy: ResolvedQueueFlushPolicy
  getAnonymousId: () => string | undefined
  getResetToken?: () => object | undefined
  offlineMaxEvents: number
  onOfflineDrop?: (context: ExperienceQueueDropContext) => void
  stateInterceptors: LifecycleInterceptors['state']
}

interface QueuedExperienceBatch {
  events: ExperienceEventArray
  request?: { profileId?: string; locale?: string }
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
  private readonly getResetToken: () => object | undefined
  private readonly offlineMaxEvents: number
  private readonly onOfflineDrop?: ExperienceQueueOptions['onOfflineDrop']
  private readonly queuedExperienceEvents: QueuedExperienceBatch[] = []
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
    this.getResetToken = options.getResetToken ?? (() => this)
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

  clearScheduledRetry(): void {
    this.flushRuntime.clearScheduledRetry()
  }

  clearQueuedEvents(): void {
    this.queuedExperienceEvents.length = 0
    this.flushRuntime.reset()
  }

  async send(
    event: ExperienceEventPayload,
    optimizationContext?: EventOptimizationContext,
  ): Promise<OptimizationData | undefined> {
    const token = this.getResetToken()
    const intercepted = await this.eventInterceptors.run(event)
    if (token === undefined || token !== this.getResetToken()) return undefined
    const validEvent = parseWithFriendlyError(ExperienceEventSchema, intercepted)

    eventSignal.value =
      optimizationContext === undefined
        ? validEvent
        : ({
            ...validEvent,
            optimization: optimizationContext,
          } satisfies OptimizationEventStreamEvent)

    if (onlineSignal.value) return await this.upsertProfile([validEvent])

    coreLogger.debug(`Queueing ${validEvent.type} event`, validEvent)
    this.enqueueEvent(validEvent)

    return undefined
  }

  sendPrepared(
    events: ExperienceEventArray,
    target: { profileId?: string; locale?: string },
  ): EventEmissionResult {
    if (this.getResetToken() === undefined) return { accepted: false }
    if (this.getQueuedEventCount() + events.length > this.offlineMaxEvents) {
      coreLogger.warn('Prepared Experience batch exceeds queue capacity; admission was rejected.')
      return { accepted: false }
    }
    const submission: QueuedExperienceBatch = {
      events,
      request: {
        ...target,
        profileId: target.profileId ?? this.getAnonymousId() ?? profileSignal.value?.id,
      },
    }
    this.queuedExperienceEvents.push(submission)
    events.forEach((event) => {
      eventSignal.value = event
    })
    void this.flush()
    return { accepted: true }
  }

  async flush({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (
      this.flushRuntime.shouldSkip({
        force,
        isOnline: !!onlineSignal.value && this.getResetToken() !== undefined,
      })
    )
      return
    if (this.queuedExperienceEvents.length === 0) {
      this.flushRuntime.clearScheduledRetry()
      return
    }

    const token = this.getResetToken()
    const isCurrent = (): boolean => token !== undefined && token === this.getResetToken()
    this.flushRuntime.markFlushStarted()
    try {
      await this.sendQueuedBatches(token)
      if (isCurrent()) this.flushRuntime.handleFlushSuccess()
    } catch (error) {
      coreLogger.warn('Experience queue flush request threw an error', error)
      if (isCurrent())
        this.flushRuntime.handleFlushFailure({
          queuedBatches: this.queuedExperienceEvents.length,
          queuedEvents: this.getQueuedEventCount(),
        })
    } finally {
      if (isCurrent()) this.flushRuntime.markFlushFinished()
    }
  }

  private async sendQueuedBatches(token: object | undefined): Promise<void> {
    const { queuedExperienceEvents } = this
    while (queuedExperienceEvents.length > 0) {
      const [first] = queuedExperienceEvents
      if (first === undefined) break
      const { events: queuedEvents, request } = first
      const events = [...queuedEvents]
      await this.upsertProfile(events, request)
      if (token !== this.getResetToken()) return
      if (queuedExperienceEvents[0] === first) {
        const offset = events.findIndex((event) => event === first.events[0])
        if (offset >= 0) first.events.splice(0, events.length - offset)
        if (first.events.length === 0) queuedExperienceEvents.shift()
      }
    }
  }

  private getQueuedEventCount(): number {
    let count = 0
    for (const { events } of this.queuedExperienceEvents) count += events.length
    return count
  }

  private enqueueEvent(event: ExperienceEventPayload): void {
    let droppedEvents: ExperienceEventArray = []

    if (this.getQueuedEventCount() >= this.offlineMaxEvents) {
      const dropCount = this.getQueuedEventCount() - this.offlineMaxEvents + 1
      droppedEvents = this.dropOldestEvents(dropCount)

      if (droppedEvents.length > 0) {
        coreLogger.warn(
          `Dropped ${droppedEvents.length} oldest offline event(s) due to queue limit (${this.offlineMaxEvents})`,
        )
      }
    }

    const last = this.queuedExperienceEvents.at(-1)
    if (last !== undefined && last.request === undefined) last.events.push(event)
    else this.queuedExperienceEvents.push({ events: [event] })

    if (droppedEvents.length > 0) {
      this.invokeOfflineDropCallback({
        droppedCount: droppedEvents.length,
        droppedEvents,
        maxEvents: this.offlineMaxEvents,
        queuedEvents: this.getQueuedEventCount(),
      })
    }
  }

  private dropOldestEvents(count: number): ExperienceEventArray {
    const { queuedExperienceEvents } = this
    const droppedEvents: ExperienceEventArray = []

    while (droppedEvents.length < count) {
      const [oldest] = queuedExperienceEvents
      if (oldest === undefined) break
      const { events, request } = oldest
      const dropCount = request === undefined ? count - droppedEvents.length : events.length
      droppedEvents.push(...events.splice(0, dropCount))
      if (events.length === 0) queuedExperienceEvents.shift()
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

  protected async upsertProfile(
    events: ExperienceEventArray,
    request?: QueuedExperienceBatch['request'],
  ): Promise<OptimizationData | undefined> {
    const token = this.getResetToken()
    const isCurrent = (): boolean => token !== undefined && token === this.getResetToken()
    if (isCurrent()) experienceRequestStateSignal.value = { status: 'pending' }
    try {
      const send = async (): Promise<OptimizationData> => {
        const profileId = request?.profileId ?? this.getAnonymousId() ?? profileSignal.value?.id
        if (request !== undefined) request.profileId = profileId
        const payload = { profileId, events }
        const data =
          request === undefined
            ? await this.experienceApi.upsertProfile(payload)
            : await this.experienceApi.upsertProfile(payload, {
                preflight: false,
                locale: request.locale ?? '',
              })
        return data
      }
      const data = await send()
      if (!isCurrent()) return undefined
      if (request !== undefined) request.profileId ??= data.profile.id
      await applyOptimizationDataToSignals(data, this.stateInterceptors, isCurrent)
      return isCurrent() ? data : undefined
    } catch (error) {
      if (!isCurrent()) return undefined
      experienceRequestStateSignal.value = {
        status: 'failed',
        reason: classifyExperienceRequestFailure(error),
      }
      throw error
    }
  }
}
