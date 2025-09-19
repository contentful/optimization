import type { ApiConfig, GlobalApiConfigProperties } from './ApiClientBase'
import ExperienceApiClient, { type ExperienceApiClientConfig } from './experience'
import InsightsApiClient, { type InsightsApiClientConfig } from './insights'

export interface ApiClientConfig extends Pick<ApiConfig, GlobalApiConfigProperties> {
  personalization?: Omit<ExperienceApiClientConfig, GlobalApiConfigProperties>
  analytics?: Omit<InsightsApiClientConfig, GlobalApiConfigProperties>
}

export default class ApiClient {
  readonly experience: ExperienceApiClient
  readonly insights: InsightsApiClient

  constructor(config: ApiClientConfig) {
    const { personalization, analytics, ...apiConfig } = config

    this.experience = new ExperienceApiClient({
      ...apiConfig,
      ...personalization,
    })

    this.insights = new InsightsApiClient({
      ...apiConfig,
      ...analytics,
    })
  }
}
