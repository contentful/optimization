import { EXPERIENCE_BASE_URL } from '@contentful/optimization-api-client'
import { AnalyticsStateless } from './analytics'
import { OPTIMIZATION_CORE_SDK_NAME } from './constants'
import CoreBase, { type CoreConfig } from './CoreBase'
import { PersonalizationStateless } from './personalization'

class TestCore extends CoreBase {
  analytics = new AnalyticsStateless({
    api: this.api,
    builder: this.eventBuilder,
    interceptors: this.interceptors,
  })
  personalization = new PersonalizationStateless({
    api: this.api,
    builder: this.eventBuilder,
    interceptors: this.interceptors,
  })
}

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

describe('CoreBase', () => {
  it('allows access to the original configuration options', () => {
    const core = new TestCore(config)

    expect(core.config).toEqual(config)
    expect(core.eventBuilder.library.name).toEqual(OPTIMIZATION_CORE_SDK_NAME)
  })

  it('keeps analytics and personalization client config isolated', () => {
    const core = new TestCore({
      clientId: CLIENT_ID,
      analytics: { baseUrl: 'https://ingest.example.test/' },
      personalization: { baseUrl: 'https://experience.example.test/' },
    })

    expect(Reflect.get(core.api.insights, 'baseUrl')).toBe('https://ingest.example.test/')
    expect(Reflect.get(core.api.experience, 'baseUrl')).toBe('https://experience.example.test/')
  })

  it('falls back to default base URLs when only one side is configured', () => {
    const core = new TestCore({
      clientId: CLIENT_ID,
      analytics: { baseUrl: 'https://ingest.example.test/' },
    })

    expect(Reflect.get(core.api.insights, 'baseUrl')).toBe('https://ingest.example.test/')
    expect(Reflect.get(core.api.experience, 'baseUrl')).toBe(EXPERIENCE_BASE_URL)
  })

  it('forwards top-level fetch options to the shared api config', () => {
    const fetchOptions = { requestTimeout: 9_000 }
    const core = new TestCore({
      clientId: CLIENT_ID,
      fetchOptions,
    })

    expect(core.api.config.fetchOptions).toEqual(fetchOptions)
  })
})
