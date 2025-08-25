import { effect } from '@preact/signals-core'
import { logger } from '../lib/logger'
import type { Signals } from '../CoreStateful'
import ExperimentsBase from './ExperimentsBase'

class ExperimentsStateful extends ExperimentsBase {
  readonly #experiments: Signals['experiments']

  constructor(signals: Signals) {
    super()

    const { experiments } = signals

    this.#experiments = experiments

    effect(() => {
      logger.info(`User experiments count: ${this.#experiments.value?.length}`)
    })
  }
}

export default ExperimentsStateful
