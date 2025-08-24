import { effect } from '@preact/signals-core'
import { logger } from '../lib/logger'
import type { Signals } from '../CoreStateful'
import AudienceBase from './AudienceBase'

class AudienceStateful extends AudienceBase {
  private readonly audiences: Signals['audiences']

  constructor(signals: Signals) {
    super()

    const { audiences } = signals

    this.audiences = audiences

    effect(() => {
      logger.info(
        `Audiences: ${this.audiences.value?.length ? this.audiences.value.join(', ') : 'none'}`,
      )
    })
  }
}

export default AudienceStateful
