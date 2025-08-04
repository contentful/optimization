import type { ApiConfig } from './ApiClientBase'
import ExperienceApiClient from './experience'
import InsightsApiClient from './insights'

export type { ApiConfig }

export interface ApiClientConfig {
  experience?: Omit<ApiConfig, 'fetchOptions'>
  insights?: Omit<ApiConfig, 'fetchOptions'>
  fetchOptions?: ApiConfig['fetchOptions']
}

export default class ApiClient {
  readonly experience: ExperienceApiClient
  readonly insights: InsightsApiClient

  constructor(config?: ApiClientConfig) {
    this.experience = new ExperienceApiClient({
      fetchOptions: config?.fetchOptions,
      ...(config?.experience ?? {}),
    })
    this.insights = new InsightsApiClient({
      fetchOptions: config?.fetchOptions,
      ...(config?.insights ?? {}),
    })
  }
}
