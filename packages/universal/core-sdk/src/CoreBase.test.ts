import { EXPERIENCE_BASE_URL } from '@contentful/optimization-api-client'
import type { ChangeArray } from '@contentful/optimization-api-client/api-schemas'
import { AnalyticsStateless } from './analytics'
import { OPTIMIZATION_CORE_SDK_NAME } from './constants'
import CoreBase, { type CoreConfig } from './CoreBase'
import { PersonalizationStateless } from './personalization'

class TestCore extends CoreBase {
  _analytics = new AnalyticsStateless({
    api: this.api,
    eventBuilder: this.eventBuilder,
    interceptors: this.interceptors,
  })
  _personalization = new PersonalizationStateless({
    api: this.api,
    eventBuilder: this.eventBuilder,
    interceptors: this.interceptors,
  })
}

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

const CHANGES: ChangeArray = [
  {
    key: 'dark-mode',
    type: 'Variable',
    value: true,
    meta: {
      experienceId: 'experience-id',
      variantIndex: 0,
    },
  },
  {
    key: 'price',
    type: 'Variable',
    value: {
      value: {
        amount: 10,
        currency: 'USD',
      },
    },
    meta: {
      experienceId: 'experience-id',
      variantIndex: 1,
    },
  },
]

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

  it('resolves all custom flags from changes', () => {
    const core = new TestCore(config)

    expect(core.getCustomFlags(CHANGES)).toEqual({
      'dark-mode': true,
      price: {
        amount: 10,
        currency: 'USD',
      },
    })
  })
})
