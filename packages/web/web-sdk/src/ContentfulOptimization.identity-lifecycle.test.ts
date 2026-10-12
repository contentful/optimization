import { batch, signals, type OptimizationHandoff } from '@contentful/optimization-core'
import type { OptimizationData, Profile } from '@contentful/optimization-core/api-schemas'
import { ANONYMOUS_ID_COOKIE } from './constants'
import ContentfulOptimization from './ContentfulOptimization'
import { getCookie, removeCookie } from './lib/cookies'
import LocalStore from './storage/LocalStore'
import { deferred } from './test/helpers'

const config = {
  spaceId: 'key_123',
  environment: 'main',
  defaults: { consent: true, persistenceConsent: true },
}

function createProfile(id: string): Profile {
  return {
    id,
    stableId: id,
    random: 1,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: `${id}-session`,
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
  }
}

function handoff(
  sdk: ContentfulOptimization,
  profileId: string,
  routeKey: string,
  state?: OptimizationHandoff['state'],
): OptimizationHandoff {
  return {
    cache: { scope: 'private-request' },
    profileId,
    state,
    replay: { routeKey, events: [sdk.eventBuilder.buildPageView()] },
  }
}

function resetSignals(): void {
  batch(() => {
    signals.blockedEvent.value = undefined
    signals.changes.value = undefined
    signals.consent.value = undefined
    signals.event.value = undefined
    signals.experienceRequestState.value = { status: 'idle' }
    signals.locale.value = undefined
    signals.online.value = true
    signals.persistenceConsent.value = undefined
    signals.previewPanelAttached.value = false
    signals.previewPanelOpen.value = false
    signals.profile.value = undefined
    signals.selectedOptimizations.value = undefined
  })
}

describe('Web handoff identity lifecycle', () => {
  beforeEach(() => {
    delete window.contentfulOptimization
    localStorage.clear()
    removeCookie(ANONYMOUS_ID_COOKIE)
    resetSignals()
  })

  afterEach(() => {
    window.contentfulOptimization?.destroy()
    delete window.contentfulOptimization
    rs.restoreAllMocks()
  })

  it('validates cache safety before replacing the current attempt or publishing identity', async () => {
    const sdk = new ContentfulOptimization(config)
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue({
      profile: createProfile('valid-id'),
      changes: [],
      selectedOptimizations: [],
    })
    const pendingHydration = deferred()
    const hydrationStarted = deferred()
    sdk.interceptors.state.add(async (state) => {
      hydrationStarted.resolve()
      await pendingHydration.promise
      return state
    })
    const valid = handoff(sdk, 'valid-id', '/valid', { changes: [] })
    const initial = sdk.hydrateAndTrackCurrentPage(valid, { routeKey: '/valid' })
    await hydrationStarted.promise

    await expect(
      sdk.hydrateAndTrackCurrentPage(
        { cache: { scope: 'static' }, profileId: 'unsafe-id' },
        { routeKey: '/unsafe' },
      ),
    ).rejects.toThrow('Profile state, identity and replay must not be included')
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe('valid-id')

    pendingHydration.resolve()
    expect(await initial).toEqual({ accepted: true })
  })

  it('adopts nothing when superseded before its attempt starts', async () => {
    const sdk = new ContentfulOptimization(config)
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue({
      profile: createProfile('new-id'),
      changes: [],
      selectedOptimizations: [],
    })
    const old = sdk.hydrateAndTrackCurrentPage(handoff(sdk, 'old-id', '/old'), {
      routeKey: '/old',
    })
    const current = sdk.hydrateAndTrackCurrentPage(handoff(sdk, 'new-id', '/new'), {
      routeKey: '/new',
    })

    expect(await old).toEqual({ accepted: false })
    expect(await current).toEqual({ accepted: true })
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(deliver.mock.calls[0]?.[0].profileId).toBe('new-id')
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe('new-id')
  })

  it('publishes the selected identity before hydration, with live continuity taking precedence', async () => {
    const sdk = new ContentfulOptimization(config)
    signals.profile.value = createProfile('live-id')
    const waiting = deferred()
    const started = deferred()
    sdk.interceptors.state.add(async (state) => {
      started.resolve()
      await waiting.promise
      return state
    })
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue({
      profile: createProfile('live-id'),
      changes: [],
      selectedOptimizations: [],
    })
    const initialization = sdk.hydrateAndTrackCurrentPage(
      handoff(sdk, 'candidate-id', '/current', { changes: [] }),
      { routeKey: '/current' },
    )
    await started.promise

    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe('live-id')
    expect(deliver).not.toHaveBeenCalled()
    waiting.resolve()
    expect(await initialization).toEqual({ accepted: true })
    expect(deliver.mock.calls[0]?.[0].profileId).toBe('live-id')
  })

  it('keeps the published identity across navigation while suppressing obsolete hydration and replay', async () => {
    const sdk = new ContentfulOptimization(config)
    const waiting = deferred()
    const started = deferred()
    sdk.interceptors.state.add(async (state) => {
      if (state.profile?.id === 'old-preview') {
        started.resolve()
        await waiting.promise
      }
      return state
    })
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue({
      profile: createProfile('response-id'),
      changes: [],
      selectedOptimizations: [],
    })
    const old = sdk.hydrateAndTrackCurrentPage(
      handoff(sdk, 'issued-id', '/old', { profile: createProfile('old-preview') }),
      { routeKey: '/old' },
    )
    await started.promise
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe('issued-id')

    await sdk.trackCurrentPage({ routeKey: '/new', buildPayload: () => ({}) })
    waiting.resolve()
    expect(await old).toEqual({ accepted: false })
    expect(sdk.states.profile.current?.id).not.toBe('old-preview')
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(deliver.mock.calls[0]?.[0].profileId).toBe('issued-id')
  })

  it('carries A identity through an ordinary event into B after A hydration is superseded', async () => {
    const sdk = new ContentfulOptimization(config)
    const releaseAHydration = deferred()
    const aHydrationStarted = deferred()
    sdk.interceptors.state.add(async (state) => {
      if (state.profile?.id === 'a-preview') {
        aHydrationStarted.resolve()
        await releaseAHydration.promise
      }
      return state
    })
    const ordinaryResponse = deferred<OptimizationData>()
    const replayResponse = deferred<OptimizationData>()
    const ordinaryRequestStarted = deferred()
    const replayRequestStarted = deferred()
    const deliver = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockImplementationOnce(async () => {
        ordinaryRequestStarted.resolve()
        return await ordinaryResponse.promise
      })
      .mockImplementationOnce(async () => {
        replayRequestStarted.resolve()
        return await replayResponse.promise
      })

    const a = sdk.hydrateAndTrackCurrentPage(
      handoff(sdk, 'a-issued', '/a', { profile: createProfile('a-preview') }),
      { routeKey: '/a' },
    )
    await aHydrationStarted.promise
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe('a-issued')

    const ordinary = sdk.track({ event: 'between-handoffs' })
    await ordinaryRequestStarted.promise
    expect(deliver.mock.calls[0]?.[0].profileId).toBe('a-issued')
    expect(sdk.states.profile.current).toBeUndefined()

    const b = sdk.hydrateAndTrackCurrentPage(handoff(sdk, 'b-candidate', '/b'), {
      routeKey: '/b',
    })
    expect(await b).toEqual({ accepted: true })
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe('a-issued')
    await replayRequestStarted.promise
    expect(deliver.mock.calls[1]?.[0].profileId).toBe('a-issued')
    expect(deliver.mock.calls[1]?.[0].events.map(({ type }) => type)).toEqual(['page'])

    releaseAHydration.resolve()
    expect(await a).toEqual({ accepted: false })
    expect(sdk.states.profile.current).toBeUndefined()
    expect(deliver).toHaveBeenCalledTimes(2)

    const data = { profile: createProfile('a-issued'), changes: [], selectedOptimizations: [] }
    ordinaryResponse.resolve(data)
    replayResponse.resolve(data)
    expect((await ordinary).accepted).toBe(true)
    await sdk.flush()
  })

  it('keeps admitted replay in Core delivery after navigation', async () => {
    const sdk = new ContentfulOptimization(config)
    const response = deferred<OptimizationData>()
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockReturnValue(response.promise)
    const prepared = handoff(sdk, 'issued-id', '/first')

    expect(await sdk.hydrateAndTrackCurrentPage(prepared, { routeKey: '/first' })).toEqual({
      accepted: true,
    })
    expect(deliver).toHaveBeenCalledTimes(1)
    const admittedEvents = deliver.mock.calls[0]?.[0].events
    window.dispatchEvent(new Event('offline'))
    await sdk.trackCurrentPage({ routeKey: '/second', buildPayload: () => ({}) })
    expect(deliver.mock.calls[0]?.[0].events).toBe(admittedEvents)
    expect(deliver.mock.calls[0]?.[0].profileId).toBe('issued-id')

    response.resolve({
      profile: createProfile('response-id'),
      changes: [],
      selectedOptimizations: [],
    })
    await sdk.flush()
    expect(sdk.states.profile.current?.id).toBe('response-id')
  })

  it('uses adopted continuity for replay while hydrating a distinct preview profile', async () => {
    const sdk = new ContentfulOptimization({
      ...config,
      getAnonymousId: () => 'adopted-id',
    })
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue({
      profile: createProfile('response-id'),
      changes: [],
      selectedOptimizations: [],
    })
    const pendingResponse = deferred<OptimizationData>()
    deliver.mockReturnValue(pendingResponse.promise)

    const prepared = handoff(sdk, 'candidate-id', '/current', {
      profile: createProfile('preview-id'),
    })
    expect(await sdk.hydrateAndTrackCurrentPage(prepared, { routeKey: '/current' })).toEqual({
      accepted: true,
    })
    expect(sdk.states.profile.current?.id).toBe('preview-id')
    expect(deliver.mock.calls[0]?.[0].profileId).toBe('adopted-id')
    pendingResponse.resolve({
      profile: createProfile('response-id'),
      changes: [],
      selectedOptimizations: [],
    })
    await sdk.flush()
  })

  it('shares repeated current work and settles admission before replay HTTP completes', async () => {
    const sdk = new ContentfulOptimization(config)
    const response = deferred<OptimizationData>()
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockReturnValue(response.promise)
    const prepared = handoff(sdk, 'issued-id', '/current')
    const first = sdk.hydrateAndTrackCurrentPage(prepared, { routeKey: '/current' })
    const repeated = sdk.hydrateAndTrackCurrentPage({ ...prepared }, { routeKey: '/current' })

    expect(await first).toEqual({ accepted: true })
    expect(await repeated).toEqual({ accepted: true })
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(sdk.states.profile.current).toBeUndefined()
    response.resolve({
      profile: createProfile('response-id'),
      changes: [],
      selectedOptimizations: [],
    })
    await sdk.flush()
  })

  it.each(['reset', 'destroy'] as const)(
    'invalidates pending hydration and replay on %s',
    async (method) => {
      const sdk = new ContentfulOptimization(config)
      const waiting = deferred()
      const started = deferred()
      sdk.interceptors.state.add(async (state) => {
        started.resolve()
        await waiting.promise
        return state
      })
      const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile')
      const initialization = sdk.hydrateAndTrackCurrentPage(
        handoff(sdk, 'issued-id', '/current', { changes: [] }),
        { routeKey: '/current' },
      )
      await started.promise
      expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe('issued-id')

      sdk[method]()
      waiting.resolve()
      expect(await initialization).toEqual({ accepted: false })
      expect(deliver).not.toHaveBeenCalled()
      if (method === 'reset') expect(LocalStore.anonymousId).toBeUndefined()
    },
  )
})
