import { effect } from '@preact/signals-core'
import { logger } from '../lib/logger'
import type ApiClient from '../lib/api-client'
import type { EventType } from '../lib/api-client/experience/dto/event'
import type { Signals } from '../CoreBase'
import PersonalizationBase from './PersonalizationBase'

class PersonalizationStateless extends PersonalizationBase {
  constructor(signals: Signals, api: ApiClient) {
    super(signals, api)

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

  async page(event: EventType): Promise<void> {
    logger.debug(`Processing page event`, event)

    await this.api.experience.upsertProfile({
      profileId: this.profile.value?.id,
      events: [event],
    })
  }

  // TODO: Update signal values
  // TODO: The rest of the owl
}

export default PersonalizationStateless
