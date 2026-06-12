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

  it('uses top-level locale as the default SDK Experience API/event locale', () => {
    const node = new ContentfulOptimization({
      ...config,
      locale: ' de_DE ',
    })

    expect(node.locale).toBe('de-DE')
    expect(Reflect.get(node.api.experience, 'locale')).toBe('de-DE')
    expect(node.eventBuilder.buildPageView({}).context.locale).toBe('de-DE')
  })

  it('omits the Experience API locale when top-level locale is omitted', () => {
    const node = new ContentfulOptimization(config)

    expect(node.locale).toBeUndefined()
    expect(Reflect.get(node.api.experience, 'locale')).toBeUndefined()
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

  it('uses request locale for request-bound event defaults and Experience options', async () => {
    const node = new ContentfulOptimization(config)
    const upsertProfile = rs
      .spyOn(node.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)
    const requestOptimization = node.forRequest({
      consent: true,
      eventContext: { locale: 'en-US' },
      experienceOptions: { locale: 'fr-FR', preflight: true },
      locale: ' de_DE ',
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
              locale: 'de-DE',
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
