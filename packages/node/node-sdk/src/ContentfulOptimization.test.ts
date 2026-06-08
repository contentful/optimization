import type { CoreConfig } from '@contentful/optimization-core'
import ContentfulOptimization, { type OptimizationNodeConfig } from './ContentfulOptimization'
import { OPTIMIZATION_NODE_SDK_NAME } from './constants'

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

const OPTIMIZATION_DATA = {
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
}

describe('ContentfulOptimization', () => {
  it('gives itself a name', () => {
    const node = new ContentfulOptimization(config)

    expect(node.config.clientId).toEqual(CLIENT_ID)
    expect(node.eventBuilder.library.name).toEqual(OPTIMIZATION_NODE_SDK_NAME)
  })

  it('keeps constructor-level event consent out of normal Node config', () => {
    const nodeConfig: OptimizationNodeConfig = {
      clientId: CLIENT_ID,
      eventBuilder: {
        // @ts-expect-error Use forRequest() for request-scoped Node consent.
        getConsent: () => true,
      },
    }

    expect(nodeConfig.eventBuilder).toEqual(
      expect.objectContaining({ getConsent: expect.any(Function) }),
    )
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

  it('reads accept-language from a Headers-like object via headers.get', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: { default: 'en-US', supported: ['en-US', 'de-DE'] },
    })

    expect(
      node.resolveRequestLocale({
        headers: new Headers({ 'accept-language': 'de-DE;q=0.9, en-US;q=0.5' }),
      }),
    ).toEqual({
      eventLocale: 'de-DE',
      contentfulLocale: 'de-DE',
    })
  })

  it('reads accept-language from a plain headers object using the lowercase key', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: { default: 'en-US', supported: ['en-US', 'fr-FR'] },
    })

    expect(
      node.resolveRequestLocale({
        headers: { 'accept-language': 'fr-FR;q=0.9, en-US;q=0.5' },
      }),
    ).toEqual({
      eventLocale: 'fr-FR',
      contentfulLocale: 'fr-FR',
    })
  })

  it('reads accept-language from a plain headers object using the capitalized key', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: { default: 'en-US', supported: ['en-US', 'fr-FR'] },
    })

    expect(
      node.resolveRequestLocale({
        headers: { 'Accept-Language': 'fr-FR' },
      }),
    ).toEqual({
      eventLocale: 'fr-FR',
      contentfulLocale: 'fr-FR',
    })
  })

  it('joins array-valued accept-language headers and filters non-string entries', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: { default: 'en-US', supported: ['en-US', 'de-DE'] },
    })

    expect(
      node.resolveRequestLocale({
        headers: { 'accept-language': ['de-DE;q=0.9', 42, 'en-US;q=0.5'] },
      }),
    ).toEqual({
      eventLocale: 'de-DE',
      contentfulLocale: 'de-DE',
    })
  })

  it('falls back when input is neither a string nor an object', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: { default: 'en-US' },
    })

    expect(node.resolveRequestLocale(null)).toEqual({
      eventLocale: 'en-US',
      contentfulLocale: 'en-US',
    })
  })

  it('falls back when headers is not an object', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: { default: 'en-US' },
    })

    expect(node.resolveRequestLocale({ headers: 'not-an-object' })).toEqual({
      eventLocale: 'en-US',
      contentfulLocale: 'en-US',
    })
  })

  it('falls back when the resolved header is neither string nor array', () => {
    const node = new ContentfulOptimization({
      ...config,
      contentfulLocales: { default: 'en-US' },
    })

    expect(
      node.resolveRequestLocale({
        headers: { 'accept-language': 123 },
      }),
    ).toEqual({
      eventLocale: 'en-US',
      contentfulLocale: 'en-US',
    })
  })

  it('keeps unbound direct event methods unavailable from the public Node SDK', () => {
    const node = new ContentfulOptimization(config)
    // @ts-expect-error Use forRequest() before calling event methods.
    const directPage = node.page

    expect(directPage).toBeUndefined()
  })

  it('defaults request-bound Node pre-consent allowlist to identify and page', async () => {
    const node = new ContentfulOptimization(config)
    const upsertProfile = rs
      .spyOn(node.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)
    const sendBatchEvents = rs.spyOn(node.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const requestOptimization = node.forRequest({
      consent: false,
      profile: { id: 'profile-id' },
    })

    await requestOptimization.identify({ userId: 'user-123' })
    await requestOptimization.page()
    await requestOptimization.trackClick({ componentId: 'hero-banner' })

    expect(node.allowedEventTypes).toEqual(['identify', 'page'])
    expect(upsertProfile).toHaveBeenCalledTimes(2)
    expect(
      upsertProfile.mock.calls.map((call) => call[0].events[0]?.context.gdpr.isConsentGiven),
    ).toEqual([false, false])
    expect(sendBatchEvents).not.toHaveBeenCalled()
  })

  it('forwards request options through request-bound stateless event methods', async () => {
    const node = new ContentfulOptimization(config)
    const upsertProfile = rs
      .spyOn(node.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)
    const requestOptimization = node.forRequest({
      consent: true,
      experienceOptions: { locale: 'de-DE', preflight: true },
      profile: { id: 'profile-id' },
    })

    await requestOptimization.page()

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-id',
        events: [
          expect.objectContaining({
            context: expect.objectContaining({
              gdpr: expect.objectContaining({ isConsentGiven: true }),
            }),
            type: 'page',
          }),
        ],
      }),
      expect.objectContaining({ locale: 'de-DE', preflight: true }),
    )
  })

  it('uses request-bound event consent for Experience calls', async () => {
    const node = new ContentfulOptimization(config)
    const upsertProfile = rs
      .spyOn(node.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)

    await node
      .forRequest({ consent: true, profile: { id: 'profile-id' } })
      .page({ locale: 'en-US' })
    await node
      .forRequest({ consent: false, profile: { id: 'profile-id' } })
      .page({ locale: 'en-US' })

    expect(
      upsertProfile.mock.calls.map((call) => call[0].events[0]?.context.gdpr.isConsentGiven),
    ).toEqual([true, false])
  })

  it('applies request-bound event consent to Insights-only calls', async () => {
    const node = new ContentfulOptimization({
      ...config,
      allowedEventTypes: ['component_hover'],
    })
    const sendBatchEvents = rs.spyOn(node.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await node
      .forRequest({
        consent: true,
        profile: { id: 'profile-id' },
      })
      .trackClick({ componentId: 'hero-banner' })
    await node
      .forRequest({
        consent: false,
        profile: { id: 'profile-id' },
      })
      .trackHover({
        componentId: 'hero-banner',
        hoverDurationMs: 1000,
        hoverId: 'hover-id',
      })

    expect(
      sendBatchEvents.mock.calls.map(([[batch]]) => batch?.events[0]?.context.gdpr.isConsentGiven),
    ).toEqual([true, false])
  })

  it('can override the Node pre-consent allowlist', async () => {
    const node = new ContentfulOptimization({ ...config, allowedEventTypes: [] })
    const upsertProfile = rs
      .spyOn(node.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)
    const requestOptimization = node.forRequest({
      consent: false,
      profile: { id: 'profile-id' },
    })

    await requestOptimization.page()

    expect(node.allowedEventTypes).toEqual([])
    expect(upsertProfile).not.toHaveBeenCalled()
  })

  it('ignores runtime eventBuilder getConsent overrides', async () => {
    const eventBuilder: NonNullable<OptimizationNodeConfig['eventBuilder']> = {}

    Reflect.set(eventBuilder, 'getConsent', () => false)

    const node = new ContentfulOptimization({
      ...config,
      eventBuilder,
    })
    const upsertProfile = rs
      .spyOn(node.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)

    await node.forRequest({ consent: true, profile: { id: 'profile-id' } }).page()

    expect(upsertProfile.mock.calls[0]?.[0].events[0]?.context.gdpr.isConsentGiven).toBe(true)
  })
})
