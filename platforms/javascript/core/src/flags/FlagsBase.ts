import { effect } from '@preact/signals-core'
import { logger } from '../lib/logger'
import type { Signals } from '../CoreBase'

abstract class FlagsBase {
  protected readonly flags: Signals['flags']
  protected current: Record<string, string> | undefined

  constructor(signals: Signals) {
    const { flags } = signals

    this.flags = flags

    effect(() => {
      logger.info(
        `Flags: ${this.flags.value?.length ? Object.keys(this.flags.value).join(', ') : 'none'}`,
      )
    })
  }

  get(key: string): string | undefined {
    return this.current?.[key]
  }

  set(key: string, value: string): void {
    this.current ? (this.current[key] = value) : (this.current = { [key]: value })
  }
}

export default FlagsBase
