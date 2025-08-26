import { effect } from '@preact/signals-core'
import { logger } from '../lib/logger'
import type ApiClient from '../lib/api-client'
import type { ProfileType } from '../lib/api-client/experience/dto/profile'
import type { EventType } from '../lib/api-client/insights/dto'
import type { Signals } from '../CoreBase'

abstract class AnalyticsBase {
  protected readonly api: ApiClient
  protected readonly profile: Signals['profile']

  constructor(signals: Signals, api: ApiClient) {
    this.api = api

    const { profile } = signals

    this.profile = profile

    effect(() => {
      logger.info(`Profile has been ${this.profile.value ? 'set' : 'cleared'}`)
    })
  }

  abstract track(event: EventType, profile: ProfileType): Promise<void> | void
}

export default AnalyticsBase
