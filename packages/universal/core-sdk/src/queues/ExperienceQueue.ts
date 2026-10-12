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
import { getProfileRevision } from '../signals/profileRevision'
import { applyOptimizationDataToSignals } from '../state/applyOptimizationDataToSignals'

const coreLogger = createScopedLogger('CoreStateful')

const classifyExperienceRequestFailure = (error: unknown): ExperienceRequestFailureReason => {
  if (error instanceof Error && error.name === 'AbortError') return 'timeout'
  return 'api-error'
}

/**
 * Legacy context payload for offline Experience event eviction.
 *
 * @deprecated Offline admission no longer evicts events; this context is not emitted.
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
  stateInterceptors: LifecycleInterceptors['state']
}

interface QueuedExperienceBatch {
  events: ExperienceEventArray
  request?: { profileId?: string; locale?: string }
}

interface QueuedDelivery {
  token: object | undefined
  profileId?: string
}

const rememberProfileId = (
  request: QueuedExperienceBatch['request'],
  data: OptimizationData,
): void => {
  if (request !== undefined) request.profileId ??= data.profile.id
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
  private readonly queuedExperienceEvents: QueuedExperienceBatch[] = []
  private readonly stateInterceptors: ExperienceQueueOptions['stateInterceptors']
  private activeFlush: Promise<void> | undefined
  private destroyToken: object | undefined
  private destroyProfileId: string | undefined
  private destroying = false

  constructor(options: ExperienceQueueOptions) {
    const {
      experienceApi,
      eventInterceptors,
      flushPolicy,
      getAnonymousId,
      offlineMaxEvents,
      stateInterceptors,
    } = options

    this.experienceApi = experienceApi
    this.eventInterceptors = eventInterceptors
    this.getResetToken = options.getResetToken ?? (() => this)
    this.getAnonymousId = getAnonymousId
    this.offlineMaxEvents = offlineMaxEvents
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
    this.destroyToken = undefined
    this.destroyProfileId = undefined
    this.queuedExperienceEvents.length = 0
    this.flushRuntime.reset()
    this.activeFlush = undefined
  }

  async flushOnDestroy(): Promise<void> {
    this.destroyToken = this.getResetToken()
    this.destroyProfileId = profileSignal.value?.id
    try {
      this.destroyProfileId = this.getAnonymousId() ?? this.destroyProfileId
    } catch (error) {
      coreLogger.warn('Could not resolve an anonymous ID during destroy()', error)
    }
    this.destroying = true
    this.clearScheduledRetry()
    await this.flush({ force: true, allowDestroy: true })
  }

  private isAcceptingEvents(): boolean {
    return !this.destroying && this.getResetToken() !== undefined
  }

  async send(
    event: ExperienceEventPayload,
    optimizationContext?: EventOptimizationContext,
  ): Promise<EventEmissionResult> {
    if (!this.isAcceptingEvents()) return { accepted: false }
    const token = this.getResetToken()
    const profileRevision = getProfileRevision()
    const intercepted = await this.eventInterceptors.run(event)
    if (!this.isAcceptingEvents() || token !== this.getResetToken()) return { accepted: false }
    const validEvent = parseWithFriendlyError(ExperienceEventSchema, intercepted)

    if (!onlineSignal.value && this.getQueuedEventCount() >= this.offlineMaxEvents) {
      coreLogger.warn('Offline Experience queue is full; event admission was rejected.')
      return { accepted: false }
    }

    eventSignal.value =
      optimizationContext === undefined
        ? validEvent
        : ({
            ...validEvent,
            optimization: optimizationContext,
          } satisfies OptimizationEventStreamEvent)

    if (onlineSignal.value) {
      const data = await this.upsertProfile([validEvent], undefined, undefined, profileRevision)
      return data === undefined ? { accepted: true } : { accepted: true, data }
    }

    coreLogger.debug(`Queueing ${validEvent.type} event`, validEvent)
    this.enqueueEvent(validEvent)

    return { accepted: true }
  }

  sendPrepared(
    events: ExperienceEventArray,
    target: { profileId?: string; locale?: string },
  ): EventEmissionResult {
    if (!this.isAcceptingEvents()) return { accepted: false }
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

  async flush({
    force = false,
    allowDestroy = false,
  }: { force?: boolean; allowDestroy?: boolean } = {}): Promise<void> {
    if (this.activeFlush !== undefined) {
      await this.activeFlush
      return
    }
    if (this.shouldSkipFlush(force, allowDestroy)) return
    if (this.queuedExperienceEvents.length === 0) {
      this.flushRuntime.clearScheduledRetry()
      return
    }

    const token = this.getResetToken()
    const attempt = this.flushAttempt(token)
    this.activeFlush = attempt
    try {
      await attempt
    } finally {
      if (this.activeFlush === attempt) this.activeFlush = undefined
    }
  }

  private async flushAttempt(token: object | undefined): Promise<void> {
    this.flushRuntime.markFlushStarted()
    try {
      await this.sendQueuedBatches(token)
      this.finishSuccessfulFlush(token)
    } catch (error) {
      this.handleFlushError(error, token)
    } finally {
      this.finishFlush(token)
    }
  }

  private shouldSkipFlush(force: boolean, allowDestroy: boolean): boolean {
    return (
      (this.destroying && !allowDestroy) ||
      this.flushRuntime.shouldSkip({
        force,
        isOnline: !!onlineSignal.value && this.getResetToken() !== undefined,
      })
    )
  }

  private finishSuccessfulFlush(token: object | undefined): void {
    if (this.isDeliveryCurrent(token) && !this.destroying) this.flushRuntime.handleFlushSuccess()
  }

  private handleFlushError(error: unknown, token: object | undefined): void {
    coreLogger.warn('Experience queue flush request threw an error', error)
    if (this.isDeliveryCurrent(token) && !this.destroying)
      this.flushRuntime.handleFlushFailure({
        queuedBatches: this.queuedExperienceEvents.length,
        queuedEvents: this.getQueuedEventCount(),
      })
  }

  private finishFlush(token: object | undefined): void {
    if (!this.isDeliveryCurrent(token)) return
    this.flushRuntime.markFlushFinished()
    if (!this.destroying) return
    this.queuedExperienceEvents.length = 0
    this.destroyToken = undefined
    this.destroyProfileId = undefined
  }

  private isDeliveryCurrent(token: object | undefined): boolean {
    return (
      token !== undefined &&
      (token === this.getResetToken() || (this.destroying && token === this.destroyToken))
    )
  }

  private async sendQueuedBatches(token: object | undefined): Promise<void> {
    const { queuedExperienceEvents } = this
    let profileId: string | undefined = undefined
    while (queuedExperienceEvents.length > 0) {
      const [first] = queuedExperienceEvents
      if (first === undefined) break
      const { events: queuedEvents, request } = first
      const events = [...queuedEvents]
      const data = await this.upsertProfile(events, request, {
        token,
        profileId: this.destroying ? profileId : undefined,
      })
      if (!this.isDeliveryCurrent(token)) return
      profileId = data?.profile.id ?? profileId
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
    const last = this.queuedExperienceEvents.at(-1)
    if (last !== undefined && last.request === undefined) last.events.push(event)
    else this.queuedExperienceEvents.push({ events: [event] })
  }

  protected async upsertProfile(
    events: ExperienceEventArray,
    request?: QueuedExperienceBatch['request'],
    delivery?: QueuedDelivery,
    profileRevision = getProfileRevision(),
  ): Promise<OptimizationData | undefined> {
    const token = this.getResetToken()
    const isLive = (): boolean => this.isLiveRequest(token)
    const canPublish = (): boolean => isLive() && profileRevision === getProfileRevision()
    const isDestroyDrain = (): boolean => this.isDestroyDeliveryCurrent(delivery)
    const isAccepted = (): boolean => isLive() || isDestroyDrain()
    if (isLive()) experienceRequestStateSignal.value = { status: 'pending' }
    try {
      const data = await this.requestExperienceData(events, request, delivery?.profileId)
      if (!isAccepted()) return undefined
      rememberProfileId(request, data)
      if (isLive()) await applyOptimizationDataToSignals(data, this.stateInterceptors, canPublish)
      this.finishSuccessfulRequest(token)
      return isAccepted() ? data : undefined
    } catch (error) {
      if (!isAccepted()) return undefined
      if (isLive())
        experienceRequestStateSignal.value = {
          status: 'failed',
          reason: classifyExperienceRequestFailure(error),
        }
      throw error
    }
  }

  private finishSuccessfulRequest(token: object | undefined): void {
    if (this.isLiveRequest(token) && experienceRequestStateSignal.value.status !== 'success') {
      experienceRequestStateSignal.value = { status: 'success' }
    }
  }

  private isLiveRequest(token: object | undefined): boolean {
    return !this.destroying && token !== undefined && token === this.getResetToken()
  }

  private isDestroyDeliveryCurrent(delivery: QueuedDelivery | undefined): boolean {
    return (
      this.destroying && this.destroyToken !== undefined && delivery?.token === this.destroyToken
    )
  }

  private async requestExperienceData(
    events: ExperienceEventArray,
    request: QueuedExperienceBatch['request'],
    continuationProfileId: string | undefined,
  ): Promise<OptimizationData> {
    const profileId =
      request?.profileId ??
      continuationProfileId ??
      (this.destroying ? this.destroyProfileId : (this.getAnonymousId() ?? profileSignal.value?.id))
    if (request !== undefined) request.profileId = profileId
    const payload = { profileId, events }
    if (request === undefined) return await this.experienceApi.upsertProfile(payload)
    return await this.experienceApi.upsertProfile(payload, {
      preflight: false,
      locale: request.locale ?? '',
    })
  }
}
