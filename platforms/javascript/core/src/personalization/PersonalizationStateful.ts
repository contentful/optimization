import { effect, type Signal } from '@preact/signals-core'
import { GuardBy } from '../lib/decorators'
import { logger } from '../lib/logger'
import type ApiClient from '../lib/api-client'
import type { EventType } from '../lib/api-client/experience/dto/event'
import type { Signals } from '../CoreBase'
import { consent } from '../CoreStateful'
import PersonalizationBase from './PersonalizationBase'

type EventQueue = Set<EventType>

@GuardBy('hasNoConsent', {
  onBlock: ({ method }) => {
    logger.info(`Call to AnalyticsStateful.${String(method)} blocked due to lack of consent`)
  },
})
class PersonalizationStateful extends PersonalizationBase {
  readonly #consent: Signal<boolean | undefined>
  readonly #queue: EventQueue = new Set()

  constructor(signals: Signals, api: ApiClient) {
    super(signals, api)

    this.#consent = consent

    effect(() => {
      logger.info(
        `Personalization ${this.#consent.value ? 'will' : 'will not'} take effect due to consent (${this.#consent.value})`,
      )
    })
  }

  // @ts-expect-error -- value is read by the decorator
  private hasNoConsent(): boolean {
    return !this.#consent.value
  }

  page(event: EventType): void {
    // TODO: Logic
    this.#queue.add(event)
  }

  // TODO: Flush the queue (max events)
  // TODO: Update signal values
  // TODO: The rest of the owl
}

export default PersonalizationStateful
