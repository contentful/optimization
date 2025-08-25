import { effect } from '@preact/signals-core'
import { GuardBy } from '../lib/decorators'
import { logger } from '../lib/logger'
import type ApiClient from '../lib/api-client'
import type { Signals } from '../CoreStateful'
import type { BatchEventType, EventType } from '../lib/api-client/insights/dto/event'
import AnalyticsBase from './AnalyticsBase'

type BatchEventQueue = Map<string, BatchEventType>

@GuardBy('hasNoConsent', {
  onBlock: ({ method }) => {
    logger.info(`Call to AnalyticsStateful.${String(method)} blocked due to lack of consent`)
  },
})
class AnalyticsStateful extends AnalyticsBase {
  readonly #consent: Signals['consent']
  readonly #profile: Signals['profile']
  readonly #queue: BatchEventQueue = new Map()

  constructor(signals: Signals, api: ApiClient) {
    super(api)

    const { consent, profile } = signals

    this.#consent = consent
    this.#profile = profile

    effect(() => {
      logger.info(
        `Analytics ${this.#consent.value ? 'will' : 'will not'} be collected due to consent (${this.#consent.value})`,
      )
    })
  }

  // @ts-expect-error -- value is read by the decorator
  private hasNoConsent(): boolean {
    return !this.#consent.value
  }

  track(event: EventType): void {
    const { value: profile } = this.#profile

    if (!profile) {
      logger.warn('Attempting to emit an event without an Optimization profile')

      return
    }

    logger.debug(`Queueing ${event.type} event for profile ${profile.id}`, event)

    const queueItem = this.#queue.get(profile.id)

    if (queueItem) {
      queueItem.events.push(event)
    } else {
      this.#queue.set(profile.id, { profile, events: [event] })
    }
  }

  // TODO: Flush the queue (max events)
  // TODO: The rest of the owl
}

export default AnalyticsStateful
