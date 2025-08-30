import {
  Event,
  type BatchEventArrayType,
  type EventArrayType,
  type EventType,
} from '../lib/api-client/insights/dto/event'
import type { ProfileType } from '../lib/api-client/experience/dto/profile'
import { logger } from '../lib/logger'
import type { ComponentViewBuilderArgs } from '../lib/builders'
import { guardedBy } from '../lib/decorators'
import { profile as profileSignal } from '../signals'
import AnalyticsBase from './AnalyticsBase'

const MAX_QUEUED_EVENTS = 25

class AnalyticsStateful extends AnalyticsBase {
  readonly #queue = new Map<ProfileType, EventArrayType>()

  @guardedBy('hasNoConsent')
  async trackComponentView(args: ComponentViewBuilderArgs): Promise<void> {
    await this.#enqueueEvent(this.builder.buildComponentView(args))
  }

  @guardedBy('hasNoConsent')
  async trackFlagView(args: ComponentViewBuilderArgs): Promise<void> {
    await this.#enqueueEvent(this.builder.buildFlagView(args))
  }

  async #enqueueEvent(event: EventType): Promise<void> {
    const { value: profile } = profileSignal

    if (!profile) {
      logger.warn('Attempting to emit an event without an Optimization profile')

      return
    }

    logger.debug(`Queueing ${event.type} event for profile ${profile.id}`, event)

    const profileEventQueue = this.#queue.get(profile)

    const validEvent = Event.parse(event)

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
    const batches: BatchEventArrayType = []

    this.#queue.forEach((events, profile) => batches.push({ profile, events }))

    await this.api.insights.sendBatchEvents(batches)

    this.#queue.clear()
  }
}

export default AnalyticsStateful
