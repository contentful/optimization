import { effect } from '@preact/signals-core'
import { logger } from '../lib/logger'
import type { Signals } from '../CoreStateful'
import FlagsBase from './FlagsBase'

class FlagsStateful extends FlagsBase {
  readonly #flags: Signals['flags']

  constructor(signals: Signals) {
    super()

    const { flags } = signals

    this.#flags = flags

    effect(() => {
      logger.info(
        `Flags: ${this.#flags.value?.length ? Object.keys(this.#flags.value).join(', ') : 'none'}`,
      )
    })
  }
}

export default FlagsStateful
