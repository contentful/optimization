import type ApiClient from '../lib/api-client'
import type { ProfileType } from '../lib/api-client/experience/dto/profile'
import type { EventType } from '../lib/api-client/insights/dto'

abstract class AnalyticsBase {
  protected readonly api: ApiClient

  constructor(api: ApiClient) {
    this.api = api
  }

  abstract track(event: EventType, profile: ProfileType): Promise<void> | void
}

export default AnalyticsBase
