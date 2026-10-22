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
import type { EventOptimizationContext } from '../events'
import { QueueFlushRuntime, type ResolvedQueueFlushPolicy } from '../lib/queue'
import { online as onlineSignal, profile as profileSignal } from '../signals'
import { publishEventStream } from './publishEventStream'

const coreLogger = createScopedLogger('CoreStateful')

const MAX_QUEUED_INSIGHTS_EVENTS = 25

interface QueuedProfileEvents {
  profile: Profile
  events: InsightsEventArray
}

interface InsightsQueueOptions {
  getResetToken?: () => object | undefined
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
  private resetToken: object = {}
  private readonly getResetToken: () => object | undefined
  private insightsPeriodicFlushTimer: ReturnType<typeof setInterval> | undefined

  constructor(options: InsightsQueueOptions) {
    const { eventInterceptors, flushPolicy, insightsApi } = options
    const { flushIntervalMs } = flushPolicy

    this.eventInterceptors = eventInterceptors
    this.flushIntervalMs = flushIntervalMs
    this.insightsApi = insightsApi
    this.getResetToken = options.getResetToken ?? (() => this)
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
    this.resetToken = {}
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
    const { resetToken: token } = this
    if (!this.isCurrent(token)) return
    const { value: profile } = profileSignal

    if (!profile) {
      coreLogger.warn('Attempting to emit an event without an Optimization profile')
      return
    }

    const intercepted = await this.eventInterceptors.run(event)
    if (!this.isCurrent(token)) return
    const validEvent = parseWithFriendlyError(InsightsEventSchema, intercepted)

    coreLogger.debug(`Queueing ${validEvent.type} event for profile ${profile.id}`, validEvent)

    const queuedProfileEvents = this.queuedInsightsByProfile.get(profile.id)

    publishEventStream(validEvent, optimizationContext)

    if (!this.isCurrent(token)) return
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
    const { resetToken: token } = this
    if (!this.isCurrent(token)) return
    const { force = false, beacon } = options

    if (!this.flushRuntime.hasActiveFlush && this.queuedInsightsByProfile.size === 0) {
      this.flushRuntime.clearScheduledRetry()
      this.reconcilePeriodicFlushTimer()
      return
    }

    await this.flushRuntime.runFlush({ force, isOnline: !!onlineSignal.value }, async () => {
      coreLogger.debug('Flushing insights event queue')
      await this.flushAttempt(this.createBatches(), beacon, token)
    })
  }

  private async flushAttempt(
    batches: BatchInsightsEventArray,
    beacon: InsightsQueueFlushOptions['beacon'],
    token: object,
  ): Promise<void> {
    try {
      const sendSuccess = await this.trySendBatches(batches, beacon ? { beacon } : undefined)
      if (!this.isCurrent(token)) return

      if (sendSuccess) {
        this.removeSentEvents(batches)
        this.flushRuntime.handleFlushSuccess()
      } else {
        this.flushRuntime.handleFlushFailure({
          queuedBatches: batches.length,
          queuedEvents: this.getQueuedEventCount(),
        })
      }
    } finally {
      if (this.isCurrent(token)) this.reconcilePeriodicFlushTimer()
    }
  }

  private createBatches(): BatchInsightsEventArray {
    const batches: BatchInsightsEventArray = []

    this.queuedInsightsByProfile.forEach(({ profile, events }) => {
      batches.push({ profile, events: [...events] })
    })

    return batches
  }

  private isCurrent(token: object): boolean {
    return token === this.resetToken && this.getResetToken() !== undefined
  }

  private removeSentEvents(batches: BatchInsightsEventArray): void {
    for (const { profile, events } of batches) {
      const queued = this.queuedInsightsByProfile.get(profile.id)
      if (!queued) continue

      queued.events.splice(0, events.length)
      if (queued.events.length === 0) this.queuedInsightsByProfile.delete(profile.id)
    }
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
