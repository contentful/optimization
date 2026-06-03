import type { CoreConfig } from '@contentful/optimization-core'
import ContentfulOptimization from './ContentfulOptimization'
import { OPTIMIZATION_NODE_SDK_NAME } from './constants'

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

describe('ContentfulOptimization', () => {
  it('gives itself a name', () => {
    const node = new ContentfulOptimization(config)

    expect(node.config.clientId).toEqual(CLIENT_ID)
    expect(node.eventBuilder.library.name).toEqual(OPTIMIZATION_NODE_SDK_NAME)
  })

  it('resolves request locale pairs from Accept-Language quality weights', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE', 'fr-FR'],
      },
    })

    expect(node.resolveRequestLocale('fr-CA;q=0.7, de-AT;q=0.9, es-ES;q=0.4')).toEqual({
      eventLocale: 'de-AT',
      contentfulLocale: 'de-DE',
    })
  })

  it('matches request locale candidates case-insensitively while preserving configured codes', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: {
        default: 'EN_us',
        supported: ['en-US', 'fr-FR', 'fr-CA'],
      },
    })

    expect(node.resolveRequestLocale('fr_FR;q=0.7, FR_ca;q=0.9')).toEqual({
      eventLocale: 'FR-ca',
      contentfulLocale: 'fr-CA',
    })
  })

  it('resolves request locales from request-like headers', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
    })

    expect(
      node.resolveRequestLocale({
        get(name) {
          return name === 'accept-language' ? 'es-ES, de-DE;q=0.8' : undefined
        },
      }),
    ).toEqual({
      eventLocale: 'es-ES',
      contentfulLocale: 'de-DE',
    })
  })

  it('resolves request locales from Express-style acceptsLanguages fallback', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'fr-CA'],
      },
    })

    expect(
      node.resolveRequestLocale({
        acceptsLanguages: () => ['fr_CA', 'en-US'],
      }),
    ).toEqual({
      eventLocale: 'fr-CA',
      contentfulLocale: 'fr-CA',
    })
  })

  it('ignores invalid request locale candidates before falling back', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
    })

    expect(node.resolveRequestLocale('*, UND;q=0.8, es-ES;q=0')).toEqual({
      eventLocale: 'en-US',
      contentfulLocale: 'en-US',
    })
  })

  it('returns the configured default Contentful locale from default-only config', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: {
        default: 'en-US',
      },
    })

    expect(node.resolveRequestLocale('de-AT')).toEqual({
      eventLocale: 'de-AT',
      contentfulLocale: 'en-US',
    })
  })

  it('omits the Contentful locale when no Contentful locale config is present', () => {
    const node = new ContentfulOptimization(config)

    expect(node.resolveRequestLocale('de-AT')).toEqual({
      eventLocale: 'de-AT',
    })
  })

  it('falls back when request locale candidates are missing', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
    })

    expect(node.resolveRequestLocale(undefined)).toEqual({
      eventLocale: 'en-US',
      contentfulLocale: 'en-US',
    })
  })

  it('forwards request options through direct stateless event methods', async () => {
    const node = new ContentfulOptimization(config)
    const upsertProfile = rs.spyOn(node.api.experience, 'upsertProfile').mockResolvedValue({
      changes: [],
      selectedOptimizations: [],
      profile: {
        id: 'profile-id',
        stableId: 'profile-id',
        random: 1,
        audiences: [],
        traits: {},
        location: {},
        session: {
          id: 'session-id',
          isReturningVisitor: false,
          landingPage: {
            path: '/',
            query: {},
            referrer: '',
            search: '',
            title: '',
            url: 'https://example.test/',
          },
          count: 1,
          activeSessionLength: 0,
          averageSessionLength: 0,
        },
      },
    })

    await node.page({ profile: { id: 'profile-id' } }, { locale: 'de-DE', preflight: true })

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-id',
        events: [expect.objectContaining({ type: 'page' })],
      }),
      expect.objectContaining({ locale: 'de-DE', preflight: true }),
    )
  })
})
