import type { OptimizationData } from './api-schemas'
import type { BlockedEvent } from './BlockedEvent'
import CoreStateless from './CoreStateless'

const TRACK_CLICK_PROFILE_ERROR =
  'CoreStatelessRequest.trackClick() requires a request-bound profile id for Insights delivery.'
const TRACK_HOVER_PROFILE_ERROR =
  'CoreStatelessRequest.trackHover() requires a request-bound profile id for Insights delivery.'
const TRACK_FLAG_VIEW_PROFILE_ERROR =
  'CoreStatelessRequest.trackFlagView() requires a request-bound profile id for Insights delivery.'
const NON_STICKY_TRACK_VIEW_PROFILE_ERROR =
  'CoreStatelessRequest.trackView() requires a request-bound profile id when `payload.sticky` is not `true`.'

const EMPTY_OPTIMIZATION_DATA: OptimizationData = {
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

async function invokeUntypedMethod(
  requestOptimization: ReturnType<CoreStateless['forRequest']>,
  method: 'trackClick' | 'trackHover' | 'trackFlagView' | 'trackView',
  payload: Record<string, unknown>,
): Promise<unknown> {
  const methodRef = Reflect.get(requestOptimization, method)

  if (typeof methodRef !== 'function') {
    throw new Error(`Expected "${method}" to be a function`)
  }

  return await Reflect.apply(methodRef, requestOptimization, [payload])
}

describe('CoreStateless', () => {
  it('strips stateful-only api config from stateless construction', () => {
    const beaconHandler = rs.fn(() => true)
    const core: unknown = Reflect.construct(CoreStateless, [
      {
        clientId: 'key_123',
        environment: 'main',
        api: {
          beaconHandler,
          insightsBaseUrl: 'https://ingest.example.test/',
          ip: '198.51.100.5',
          locale: 'de-DE',
          plainText: false,
          preflight: true,
        },
      },
    ])

    if (!(core instanceof CoreStateless)) {
      throw new Error('Failed to construct CoreStateless')
    }

    expect(Reflect.get(core.api.insights, 'beaconHandler')).toBeUndefined()
    expect(Reflect.get(core.api.experience, 'ip')).toBeUndefined()
    expect(Reflect.get(core.api.experience, 'locale')).toBeUndefined()
    expect(Reflect.get(core.api.experience, 'plainText')).toBeUndefined()
    expect(Reflect.get(core.api.experience, 'preflight')).toBeUndefined()
  })

  it('exposes the configured top-level SDK locale', () => {
    const core = new CoreStateless({
      clientId: 'key_123',
      environment: 'main',
      locale: ' de_DE ',
    })

    expect(core.locale).toBe('de-DE')
    expect(Reflect.get(core.api.experience, 'locale')).toBe('de-DE')
  })

  it('omits the default Experience API locale when no SDK locale is configured', () => {
    const core = new CoreStateless({
      clientId: 'key_123',
      environment: 'main',
    })

    expect(core.locale).toBeUndefined()
    expect(Reflect.get(core.api.experience, 'locale')).toBeUndefined()
  })

  it('binds consent, profile, event context, and Experience request options with forRequest()', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const requestOptions = {
      ip: '203.0.113.10',
      locale: 'de-DE',
      plainText: false,
      preflight: true,
    }
    const requestOptimization = core.forRequest({
      consent: { events: true, persistence: true },
      eventContext: {
        locale: 'en-US',
        page: {
          path: '/products',
          query: {},
          referrer: '',
          search: '',
          title: 'Products',
          url: 'https://example.test/products',
        },
        userAgent: 'unit-test',
      },
      experienceOptions: requestOptions,
      profile: { id: 'profile-123' },
    })

    await requestOptimization.identify({ userId: 'user-123' })

    expect(requestOptimization.canPersistProfile).toBe(true)
    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-123',
        events: [
          expect.objectContaining({
            context: expect.objectContaining({
              gdpr: expect.objectContaining({ isConsentGiven: true }),
              locale: 'en-US',
              page: expect.objectContaining({ path: '/products' }),
              userAgent: 'unit-test',
            }),
            type: 'identify',
          }),
        ],
      }),
      requestOptions,
    )
  })

  it('keeps request event locale and advanced Experience request locale separate', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const requestOptimization = core.forRequest({
      consent: true,
      eventContext: { locale: 'en-US' },
      experienceOptions: { locale: 'de-DE' },
      profile: { id: 'profile-123' },
    })

    await requestOptimization.page()

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-123',
        events: [
          expect.objectContaining({ context: expect.objectContaining({ locale: 'en-US' }) }),
        ],
      }),
      expect.objectContaining({ locale: 'de-DE' }),
    )
  })

  it('uses request locale for event defaults and Experience options when both locale paths are provided', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const requestOptimization = core.forRequest({
      consent: true,
      eventContext: { locale: 'en-US' },
      experienceOptions: { locale: 'fr-FR', preflight: true },
      locale: ' de_DE ',
      profile: { id: 'profile-123' },
    })

    await requestOptimization.page()

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-123',
        events: [
          expect.objectContaining({ context: expect.objectContaining({ locale: 'de-DE' }) }),
        ],
      }),
      expect.objectContaining({ locale: 'de-DE', preflight: true }),
    )
  })

  it('defaults allowedEventTypes to empty for stateless core requests', async () => {
    const blockedEvents: BlockedEvent[] = []
    const core = new CoreStateless({
      clientId: 'key_123',
      environment: 'main',
      onEventBlocked: (event) => blockedEvents.push(event),
    })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const requestOptimization = core.forRequest({
      consent: { events: false },
      profile: { id: 'profile-123' },
    })

    await requestOptimization.identify({ userId: 'user-123' })
    await requestOptimization.page()
    await requestOptimization.screen({ name: 'Home', properties: {} })

    expect(core.allowedEventTypes).toEqual([])
    expect(upsertProfile).not.toHaveBeenCalled()
    expect(blockedEvents.map((event) => event.method)).toEqual(['identify', 'page', 'screen'])
  })

  it('blocks non-allowlisted events before consent and reports diagnostics', async () => {
    const blockedEvents: BlockedEvent[] = []
    const core = new CoreStateless({
      clientId: 'key_123',
      environment: 'main',
      onEventBlocked: (event) => blockedEvents.push(event),
    })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const requestOptimization = core.forRequest({
      consent: false,
      profile: { id: 'profile-123' },
    })

    await expect(requestOptimization.track({ event: 'conversion' })).resolves.toBeUndefined()

    expect(upsertProfile).not.toHaveBeenCalled()
    expect(blockedEvents).toEqual([
      {
        args: [{ event: 'conversion' }],
        method: 'track',
        reason: 'consent',
      },
    ])
  })

  it('blocks all events before consent when allowedEventTypes is empty', async () => {
    const blockedEvents: BlockedEvent[] = []
    const core = new CoreStateless({
      allowedEventTypes: [],
      clientId: 'key_123',
      environment: 'main',
      onEventBlocked: (event) => blockedEvents.push(event),
    })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const requestOptimization = core.forRequest({
      consent: false,
      profile: { id: 'profile-123' },
    })

    await expect(requestOptimization.page()).resolves.toBeUndefined()

    expect(upsertProfile).not.toHaveBeenCalled()
    expect(blockedEvents).toHaveLength(1)
    expect(blockedEvents[0]?.method).toBe('page')
  })

  it('allows consumers to widen pre-consent stateless event types', async () => {
    const core = new CoreStateless({
      allowedEventTypes: ['track'],
      clientId: 'key_123',
      environment: 'main',
    })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const requestOptimization = core.forRequest({
      consent: false,
      profile: { id: 'profile-123' },
    })

    await requestOptimization.track({ event: 'server-preflight' })

    expect(upsertProfile.mock.calls[0]?.[0].events[0]?.context.gdpr.isConsentGiven).toBe(false)
  })

  it('updates the request-bound profile across sequential Experience calls', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const firstProfile = { ...EMPTY_OPTIMIZATION_DATA.profile, id: 'first-profile' }
    const secondProfile = { ...EMPTY_OPTIMIZATION_DATA.profile, id: 'second-profile' }
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValueOnce({ ...EMPTY_OPTIMIZATION_DATA, profile: firstProfile })
      .mockResolvedValueOnce({ ...EMPTY_OPTIMIZATION_DATA, profile: secondProfile })
    const requestOptimization = core.forRequest({
      consent: true,
      profile: { id: 'initial-profile' },
    })

    await requestOptimization.page()
    await requestOptimization.identify({ userId: 'user-123' })

    expect(upsertProfile.mock.calls.map(([body]) => body.profileId)).toEqual([
      'initial-profile',
      'first-profile',
    ])
    expect(requestOptimization.profile).toEqual(secondProfile)
  })

  it('sends sticky entry views through both the Experience API and Insights API', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const requestOptimization = core.forRequest({
      consent: true,
      experienceOptions: { preflight: true },
      profile: { id: 'profile-123' },
    })

    await requestOptimization.trackView({
      componentId: 'hero-banner',
      sticky: true,
      viewDurationMs: 1000,
      viewId: 'hero-banner-view',
    })

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-123',
        events: [expect.objectContaining({ type: 'component' })],
      }),
      expect.objectContaining({ preflight: true }),
    )
    expect(sendBatchEvents).toHaveBeenCalledWith([
      {
        profile: EMPTY_OPTIMIZATION_DATA.profile,
        events: [
          expect.objectContaining({
            context: expect.objectContaining({
              gdpr: expect.objectContaining({ isConsentGiven: true }),
            }),
            type: 'component',
          }),
        ],
      },
    ])
  })

  it('blocks Insights-only events before consent', async () => {
    const blockedEvents: BlockedEvent[] = []
    const core = new CoreStateless({
      clientId: 'key_123',
      environment: 'main',
      onEventBlocked: (event) => blockedEvents.push(event),
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const requestOptimization = core.forRequest({
      consent: false,
      profile: { id: 'profile-123' },
    })

    await requestOptimization.trackClick({ componentId: 'hero-banner' })

    expect(sendBatchEvents).not.toHaveBeenCalled()
    expect(blockedEvents[0]?.method).toBe('trackClick')
  })

  it('passes request-scoped Insights options to Insights-only events', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const beaconHandler = (): boolean => true
    const requestOptimization = core.forRequest({
      consent: true,
      insightsOptions: { beaconHandler },
      profile: { id: 'profile-123' },
    })

    await requestOptimization.trackClick({ componentId: 'hero-banner' })

    expect(sendBatchEvents).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ beaconHandler }),
    )
  })

  it('blocks Insights-only events before profile validation when consent is missing', async () => {
    const blockedEvents: BlockedEvent[] = []
    const core = new CoreStateless({
      clientId: 'key_123',
      environment: 'main',
      onEventBlocked: (event) => blockedEvents.push(event),
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const requestOptimization = core.forRequest({ consent: false })

    await expect(
      requestOptimization.trackClick({ componentId: 'hero-banner' }),
    ).resolves.toBeUndefined()

    expect(sendBatchEvents).not.toHaveBeenCalled()
    expect(blockedEvents[0]?.method).toBe('trackClick')
  })

  it('rejects insights-only request methods without a request-bound profile id', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const requestOptimization = core.forRequest({ consent: true })

    await expect(
      invokeUntypedMethod(requestOptimization, 'trackClick', {
        componentId: 'hero-banner',
      }),
    ).rejects.toThrow(TRACK_CLICK_PROFILE_ERROR)
    await expect(
      invokeUntypedMethod(requestOptimization, 'trackHover', {
        componentId: 'hero-banner',
        hoverDurationMs: 1000,
        hoverId: 'hover-id',
      }),
    ).rejects.toThrow(TRACK_HOVER_PROFILE_ERROR)
    await expect(
      invokeUntypedMethod(requestOptimization, 'trackFlagView', {
        componentId: 'new-navigation',
      }),
    ).rejects.toThrow(TRACK_FLAG_VIEW_PROFILE_ERROR)

    expect(sendBatchEvents).not.toHaveBeenCalled()
  })

  it('keeps non-sticky entry views on Insights only', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const requestOptimization = core.forRequest({
      consent: true,
      experienceOptions: { preflight: true },
      profile: { id: 'profile-123' },
    })

    await expect(
      requestOptimization.trackView({
        componentId: 'hero-banner',
        viewDurationMs: 1000,
        viewId: 'hero-banner-view',
      }),
    ).resolves.toBeUndefined()

    expect(upsertProfile).not.toHaveBeenCalled()
    expect(sendBatchEvents).toHaveBeenCalledWith([
      {
        profile: { id: 'profile-123' },
        events: [
          expect.objectContaining({
            context: expect.objectContaining({
              gdpr: expect.objectContaining({ isConsentGiven: true }),
            }),
            type: 'component',
          }),
        ],
      },
    ])
  })

  it('rejects non-sticky entry views without a request-bound profile id', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const requestOptimization = core.forRequest({ consent: true })

    await expect(
      invokeUntypedMethod(requestOptimization, 'trackView', {
        componentId: 'hero-banner',
        viewDurationMs: 1000,
        viewId: 'hero-banner-view',
      }),
    ).rejects.toThrow(NON_STICKY_TRACK_VIEW_PROFILE_ERROR)

    expect(sendBatchEvents).not.toHaveBeenCalled()
  })

  it('reuses the Experience response profile for sticky entry views without an input profile', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const responseProfile = { ...EMPTY_OPTIMIZATION_DATA.profile, id: 'profile-from-experience' }
    const upsertProfile = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue({
      ...EMPTY_OPTIMIZATION_DATA,
      profile: responseProfile,
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const requestOptimization = core.forRequest({
      consent: true,
      experienceOptions: { preflight: true },
    })

    const result = await requestOptimization.trackView({
      componentId: 'hero-banner',
      sticky: true,
      viewDurationMs: 1000,
      viewId: 'hero-banner-view',
    })

    expect(result).toEqual({
      ...EMPTY_OPTIMIZATION_DATA,
      profile: responseProfile,
    })
    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: undefined,
        events: [expect.objectContaining({ type: 'component' })],
      }),
      expect.objectContaining({ preflight: true }),
    )
    expect(sendBatchEvents).toHaveBeenCalledWith([
      {
        profile: responseProfile,
        events: [expect.objectContaining({ type: 'component' })],
      },
    ])
    expect(requestOptimization.profile).toEqual(responseProfile)
  })
})
