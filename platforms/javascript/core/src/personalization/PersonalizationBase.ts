import { effect } from '@preact/signals-core'
import { logger } from '../lib/logger'
import type ApiClient from '../lib/api-client'
import type { Signals } from '../CoreBase'

abstract class PersonalizationBase {
  protected readonly api: ApiClient
  protected readonly audiences: Signals['audiences']
  protected readonly experiments: Signals['experiments']
  protected readonly flags: Signals['flags']
  protected readonly personalizations: Signals['personalizations']
  protected readonly profile: Signals['profile']

  constructor(signals: Signals, api: ApiClient) {
    this.api = api

    const { audiences, experiments, flags, personalizations, profile } = signals

    this.audiences = audiences
    this.experiments = experiments
    this.flags = flags
    this.personalizations = personalizations
    this.profile = profile

    effect(() => {
      logger.info(`Audiences have been ${this.audiences.value?.length ? 'populated' : 'cleared'}`)
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

  abstract page(payload: object): Promise<void> | void
}

export default PersonalizationBase
