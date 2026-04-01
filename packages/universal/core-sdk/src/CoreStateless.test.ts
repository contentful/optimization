import type { OptimizationData } from './api-schemas'
import CoreStateless from './CoreStateless'

const TRACK_CLICK_PROFILE_ERROR =
  'CoreStateless.forRequest().trackClick() requires `payload.profile.id` for Insights delivery.'
const TRACK_HOVER_PROFILE_ERROR =
  'CoreStateless.forRequest().trackHover() requires `payload.profile.id` for Insights delivery.'
const TRACK_FLAG_VIEW_PROFILE_ERROR =
  'CoreStateless.forRequest().trackFlagView() requires `payload.profile.id` for Insights delivery.'
const NON_STICKY_TRACK_VIEW_PROFILE_ERROR =
  'CoreStateless.forRequest().trackView() requires `payload.profile.id` when `payload.sticky` is not `true`.'

type CoreStatelessRequest = ReturnType<InstanceType<typeof CoreStateless>['forRequest']>

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

async function invokeUntypedRequestMethod(
  request: CoreStatelessRequest,
  method: 'trackClick' | 'trackHover' | 'trackFlagView' | 'trackView',
  payload: Record<string, unknown>,
): Promise<unknown> {
  const methodRef = Reflect.get(request, method)

  if (typeof methodRef !== 'function') {
    throw new Error(`Expected "${method}" to be a function`)
  }

  return await Reflect.apply(methodRef, request, [payload])
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

  it('forwards request-bound options and explicit profiles through Experience upserts', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const request = core.forRequest({
      ip: '203.0.113.10',
      locale: 'de-DE',
      plainText: false,
      preflight: true,
    })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)

    await request.identify({
      userId: 'user-123',
      profile: { id: 'profile-123' },
    })

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-123',
        events: [expect.objectContaining({ type: 'identify' })],
      }),
      {
        ip: '203.0.113.10',
        locale: 'de-DE',
        plainText: false,
        preflight: true,
      },
    )
  })

  it('keeps request locale and event locale separate', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const request = core.forRequest({ locale: 'de-DE' })

    await request.page({
      locale: 'en-US',
      profile: { id: 'profile-123' },
    })

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

  it('isolates request-bound options between separate request scopes', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)

    await Promise.all([
      core.forRequest({ ip: '203.0.113.10', locale: 'de-DE' }).track({ event: 'first' }),
      core.forRequest({ ip: '198.51.100.5', locale: 'en-US', plainText: false }).track({
        event: 'second',
      }),
    ])

    const requestOptions = upsertProfile.mock.calls.map(([, options]) => options)

    expect(requestOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ip: '203.0.113.10', locale: 'de-DE' }),
        expect.objectContaining({
          ip: '198.51.100.5',
          locale: 'en-US',
          plainText: false,
        }),
      ]),
    )
  })

  it('sends sticky entry views through both the Experience API and Insights API', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const request = core.forRequest({ preflight: true })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await request.trackView({
      componentId: 'hero-banner',
      sticky: true,
      viewId: 'hero-banner-view',
      viewDurationMs: 1000,
      profile: { id: 'profile-123' },
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
        events: [expect.objectContaining({ type: 'component' })],
      },
    ])
  })

  it('rejects insights-only stateless methods without a profile id', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const request = core.forRequest()
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await expect(
      invokeUntypedRequestMethod(request, 'trackClick', {
        componentId: 'hero-banner',
      }),
    ).rejects.toThrow(TRACK_CLICK_PROFILE_ERROR)
    await expect(
      invokeUntypedRequestMethod(request, 'trackHover', {
        componentId: 'hero-banner',
        hoverDurationMs: 1000,
        hoverId: 'hover-id',
      }),
    ).rejects.toThrow(TRACK_HOVER_PROFILE_ERROR)
    await expect(
      invokeUntypedRequestMethod(request, 'trackFlagView', {
        componentId: 'new-navigation',
      }),
    ).rejects.toThrow(TRACK_FLAG_VIEW_PROFILE_ERROR)

    expect(sendBatchEvents).not.toHaveBeenCalled()
  })

  it('keeps non-sticky entry views on Insights only', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const request = core.forRequest({ preflight: true })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await expect(
      request.trackView({
        componentId: 'hero-banner',
        viewId: 'hero-banner-view',
        viewDurationMs: 1000,
        profile: { id: 'profile-123' },
      }),
    ).resolves.toBeUndefined()

    expect(upsertProfile).not.toHaveBeenCalled()
    expect(sendBatchEvents).toHaveBeenCalledWith([
      {
        profile: { id: 'profile-123' },
        events: [expect.objectContaining({ type: 'component' })],
      },
    ])
  })

  it('rejects non-sticky entry views without a profile id', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const request = core.forRequest({ preflight: true })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await expect(
      invokeUntypedRequestMethod(request, 'trackView', {
        componentId: 'hero-banner',
        viewDurationMs: 1000,
        viewId: 'hero-banner-view',
      }),
    ).rejects.toThrow(NON_STICKY_TRACK_VIEW_PROFILE_ERROR)

    expect(sendBatchEvents).not.toHaveBeenCalled()
  })

  it('reuses the Experience response profile for sticky entry views without an input profile', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const request = core.forRequest({ preflight: true })
    const responseProfile = { ...EMPTY_OPTIMIZATION_DATA.profile, id: 'profile-from-experience' }
    const upsertProfile = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue({
      ...EMPTY_OPTIMIZATION_DATA,
      profile: responseProfile,
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    const result = await request.trackView({
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
  })

  it('prefers the Experience response profile over a stale input profile for sticky entry views', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const request = core.forRequest({ preflight: true })
    const staleProfile = { id: 'stale-profile' }
    const responseProfile = { ...EMPTY_OPTIMIZATION_DATA.profile, id: 'fresh-profile' }
    rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue({
      ...EMPTY_OPTIMIZATION_DATA,
      profile: responseProfile,
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await request.trackView({
      componentId: 'hero-banner',
      sticky: true,
      viewDurationMs: 1000,
      viewId: 'hero-banner-view',
      profile: staleProfile,
    })

    expect(sendBatchEvents).toHaveBeenCalledWith([
      {
        profile: responseProfile,
        events: [expect.objectContaining({ type: 'component' })],
      },
    ])
  })

  it('keeps request-bound options off insights-only methods', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const request = core.forRequest({
      ip: '203.0.113.10',
      locale: 'de-DE',
      plainText: false,
      preflight: true,
    })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await request.trackClick({ componentId: 'hero-banner', profile: { id: 'profile-123' } })

    expect(upsertProfile).not.toHaveBeenCalled()
    expect(sendBatchEvents).toHaveBeenCalledWith([
      {
        profile: { id: 'profile-123' },
        events: [expect.objectContaining({ type: 'component_click' })],
      },
    ])
  })
})
