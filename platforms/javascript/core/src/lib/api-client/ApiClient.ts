import type { ApiConfig } from './ApiClientBase'
import ExperienceApiClient, { type ExperienceApiClientConfig } from './experience'
import InsightsApiClient, { type InsightsApiClientConfig } from './insights'

export type { ApiConfig }

export interface ApiClientConfig extends ApiConfig {
  experience?: Omit<
    ExperienceApiClientConfig,
    'clientId' | 'environment' | 'fetchOptions' | 'preview' | 'baseUrl'
  >
  insights?: Omit<
    InsightsApiClientConfig,
    'clientId' | 'environment' | 'fetchOptions' | 'preview' | 'baseUrl'
  >
}

export default class ApiClient {
  readonly experience: ExperienceApiClient
  readonly insights: InsightsApiClient

  constructor(config: ApiClientConfig) {
    const { experience, insights, ...apiConfig } = config

    this.experience = new ExperienceApiClient({
      ...apiConfig,
      ...experience,
    })

    this.insights = new InsightsApiClient({
      ...apiConfig,
      ...insights,
    })
  }
}
