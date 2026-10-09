import { batch, signals } from '@contentful/optimization-core'
import type {
  ChangeArray,
  OptimizationData,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-core/api-schemas'
import { ANONYMOUS_ID_COOKIE_LEGACY } from '@contentful/optimization-core/constants'
import * as webBridgeSupport from './bridge-support'
import { ANONYMOUS_ID_COOKIE } from './constants'
import ContentfulOptimization from './ContentfulOptimization'
import {
  hydrateOptimizationHandoff,
  hydrateOptimizationHandoffState,
  type ContentOptimizationHandoff,
} from './handoff'
import { getCookie, removeCookie } from './lib/cookies'
import { createWebSnapshotRuntime } from './runtime'
import LocalStore from './storage/LocalStore'
import { deferred } from './test/helpers'

const config = {
  spaceId: 'key_123',
  environment: 'main',
}

const createProfile = (id: string): Profile => ({
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
})

const selectedOptimizations: SelectedOptimizationArray = [
  {
    experienceId: 'experience-id',
    sticky: false,
    variantIndex: 1,
    variants: { baseline: 'variant' },
  },
]

const changes: ChangeArray = [
  {
    key: 'flag',
    type: 'Variable',
    value: true,
    meta: {
      experienceId: 'experience-id',
      variantIndex: 1,
    },
  },
]

function createContentHandoff(
  state: ContentOptimizationHandoff['state'],
  overrides: Partial<ContentOptimizationHandoff> = {},
): ContentOptimizationHandoff {
  return {
    cache: { scope: 'static' },
    hydration: 'preserve-server',
    state,
    ...overrides,
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

async function expectProfilelessCacheableHandoffPreservesDurableContinuity(
  cache: ContentOptimizationHandoff['cache'],
): Promise<void> {
  const [selectedOptimization] = selectedOptimizations
  const [change] = changes
  if (selectedOptimization === undefined || change?.type !== 'Variable')
    throw new Error('Expected optimization state fixtures.')

  const durableSelectedOptimizations: SelectedOptimizationArray = [
    { ...selectedOptimization, variantIndex: 2 },
  ]
  const durableChanges: ChangeArray = [{ ...change, value: false }]
  const sdk = new ContentfulOptimization({
    ...config,
    defaults: {
      consent: true,
      persistenceConsent: true,
    },
  })
  LocalStore.consent = true
  LocalStore.persistenceConsent = true
  LocalStore.changes = durableChanges
  LocalStore.selectedOptimizations = durableSelectedOptimizations

  await hydrateOptimizationHandoff(
    sdk,
    createContentHandoff(
      {
        changes,
        selectedOptimizations,
      },
      { cache },
    ),
  )

  expect(signals.changes.value).toEqual(changes)
  expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
  expect(LocalStore.changes).toEqual(durableChanges)
  expect(LocalStore.selectedOptimizations).toEqual(durableSelectedOptimizations)
}

async function expectDelayedPersistenceConsentPreservesProfilelessCacheableHandoff(
  cache: ContentOptimizationHandoff['cache'],
): Promise<void> {
  const sdk = new ContentfulOptimization(config)

  await hydrateOptimizationHandoff(
    sdk,
    createContentHandoff(
      {
        changes,
        selectedOptimizations,
      },
      { cache },
    ),
  )

  sdk.consent({ persistence: true })

  expect(signals.changes.value).toEqual(changes)
  expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
  expect(LocalStore.changes).toBeUndefined()
  expect(LocalStore.selectedOptimizations).toBeUndefined()
}

function createDeferred(): {
  readonly promise: Promise<void>
  readonly resolve: () => void
} {
  let resolveDeferred: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolveDeferred = resolve
  })

  return {
    promise,
    resolve() {
      if (resolveDeferred === undefined) throw new Error('Expected deferred resolver.')
      resolveDeferred()
    },
  }
}

describe('hydrateOptimizationHandoff', () => {
  beforeEach(() => {
    delete window.contentfulOptimization
    localStorage.clear()
    removeCookie(ANONYMOUS_ID_COOKIE)
    removeCookie(ANONYMOUS_ID_COOKIE_LEGACY)
    resetSignals()
  })

  afterEach(() => {
    window.contentfulOptimization?.destroy()
    delete window.contentfulOptimization
    rs.restoreAllMocks()
  })

  it('keeps handoff hydration out of Web bridge support', () => {
    expect('hydrateOptimizationSelectionState' in webBridgeSupport).toBe(false)
    expect('hydrateOptimizationHandoffState' in webBridgeSupport).toBe(false)
  })

  it('admits replay without waiting for delivery, persists its API ID and keeps early Insights attributable', async () => {
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: { consent: true, persistenceConsent: true },
    })
    const response = deferred<OptimizationData>()
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockReturnValue(response.promise)
    const insightsSent = createDeferred()
    const insights = rs.spyOn(sdk.api.insights, 'sendBatchEvents').mockImplementation(async () => {
      insightsSent.resolve()
      return await Promise.resolve(true)
    })
    const browserTransform = rs.spyOn(sdk.interceptors.event, 'run')
    const events = [
      sdk.eventBuilder.buildIdentify({ userId: 'customer' }),
      sdk.eventBuilder.buildPageView(),
    ]
    const handoff: ContentOptimizationHandoff = {
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      profileId: 'api-issued-id',
      replay: { routeKey: '/paired', events, locale: 'de-DE' },
    }
    const ordinaryPage = rs.spyOn(sdk, 'page')

    expect(await sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/paired' })).toEqual({
      accepted: true,
    })
    expect(browserTransform).not.toHaveBeenCalled()
    expect(sdk.states.profile.current).toBeUndefined()
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe('api-issued-id')
    await sdk.trackClick({
      componentId: 'displayed-variant',
      experienceId: 'experience-id',
      variantIndex: 1,
    })
    const flushing = sdk.flush()
    await insightsSent.promise
    expect(insights.mock.calls[0]?.[0]).toMatchObject([
      {
        profile: { id: 'api-issued-id' },
        events: [
          { componentId: 'displayed-variant', experienceId: 'experience-id', variantIndex: 1 },
        ],
      },
    ])
    expect(deliver).toHaveBeenCalledWith(
      { profileId: 'api-issued-id', events },
      { preflight: false, locale: 'de-DE' },
    )
    const liveReady = createDeferred()
    const subscription = sdk.states.profile.subscribe((profile) => {
      if (profile?.id === 'linked-api-id') liveReady.resolve()
    })
    response.resolve({ profile: createProfile('linked-api-id'), changes, selectedOptimizations })
    await liveReady.promise
    subscription.unsubscribe()
    await flushing
    expect(sdk.states.profile.current?.id).toBe('linked-api-id')
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe('linked-api-id')
    expect(ordinaryPage).not.toHaveBeenCalled()
  })

  it('shares state-only and delivery initialization without reseeding after a live response', async () => {
    const seed = createProfile('api-issued-id')
    const live = { ...seed, traits: { accepted: true } }
    const sdk = new ContentfulOptimization({ ...config, defaults: { consent: true } })
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue({
      profile: live,
      changes: [],
      selectedOptimizations: [],
    })
    const handoff = createContentHandoff(
      { profile: seed, changes, selectedOptimizations },
      {
        cache: { scope: 'private-request' },
        profileId: seed.id,
        replay: { routeKey: '/paired', events: [sdk.eventBuilder.buildPageView()] },
      },
    )
    await hydrateOptimizationHandoff(sdk, handoff, { routeKey: '/paired' })
    const first = sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/paired' })
    const repeat = sdk.hydrateAndTrackCurrentPage({ ...handoff }, { routeKey: '/paired' })
    expect(await first).toEqual({ accepted: true })
    expect(await repeat).toEqual({ accepted: true })
    await sdk.flush()
    await hydrateOptimizationHandoff(sdk, handoff, { routeKey: '/paired' })
    await sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/paired' })
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(sdk.states.profile.current).toEqual(live)
    expect(sdk.states.selectedOptimizations.current).toEqual([])
  })

  it('reassesses consent, retaining the known ID in memory when persistence is denied', async () => {
    const sdk = new ContentfulOptimization({
      ...config,
      allowedEventTypes: [],
      defaults: { persistenceConsent: false },
    })
    window.dispatchEvent(new Event('offline'))
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue({
      profile: createProfile('api-issued-id'),
      changes,
      selectedOptimizations,
    })
    const insights = rs.spyOn(sdk.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const handoff = createContentHandoff(undefined, {
      cache: { scope: 'private-request' },
      profileId: 'api-issued-id',
      replay: { routeKey: '/paired', events: [sdk.eventBuilder.buildPageView()] },
    })
    expect(await sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/paired' })).toEqual({
      accepted: false,
    })
    sdk.consent({ events: true })
    expect(await sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/paired' })).toEqual({
      accepted: true,
    })
    await sdk.trackClick({ componentId: 'displayed-variant' })
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBeUndefined()
    expect(deliver).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('online'))
    await sdk.flush()
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(insights.mock.calls[0]?.[0][0]?.profile.id).toBe('api-issued-id')
  })

  it('rejects capacity without emitting a replacement page', async () => {
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: { consent: true },
      queuePolicy: { offlineMaxEvents: 1 },
    })
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile')
    const ordinaryPage = rs.spyOn(sdk, 'page')
    const handoff = createContentHandoff(undefined, {
      cache: { scope: 'private-request' },
      replay: {
        routeKey: '/paired',
        events: [
          sdk.eventBuilder.buildIdentify({ userId: 'customer' }),
          sdk.eventBuilder.buildPageView(),
        ],
      },
    })
    expect(await sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/paired' })).toEqual({
      accepted: false,
    })
    expect(deliver).not.toHaveBeenCalled()
    expect(ordinaryPage).not.toHaveBeenCalled()
  })

  it('tracks new preparations and return visits while leaving retry ownership with Core', async () => {
    const sdk = new ContentfulOptimization({ ...config, defaults: { consent: true } })
    window.dispatchEvent(new Event('offline'))
    const delivered = createDeferred()
    let pages = 0
    const deliver = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockImplementation(async (payload) => {
        pages += payload.events.filter(({ type }) => type === 'page').length
        if (pages === 4) delivered.resolve()
        return await Promise.resolve({
          profile: createProfile('api-issued-id'),
          changes,
          selectedOptimizations,
        })
      })
    const first = createContentHandoff(undefined, {
      cache: { scope: 'private-request' },
      profileId: 'api-issued-id',
      replay: { routeKey: '/one', events: [sdk.eventBuilder.buildPageView()] },
    })
    const second = {
      ...first,
      replay: { routeKey: '/one', events: [sdk.eventBuilder.buildPageView()] },
    }
    await sdk.hydrateAndTrackCurrentPage(first, { routeKey: '/one' })
    await sdk.hydrateAndTrackCurrentPage(second, { routeKey: '/one' })
    await sdk.trackCurrentPage({ routeKey: '/two', buildPayload: () => ({}) })
    await sdk.hydrateAndTrackCurrentPage(first, { routeKey: '/one' })
    window.dispatchEvent(new Event('online'))
    await delivered.promise
    expect(
      deliver.mock.calls
        .flatMap(([payload]) => payload.events)
        .filter(({ type }) => type === 'page'),
    ).toHaveLength(4)
  })

  it('skips stale-route state and replay while permitting the current ordinary page', async () => {
    const sdk = new ContentfulOptimization({ ...config, defaults: { consent: true } })
    const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue({
      profile: createProfile('api-issued-id'),
      changes: [],
      selectedOptimizations: [],
    })
    const handoff = createContentHandoff(
      { changes, selectedOptimizations },
      {
        cache: { scope: 'private-request' },
        profileId: 'api-issued-id',
        replay: { routeKey: '/old', events: [sdk.eventBuilder.buildPageView()] },
      },
    )
    await hydrateOptimizationHandoff(sdk, handoff, { routeKey: '/current' })
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()
    await sdk.hydrateAndTrackCurrentPage(handoff, {
      routeKey: '/current',
      buildPayload: () => ({ properties: { title: 'current' } }),
    })
    expect(deliver.mock.calls[0]?.[0].events).toMatchObject([
      { type: 'page', properties: { title: 'current' } },
    ])
  })

  it.each(['reset', 'destroy'] as const)(
    'does not finish pending hydration after %s',
    async (method) => {
      const sdk = new ContentfulOptimization({ ...config, defaults: { consent: true } })
      const waiting = createDeferred()
      const started = createDeferred()
      sdk.interceptors.state.add(async (state) => {
        started.resolve()
        await waiting.promise
        return state
      })
      const deliver = rs.spyOn(sdk.api.experience, 'upsertProfile')
      const handoff = createContentHandoff(
        { profile: createProfile('api-issued-id') },
        {
          cache: { scope: 'private-request' },
          replay: { routeKey: '/paired', events: [sdk.eventBuilder.buildPageView()] },
        },
      )
      const initialization = sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/paired' })
      await started.promise
      sdk[method]()
      waiting.resolve()
      expect(await initialization).toEqual({ accepted: false })
      expect(sdk.states.profile.current).toBeUndefined()
      expect(deliver).not.toHaveBeenCalled()
    },
  )

  it('keeps paired tracking inert in a snapshot runtime', async () => {
    const runtime = createWebSnapshotRuntime()
    expect(
      await runtime.hydrateAndTrackCurrentPage({ cache: { scope: 'static' } }, { routeKey: '/' }),
    ).toEqual({ accepted: false })
  })

  it('preserves ordinary online errors and allows another page attempt when replay is absent', async () => {
    const sdk = new ContentfulOptimization({ ...config, defaults: { consent: true } })
    const failure = new Error('Experience unavailable')
    const deliver = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({
        profile: createProfile('api-issued-id'),
        changes,
        selectedOptimizations,
      })
    const handoff = createContentHandoff(undefined)
    await expect(sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/ordinary' })).rejects.toBe(
      failure,
    )
    expect(
      (await sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/ordinary' })).accepted,
    ).toBe(true)
    expect(deliver).toHaveBeenCalledTimes(2)
  })

  it('hydrates selection state without clearing existing profile continuity', async () => {
    const existingProfile = createProfile('existing-profile')
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: {
        consent: true,
        persistenceConsent: true,
        profile: existingProfile,
      },
    })

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff({
        changes,
        selectedOptimizations,
      }),
    )

    expect(signals.changes.value).toEqual(changes)
    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(sdk.states.profile.current).toEqual(existingProfile)
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
  })

  it('hydrates public handoff state through the Web handoff helper', async () => {
    const sdk = new ContentfulOptimization(config)

    await hydrateOptimizationHandoffState(sdk, {
      changes,
      selectedOptimizations,
    })

    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(sdk.states.profile.current).toBeUndefined()
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
  })

  it('marks undefined and empty handoff state as successful', async () => {
    const sdk = new ContentfulOptimization(config)

    await hydrateOptimizationHandoff(sdk, createContentHandoff(undefined))

    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })

    resetSignals()

    await hydrateOptimizationHandoff(sdk, createContentHandoff({}))

    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
  })

  it('hydrates static profileless handoff state without overwriting durable continuity', async () => {
    await expectProfilelessCacheableHandoffPreservesDurableContinuity({ scope: 'static' })
  })

  it('hydrates public profileless handoff state without overwriting durable continuity', async () => {
    await expectProfilelessCacheableHandoffPreservesDurableContinuity({
      key: 'segment-a',
      scope: 'public-permutation',
    })
  })

  it('keeps static profileless handoff state non-durable when persistence consent is delayed', async () => {
    await expectDelayedPersistenceConsentPreservesProfilelessCacheableHandoff({ scope: 'static' })
  })

  it('keeps public profileless handoff state non-durable when persistence consent is delayed', async () => {
    await expectDelayedPersistenceConsentPreservesProfilelessCacheableHandoff({
      key: 'segment-a',
      scope: 'public-permutation',
    })
  })

  it('applies a full server profile when the handoff includes one', async () => {
    const existingProfile = createProfile('existing-profile')
    const serverProfile = createProfile('server-profile')
    const interceptedProfile = createProfile('intercepted-profile')
    const incomingProfiles: Array<Profile | undefined> = []
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: {
        consent: true,
        persistenceConsent: true,
        profile: existingProfile,
      },
    })
    sdk.interceptors.state.add((incoming) => {
      incomingProfiles.push(incoming.profile)
      return { ...incoming, profile: interceptedProfile }
    })

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          changes,
          profile: serverProfile,
          selectedOptimizations,
        },
        { cache: { scope: 'private-request' } },
      ),
    )

    expect(incomingProfiles).toEqual([serverProfile])
    expect(sdk.states.profile.current).toEqual(interceptedProfile)
    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(LocalStore.changes).toEqual(changes)
    expect(LocalStore.profile).toEqual(interceptedProfile)
    expect(LocalStore.selectedOptimizations).toEqual(selectedOptimizations)
  })

  it('keeps input handoff fields when an interceptor omits them', async () => {
    const serverProfile = createProfile('server-profile')
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: {
        consent: true,
        persistenceConsent: true,
      },
    })
    sdk.interceptors.state.add(() => ({}))

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          changes,
          profile: serverProfile,
          selectedOptimizations,
        },
        { cache: { scope: 'private-request' } },
      ),
    )

    expect(sdk.states.profile.current).toEqual(serverProfile)
    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(LocalStore.changes).toEqual(changes)
    expect(LocalStore.profile).toEqual(serverProfile)
    expect(LocalStore.selectedOptimizations).toEqual(selectedOptimizations)
  })

  it('applies present undefined handoff fields intentionally', async () => {
    const existingProfile = createProfile('existing-profile')
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: {
        profile: existingProfile,
        selectedOptimizations,
      },
    })

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          profile: undefined,
        },
        { cache: { scope: 'private-request' } },
      ),
    )

    expect(sdk.states.profile.current).toBeUndefined()
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()
  })

  it('clears stale content state when a new handoff omits content fields', async () => {
    const existingProfile = createProfile('existing-profile')
    const serverProfile = createProfile('server-profile')
    const stateInterceptorInputs: Array<ContentOptimizationHandoff['state']> = []
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: {
        changes,
        profile: existingProfile,
        selectedOptimizations,
      },
    })
    sdk.interceptors.state.add((incoming) => {
      stateInterceptorInputs.push(incoming)
      return { profile: incoming.profile }
    })

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          profile: serverProfile,
        },
        { cache: { scope: 'private-request' } },
      ),
    )

    expect(stateInterceptorInputs).toEqual([
      {
        changes: undefined,
        profile: serverProfile,
        selectedOptimizations: undefined,
      },
    ])
    expect(signals.changes.value).toBeUndefined()
    expect(sdk.states.profile.current).toEqual(serverProfile)
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()
  })

  it('rejects static profile state before hydrating browser signals', async () => {
    const sdk = new ContentfulOptimization(config)
    const serverProfile = createProfile('server-profile')

    await expect(
      hydrateOptimizationHandoff(
        sdk,
        createContentHandoff({
          profile: serverProfile,
          selectedOptimizations,
        }),
      ),
    ).rejects.toThrow(
      'Profile state, identity and replay must not be included in public or static optimization caches.',
    )

    expect(sdk.states.profile.current).toBeUndefined()
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()
  })

  it('accepts profileless static state in async interceptors and preserves profile continuity', async () => {
    const existingProfile = createProfile('existing-profile')
    const incomingProfiles: Array<Profile | undefined> = []
    const [selectedOptimization] = selectedOptimizations
    if (selectedOptimization === undefined)
      throw new Error('Expected selected optimization fixture.')
    const interceptedSelectedOptimizations: SelectedOptimizationArray = [
      { ...selectedOptimization, variantIndex: 2 },
    ]
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: {
        consent: true,
        persistenceConsent: true,
      },
    })
    signals.profile.value = existingProfile
    sdk.interceptors.state.add(async (incoming) => {
      await Promise.resolve()
      incomingProfiles.push(incoming.profile)

      return {
        changes: incoming.changes,
        selectedOptimizations: interceptedSelectedOptimizations,
      }
    })

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff({
        changes,
        selectedOptimizations,
      }),
    )

    expect(incomingProfiles).toEqual([undefined])
    expect(sdk.states.selectedOptimizations.current).toEqual(interceptedSelectedOptimizations)
    expect(sdk.states.profile.current).toEqual(existingProfile)
  })

  it('keeps a newer handoff authoritative when an older interceptor resolves last', async () => {
    const firstProfile = createProfile('first-profile')
    const secondProfile = createProfile('second-profile')
    const firstHydration = createDeferred()
    const secondHydration = createDeferred()
    const sdk = new ContentfulOptimization(config)
    sdk.interceptors.state.add(async (incoming) => {
      if (incoming.profile?.id === firstProfile.id) await firstHydration.promise
      if (incoming.profile?.id === secondProfile.id) await secondHydration.promise

      return incoming
    })

    const first = hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          changes,
          profile: firstProfile,
          selectedOptimizations,
        },
        { cache: { scope: 'private-request' } },
      ),
    )
    const second = hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          changes,
          profile: secondProfile,
          selectedOptimizations,
        },
        { cache: { scope: 'private-request' } },
      ),
    )

    secondHydration.resolve()
    await second
    expect(sdk.states.profile.current).toEqual(secondProfile)

    firstHydration.resolve()
    await first
    expect(sdk.states.profile.current).toEqual(secondProfile)
  })
})
