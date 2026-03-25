import {
  ExperienceEvent as ExperienceEventSchema,
  parseWithFriendlyError,
  type ExperienceEventArray,
  type ExperienceEvent as ExperienceEventPayload,
  type OptimizationData,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import { isEqual } from 'es-toolkit/predicate'
import type { LifecycleInterceptors } from '../CoreBase'
import { QueueFlushRuntime, type ResolvedQueueFlushPolicy } from '../lib/queue'
import {
  batch,
  changes as changesSignal,
  event as eventSignal,
  online as onlineSignal,
  profile as profileSignal,
  selectedPersonalizations as selectedPersonalizationsSignal,
} from '../signals'

const coreLogger = createScopedLogger('CoreStateful')

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

  clearScheduledRetry(): void {
    this.flushRuntime.clearScheduledRetry()
  }

  async send(event: ExperienceEventPayload): Promise<OptimizationData | undefined> {
    const intercepted = await this.eventInterceptors.run(event)
    const validEvent = parseWithFriendlyError(ExperienceEventSchema, intercepted)

    eventSignal.value = validEvent

    if (onlineSignal.value) return await this.upsertProfile([validEvent])

    coreLogger.debug(`Queueing ${validEvent.type} event`, validEvent)
    this.enqueueEvent(validEvent)

    return undefined
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

  private async upsertProfile(events: ExperienceEventArray): Promise<OptimizationData> {
    const anonymousId = this.getAnonymousId()
    if (anonymousId) coreLogger.debug(`Anonymous ID found: ${anonymousId}`)

    const data = await this.experienceApi.upsertProfile({
      profileId: anonymousId ?? profileSignal.value?.id,
      events,
    })

    await this.updateOutputSignals(data)

    return data
  }

  private async updateOutputSignals(data: OptimizationData): Promise<void> {
    const intercepted = await this.stateInterceptors.run(data)
    const { changes, profile, selectedPersonalizations } = intercepted

    batch(() => {
      if (!isEqual(changesSignal.value, changes)) changesSignal.value = changes
      if (!isEqual(profileSignal.value, profile)) profileSignal.value = profile
      if (!isEqual(selectedPersonalizationsSignal.value, selectedPersonalizations)) {
        selectedPersonalizationsSignal.value = selectedPersonalizations
      }
    })
  }
}
