import type { ComponentViewBuilderArgs } from '../lib/api-client/builders'
import type { Profile } from '../lib/api-client/experience/dto/profile'
import {
  InsightsEvent,
  type BatchInsightsEventArray,
  type InsightsEventArray,
} from '../lib/api-client/insights/dto/event'
import { guardedBy } from '../lib/decorators'
import { logger } from '../lib/logger'
import { event as eventSignal, profile as profileSignal } from '../signals'
import AnalyticsBase from './AnalyticsBase'

const MAX_QUEUED_EVENTS = 25

class AnalyticsStateful extends AnalyticsBase {
  readonly #queue = new Map<Profile, InsightsEventArray>()

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackComponentView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.info(`[Analytics] Processing "component view" event`)

    await this.#enqueueEvent(this.builder.buildComponentView(args))
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackFlagView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.debug(`[Analytics] Processing "flag view" event`)

    await this.#enqueueEvent(this.builder.buildFlagView(args))
  }

  async #enqueueEvent(event: InsightsEvent): Promise<void> {
    const { value: profile } = profileSignal

    if (!profile) {
      logger.warn('Attempting to emit an event without an Optimization profile')

      return
    }

    const intercepted = await this.interceptor.event.run(event)

    const validEvent = InsightsEvent.parse(intercepted)

    logger.debug(`Queueing ${event.type} event for profile ${profile.id}`, event)

    const profileEventQueue = this.#queue.get(profile)

    eventSignal.value = validEvent

    if (profileEventQueue) {
      profileEventQueue.push(validEvent)
    } else {
      this.#queue.set(profile, [validEvent])
    }

    await this.#flushMaxEvents()
  }

  async #flushMaxEvents(): Promise<void> {
    if (this.#queue.values().toArray().flat().length >= MAX_QUEUED_EVENTS) await this.flush()
  }

  async flush(): Promise<void> {
    logger.debug(`[Analytics] Flushing event queue`)

    const batches: BatchInsightsEventArray = []

    this.#queue.forEach((events, profile) => batches.push({ profile, events }))

    await this.api.insights.sendBatchEvents(batches)

    this.#queue.clear()
  }
}

export default AnalyticsStateful
