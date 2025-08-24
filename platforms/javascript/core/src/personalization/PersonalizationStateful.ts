import { effect } from '@preact/signals-core'
import { Guard } from '../lib/decorators'
import { logger } from '../lib/logger'
import type ApiClient from '../lib/api-client'
import type { Signals } from '../CoreStateful'
import type { EventType } from '../lib/api-client/insights/dto'
import PersonalizationBase from './PersonalizationBase'

type EventQueue = Set<EventType>

@Guard('hasNotConsented', {
  onBlock: ({ method }) => {
    logger.info(`Call to AnalyticsStateful.${String(method)} blocked due to lack of consent`)
  },
})
class PersonalizationStateful extends PersonalizationBase {
  private readonly audiences: Signals['audiences']
  private readonly consent: Signals['consent']
  private readonly experiments: Signals['experiments']
  private readonly flags: Signals['flags']
  private readonly personalizations: Signals['personalizations']
  private readonly profile: Signals['profile']
  private readonly queue: EventQueue = new Set()

  constructor(signals: Signals, api: ApiClient) {
    super(api)

    const { audiences, consent, experiments, flags, personalizations, profile } = signals

    this.audiences = audiences
    this.consent = consent
    this.experiments = experiments
    this.flags = flags
    this.personalizations = personalizations
    this.profile = profile

    effect(() => {
      logger.info(`Audiences have been ${this.audiences.value?.length ? 'populated' : 'cleared'}`)
    })

    effect(() => {
      logger.info(
        `Personalization ${this.consent.value ? 'will' : 'will not'} take effect due to consent (${this.consent.value})`,
      )
    })

    effect(() => {
      logger.info(
        `Experiments have been ${this.experiments.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(`Flags have been ${this.flags.value?.length ? 'populated' : 'cleared'}`)
    })

    effect(() => {
      logger.info(
        `Personalizations have been ${this.personalizations.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(`Profile has been ${this.profile.value ? 'set' : 'cleared'}`)
    })
  }

  page(event: EventType): void {
    // TODO: Logic
    this.queue.add(event)
  }

  // TODO: Flush the queue (max events)
  // TODO: Update signal values
  // TODO: The rest of the owl
}

export default PersonalizationStateful
