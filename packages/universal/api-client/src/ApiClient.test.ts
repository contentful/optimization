import { ApiClient, type ApiClientConfig } from './'
import ExperienceApiClient, { EXPERIENCE_BASE_URL } from './experience'
import InsightsApiClient from './insights'

describe('ApiClient', () => {
  const config: ApiClientConfig = { clientId: 'testId', fetchOptions: {} }

  it('assigns an ExperienceApiClient instance to .experience', () => {
    const client = new ApiClient(config)
    expect(client.experience).toBeInstanceOf(ExperienceApiClient)
  })

  it('assigns an InsightsApiClient instance to .insights', () => {
    const client = new ApiClient(config)
    expect(client.insights).toBeInstanceOf(InsightsApiClient)
  })

  it('isolates per-client baseUrl overrides', () => {
    const client = new ApiClient({
      clientId: 'testId',
      analytics: { baseUrl: 'https://ingest.example.test/' },
      personalization: { baseUrl: 'https://experience.example.test/' },
    })

    expect(Reflect.get(client.insights, 'baseUrl')).toBe('https://ingest.example.test/')
    expect(Reflect.get(client.experience, 'baseUrl')).toBe('https://experience.example.test/')
  })

  it('ignores unsupported top-level baseUrl if present at runtime', () => {
    const runtimeConfig: ApiClientConfig & { baseUrl: string } = {
      clientId: 'testId',
      analytics: { baseUrl: 'https://ingest.example.test/' },
      baseUrl: 'https://invalid-top-level.example.test/',
    }
    const client = new ApiClient(runtimeConfig)

    expect(Reflect.get(client.insights, 'baseUrl')).toBe('https://ingest.example.test/')
    expect(Reflect.get(client.experience, 'baseUrl')).toBe(EXPERIENCE_BASE_URL)
  })
})
