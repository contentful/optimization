import ApiClient, { type ApiConfig } from './'
import ExperienceApiClient from './experience'
import InsightsApiClient from './insights'

describe('ApiClient', () => {
  const config: ApiConfig = { optimizationKey: 'testId', fetchOptions: {} }

  it('assigns an ExperienceApiClient instance to .experience', () => {
    const client = new ApiClient(config)
    expect(client.experience).toBeInstanceOf(ExperienceApiClient)
  })

  it('assigns an InsightsApiClient instance to .insights', () => {
    const client = new ApiClient(config)
    expect(client.insights).toBeInstanceOf(InsightsApiClient)
  })
})
