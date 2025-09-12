import type { ApiConfig } from './ApiClientBase'
import ExperienceApiClient, { type ExperienceApiClientConfig } from './experience'
import InsightsApiClient, { type InsightsApiClientConfig } from './insights'

export type { ApiConfig }

export interface ApiClientConfig extends ApiConfig {
  personalization?: Omit<
    ExperienceApiClientConfig,
    'clientId' | 'environment' | 'fetchOptions' | 'preview' | 'baseUrl'
  >
  analytics?: Omit<
    InsightsApiClientConfig,
    'clientId' | 'environment' | 'fetchOptions' | 'preview' | 'baseUrl'
  >
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
