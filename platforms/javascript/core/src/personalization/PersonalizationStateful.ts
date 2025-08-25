import { effect } from '@preact/signals-core'
import { GuardBy } from '../lib/decorators'
import { logger } from '../lib/logger'
import type ApiClient from '../lib/api-client'
import type { Signals } from '../CoreStateful'
import type { EventType } from '../lib/api-client/insights/dto'
import PersonalizationBase from './PersonalizationBase'

type EventQueue = Set<EventType>

@GuardBy('hasNotConsented', {
  onBlock: ({ method }) => {
    logger.info(`Call to AnalyticsStateful.${String(method)} blocked due to lack of consent`)
  },
})
class PersonalizationStateful extends PersonalizationBase {
  readonly #audiences: Signals['audiences']
  readonly #consent: Signals['consent']
  readonly #experiments: Signals['experiments']
  readonly #flags: Signals['flags']
  readonly #personalizations: Signals['personalizations']
  readonly #profile: Signals['profile']
  readonly #queue: EventQueue = new Set()

  constructor(signals: Signals, api: ApiClient) {
    super(api)

    const { audiences, consent, experiments, flags, personalizations, profile } = signals

    this.#audiences = audiences
    this.#consent = consent
    this.#experiments = experiments
    this.#flags = flags
    this.#personalizations = personalizations
    this.#profile = profile

    effect(() => {
      logger.info(`Audiences have been ${this.#audiences.value?.length ? 'populated' : 'cleared'}`)
    })

    effect(() => {
      logger.info(
        `Personalization ${this.#consent.value ? 'will' : 'will not'} take effect due to consent (${this.#consent.value})`,
      )
    })

    effect(() => {
      logger.info(
        `Experiments have been ${this.#experiments.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(`Flags have been ${this.#flags.value?.length ? 'populated' : 'cleared'}`)
    })

    effect(() => {
      logger.info(
        `Personalizations have been ${this.#personalizations.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(`Profile has been ${this.#profile.value ? 'set' : 'cleared'}`)
    })
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
