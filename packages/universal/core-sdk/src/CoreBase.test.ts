import type { ApiClientConfig } from '@contentful/optimization-api-client'
import { EXPERIENCE_BASE_URL } from '@contentful/optimization-api-client'
import type { ChangeArray } from './api-schemas'
import { OPTIMIZATION_CORE_SDK_NAME } from './constants'
import CoreBase, { type CoreConfig } from './CoreBase'
import { FlagsResolver } from './resolvers'

class TestCore extends CoreBase {
  constructor(
    config: CoreConfig,
    api: Pick<ApiClientConfig, 'experience' | 'insights'> = {},
    locale?: string,
  ) {
    super(config, api, locale)
  }

  setLocale(locale: string | undefined): void {
    this.setResolvedLocale(locale)
  }
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

  it('keeps Insights API and Experience API client config isolated', () => {
    const core = new TestCore(
      {
        clientId: CLIENT_ID,
      },
      {
        insights: {
          baseUrl: 'https://ingest.example.test/',
        },
        experience: {
          baseUrl: 'https://experience.example.test/',
        },
      },
    )

    expect(Reflect.get(core.api.insights, 'baseUrl')).toBe('https://ingest.example.test/')
    expect(Reflect.get(core.api.experience, 'baseUrl')).toBe('https://experience.example.test/')
  })

  it('falls back to default base URLs when only one side is configured', () => {
    const core = new TestCore(
      {
        clientId: CLIENT_ID,
      },
      {
        insights: { baseUrl: 'https://ingest.example.test/' },
      },
    )

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

  it('exposes flagsResolver for advanced custom-flag resolution use cases', () => {
    const core = new TestCore(config)

    expect(core.flagsResolver).toBe(FlagsResolver)
  })

  it('resolves custom flags by key without auto-tracking in non-stateful environments', () => {
    const core = new TestCore(config)

    expect(core.getFlag('dark-mode', CHANGES)).toBe(true)
    expect(core.getFlag('price', CHANGES)).toEqual({
      amount: 10,
      currency: 'USD',
    })
  })

  it('wraps Contentful getEntry and getEntries calls with the resolved locale', async () => {
    const core = new TestCore(config, {}, 'de-DE')
    const contentfulClient = {
      getEntry: rs.fn(
        async (_entryId: string, query?: Record<string, unknown>) => await Promise.resolve(query),
      ),
      getEntries: rs.fn(async (query?: Record<string, unknown>) => await Promise.resolve(query)),
    }

    const wrappedClient = core.withOptimizationLocale(contentfulClient)

    await wrappedClient.getEntry('entry-id', { include: 10 })
    await wrappedClient.getEntries({ content_type: 'page' })

    expect(contentfulClient.getEntry).toHaveBeenCalledWith('entry-id', {
      include: 10,
      locale: 'de-DE',
    })
    expect(contentfulClient.getEntries).toHaveBeenCalledWith({
      content_type: 'page',
      locale: 'de-DE',
    })
  })

  it('does not inject a Contentful query locale when no SDK locale is resolved', async () => {
    const core = new TestCore(config)
    const contentfulClient = {
      getEntry: rs.fn(
        async (_entryId: string, query?: Record<string, unknown>) => await Promise.resolve(query),
      ),
      getEntries: rs.fn(async (query?: Record<string, unknown>) => await Promise.resolve(query)),
    }

    const wrappedClient = core.withOptimizationLocale(contentfulClient)

    await wrappedClient.getEntry('entry-id', { include: 10 })
    await wrappedClient.getEntries({ content_type: 'page' })

    expect(contentfulClient.getEntry).toHaveBeenCalledWith('entry-id', { include: 10 })
    expect(contentfulClient.getEntries).toHaveBeenCalledWith({ content_type: 'page' })
  })

  it('does not override explicit Contentful query locales and normalizes them', async () => {
    const core = new TestCore(config, {}, 'de-DE')
    const contentfulClient = {
      getEntry: rs.fn(
        async (_entryId: string, query?: Record<string, unknown>) => await Promise.resolve(query),
      ),
      getEntries: rs.fn(async (query?: Record<string, unknown>) => await Promise.resolve(query)),
    }

    const wrappedClient = core.withOptimizationLocale(contentfulClient)

    await wrappedClient.getEntry('entry-id', { include: 10, locale: ' fr_FR ' })

    expect(contentfulClient.getEntry).toHaveBeenCalledWith('entry-id', {
      include: 10,
      locale: 'fr-FR',
    })
  })

  it('rejects invalid explicit Contentful query locales', () => {
    const core = new TestCore(config, {}, 'de-DE')
    const contentfulClient = {
      getEntries: rs.fn((query?: Record<string, unknown>) => query),
    }

    const wrappedClient = core.withOptimizationLocale(contentfulClient)

    expect(() => wrappedClient.getEntries({ locale: '*' })).toThrow(/query.locale/)
    expect(contentfulClient.getEntries).not.toHaveBeenCalled()
  })

  it('uses the live locale when wrapping Contentful clients', async () => {
    const core = new TestCore(config, {}, 'en-US')
    const contentfulClient = {
      getEntries: rs.fn(async (query?: Record<string, unknown>) => await Promise.resolve(query)),
    }
    const wrappedClient = core.withOptimizationLocale(contentfulClient)

    core.setLocale('de-DE')
    await wrappedClient.getEntries({ content_type: 'page' })

    expect(contentfulClient.getEntries).toHaveBeenCalledWith({
      content_type: 'page',
      locale: 'de-DE',
    })
  })
})
