import type { InsightsApiClientRequestOptions } from '@contentful/optimization-api-client'
import {
  InsightsEvent as InsightsEventSchema,
  parseWithFriendlyError,
  type BatchInsightsEventArray,
  type InsightsEventArray,
  type InsightsEvent as InsightsEventPayload,
  type Profile,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { LifecycleInterceptors } from '../CoreBase'
import type { EventOptimizationContext, OptimizationEventStreamEvent } from '../events'
import { QueueFlushRuntime, type ResolvedQueueFlushPolicy } from '../lib/queue'
import { event as eventSignal, online as onlineSignal, profile as profileSignal } from '../signals'

const coreLogger = createScopedLogger('CoreStateful')

const MAX_QUEUED_INSIGHTS_EVENTS = 25

interface QueuedProfileEvents {
  profile: Profile
  events: InsightsEventArray
}

interface InsightsQueueOptions {
  eventInterceptors: LifecycleInterceptors['event']
  flushPolicy: ResolvedQueueFlushPolicy
  insightsApi: {
    sendBatchEvents: (
      batches: BatchInsightsEventArray,
      options?: InsightsApiClientRequestOptions,
    ) => Promise<boolean>
  }
}

export interface InsightsQueueFlushOptions extends InsightsApiClientRequestOptions {
  force?: boolean
}

/**
 * Internal Insights queueing and flush runtime used by {@link CoreStateful}.
 *
 * @internal
 */
export class InsightsQueue {
  private readonly eventInterceptors: InsightsQueueOptions['eventInterceptors']
  private readonly flushIntervalMs: number
  private readonly flushRuntime: QueueFlushRuntime
  private readonly insightsApi: InsightsQueueOptions['insightsApi']
  private readonly queuedInsightsByProfile = new Map<Profile['id'], QueuedProfileEvents>()
  private insightsPeriodicFlushTimer: ReturnType<typeof setInterval> | undefined

  constructor(options: InsightsQueueOptions) {
    const { eventInterceptors, flushPolicy, insightsApi } = options
    const { flushIntervalMs } = flushPolicy

    this.eventInterceptors = eventInterceptors
    this.flushIntervalMs = flushIntervalMs
    this.insightsApi = insightsApi
    this.flushRuntime = new QueueFlushRuntime({
      policy: flushPolicy,
      onRetry: () => {
        void this.flush()
      },
      onCallbackError: (callbackName, error) => {
        coreLogger.warn(`Insights flush policy callback "${callbackName}" failed`, error)
      },
    })
  }

  clearScheduledRetry(): void {
    this.flushRuntime.clearScheduledRetry()
  }

  clearQueuedEvents(): void {
    this.queuedInsightsByProfile.clear()
    this.flushRuntime.reset()
    this.reconcilePeriodicFlushTimer()
  }

  clearPeriodicFlushTimer(): void {
    if (this.insightsPeriodicFlushTimer === undefined) return

    clearInterval(this.insightsPeriodicFlushTimer)
    this.insightsPeriodicFlushTimer = undefined
  }

  async send(
    event: InsightsEventPayload,
    optimizationContext?: EventOptimizationContext,
  ): Promise<void> {
    const { value: profile } = profileSignal

    if (!profile) {
      coreLogger.warn('Attempting to emit an event without an Optimization profile')
      return
    }

    const intercepted = await this.eventInterceptors.run(event)
    const validEvent = parseWithFriendlyError(InsightsEventSchema, intercepted)

    coreLogger.debug(`Queueing ${validEvent.type} event for profile ${profile.id}`, validEvent)

    const queuedProfileEvents = this.queuedInsightsByProfile.get(profile.id)

    eventSignal.value =
      optimizationContext === undefined
        ? validEvent
        : ({
            ...validEvent,
            optimization: optimizationContext,
          } satisfies OptimizationEventStreamEvent)

    if (queuedProfileEvents) {
      queuedProfileEvents.profile = profile
      queuedProfileEvents.events.push(validEvent)
    } else {
      this.queuedInsightsByProfile.set(profile.id, { profile, events: [validEvent] })
    }

    this.ensurePeriodicFlushTimer()
    if (this.getQueuedEventCount() >= MAX_QUEUED_INSIGHTS_EVENTS) {
      await this.flush()
    }
    this.reconcilePeriodicFlushTimer()
  }

  async flush(options: InsightsQueueFlushOptions = {}): Promise<void> {
    const { force = false, beacon } = options

    if (this.flushRuntime.shouldSkip({ force, isOnline: !!onlineSignal.value })) return

    coreLogger.debug('Flushing insights event queue')

    const batches = this.createBatches()

    if (!batches.length) {
      this.flushRuntime.clearScheduledRetry()
      this.reconcilePeriodicFlushTimer()
      return
    }

    this.flushRuntime.markFlushStarted()

    try {
      const sendSuccess = await this.trySendBatches(batches, beacon ? { beacon } : undefined)

      if (sendSuccess) {
        this.queuedInsightsByProfile.clear()
        this.flushRuntime.handleFlushSuccess()
      } else {
        this.flushRuntime.handleFlushFailure({
          queuedBatches: batches.length,
          queuedEvents: this.getQueuedEventCount(),
        })
      }
    } finally {
      this.flushRuntime.markFlushFinished()
      this.reconcilePeriodicFlushTimer()
    }
  }

  private createBatches(): BatchInsightsEventArray {
    const batches: BatchInsightsEventArray = []

    this.queuedInsightsByProfile.forEach(({ profile, events }) => {
      batches.push({ profile, events })
    })

    return batches
  }

  private async trySendBatches(
    batches: BatchInsightsEventArray,
    options: InsightsApiClientRequestOptions | undefined,
  ): Promise<boolean> {
    try {
      if (options === undefined) return await this.insightsApi.sendBatchEvents(batches)

      return await this.insightsApi.sendBatchEvents(batches, options)
    } catch (error) {
      coreLogger.warn('Insights queue flush request threw an error', error)
      return false
    }
  }

  private getQueuedEventCount(): number {
    let queuedCount = 0

    this.queuedInsightsByProfile.forEach(({ events }) => {
      queuedCount += events.length
    })

    return queuedCount
  }

  private ensurePeriodicFlushTimer(): void {
    if (this.insightsPeriodicFlushTimer !== undefined) return
    if (this.getQueuedEventCount() === 0) return

    this.insightsPeriodicFlushTimer = setInterval(() => {
      void this.flush()
    }, this.flushIntervalMs)
  }

  private reconcilePeriodicFlushTimer(): void {
    if (this.getQueuedEventCount() > 0) {
      this.ensurePeriodicFlushTimer()
      return
    }

    this.clearPeriodicFlushTimer()
  }
}
