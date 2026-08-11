import { batch, signals } from '@contentful/optimization-core'
import type {
  ChangeArray,
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
import { removeCookie } from './lib/cookies'
import LocalStore from './storage/LocalStore'

type PublicHandoffStateHydrationOptions = NonNullable<
  Parameters<typeof hydrateOptimizationHandoffState>[2]
>
const publicHydrationOptionsExcludePersistenceControl: 'suppressDurableContinuityPersistence' extends keyof PublicHandoffStateHydrationOptions
  ? false
  : true = true

void publicHydrationOptionsExcludePersistenceControl

const config = {
  clientId: 'key_123',
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
    initialPageEvent: 'skip',
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
  if (selectedOptimization === undefined || change === undefined)
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
  readonly reject: (error: unknown) => void
  readonly resolve: () => void
} {
  let rejectDeferred: (error: unknown) => void = () => undefined
  let resolveDeferred: (() => void) | undefined
  const promise = new Promise<void>((resolve, reject) => {
    rejectDeferred = reject
    resolveDeferred = resolve
  })

  return {
    promise,
    reject: rejectDeferred,
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

  it('keeps empty raw handoff state authoritative when an older send resumes after event interception', async () => {
    const lateProfile = createProfile('late-identify-profile')
    const existingProfile = createProfile('existing-profile')
    const eventInterception = Promise.withResolvers<undefined>()
    const interceptionStarted = Promise.withResolvers<undefined>()
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: { profile: existingProfile },
    })
    const lateData = {
      changes: [],
      profile: lateProfile,
      selectedOptimizations: [],
    }
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue(lateData)
    sdk.interceptors.event.add(async (event) => {
      if (event.type === 'identify') {
        interceptionStarted.resolve(undefined)
        await eventInterception.promise
      }

      return event
    })

    const olderIdentify = sdk.identify({ userId: 'older-identify' })
    await interceptionStarted.promise

    await hydrateOptimizationHandoffState(sdk, undefined)

    eventInterception.resolve(undefined)
    await expect(olderIdentify).resolves.toEqual({ accepted: true, data: lateData })

    expect(signals.changes.value).toBeUndefined()
    expect(sdk.states.profile.current).toEqual(existingProfile)
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()
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

  it('does not mutate signals for an empty handoff that is no longer current', async () => {
    const sdk = new ContentfulOptimization(config)

    await hydrateOptimizationHandoff(sdk, createContentHandoff(undefined), {
      isCurrent: () => false,
    })

    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'idle' })
    expect(signals.changes.value).toBeUndefined()
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()
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
      'Profile state should not be included in public or static optimization caches.',
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

  it('keeps hydrated state authoritative when an older Experience response resolves last', async () => {
    const lateProfile = createProfile('late-experience-profile')
    const hydratedProfile = createProfile('hydrated-profile')
    const lateInterception = Promise.withResolvers<undefined>()
    const interceptionStarted = Promise.withResolvers<undefined>()
    const sdk = new ContentfulOptimization(config)
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue({
      changes: [],
      profile: lateProfile,
      selectedOptimizations: [],
    })
    sdk.interceptors.state.add(async (incoming) => {
      if (incoming.profile?.id === lateProfile.id) {
        interceptionStarted.resolve(undefined)
        await lateInterception.promise
      }

      return incoming
    })

    const olderRequest = sdk.identify({ userId: 'older-request' })
    await interceptionStarted.promise

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          changes,
          profile: hydratedProfile,
          selectedOptimizations,
        },
        { cache: { scope: 'private-request' } },
      ),
    )

    lateInterception.resolve(undefined)
    await olderRequest

    expect(signals.changes.value).toEqual(changes)
    expect(sdk.states.profile.current).toEqual(hydratedProfile)
    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
  })

  it('keeps content hydration authoritative when an older joined page send resumes after event interception', async () => {
    const lateProfile = createProfile('late-page-profile')
    const hydratedProfile = createProfile('hydrated-profile')
    const eventInterception = Promise.withResolvers<undefined>()
    const interceptionStarted = Promise.withResolvers<undefined>()
    const sdk = new ContentfulOptimization(config)
    const lateData = {
      changes: [],
      profile: lateProfile,
      selectedOptimizations: [],
    }
    const upsertProfile = rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue(lateData)
    sdk.interceptors.event.add(async (event) => {
      if (event.type === 'page') {
        interceptionStarted.resolve(undefined)
        await eventInterception.promise
      }

      return event
    })
    const pageOptions = {
      routeKey: '/older-page',
      buildPayload: () => ({}),
    }

    const olderPage = sdk.trackCurrentPage(pageOptions)
    await interceptionStarted.promise
    const joinedPage = sdk.trackCurrentPage(pageOptions)

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          changes,
          profile: hydratedProfile,
          selectedOptimizations,
        },
        { cache: { scope: 'private-request' } },
      ),
    )

    eventInterception.resolve(undefined)
    await expect(olderPage).resolves.toEqual({ accepted: true, data: lateData })
    await expect(joinedPage).resolves.toEqual({ accepted: true, data: lateData })

    expect(upsertProfile).toHaveBeenCalledTimes(1)
    expect(sdk.states.currentStateTracking.current).toMatchObject({
      key: '/older-page',
      status: 'accepted',
    })
    expect(signals.changes.value).toEqual(changes)
    expect(sdk.states.profile.current).toEqual(hydratedProfile)
    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
  })

  it('propagates an older handoff rejection after a newer handoff becomes authoritative', async () => {
    const firstProfile = createProfile('first-profile')
    const secondProfile = createProfile('second-profile')
    const firstHydration = createDeferred()
    const sdk = new ContentfulOptimization(config)
    sdk.interceptors.state.add(async (incoming) => {
      if (incoming.profile?.id === firstProfile.id) await firstHydration.promise

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
    await hydrateOptimizationHandoff(
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

    firstHydration.reject(new Error('stale hydration failed'))

    await expect(first).rejects.toThrow('stale hydration failed')
    expect(sdk.states.profile.current).toEqual(secondProfile)
  })

  it('does not let an already-cancelled hydration supersede active hydration', async () => {
    const activeProfile = createProfile('active-profile')
    const cancelledProfile = createProfile('cancelled-profile')
    const activeHydrationStarted = createDeferred()
    const resumeActiveHydration = createDeferred()
    const sdk = new ContentfulOptimization(config)
    sdk.interceptors.state.add(async (incoming) => {
      if (incoming.profile?.id === activeProfile.id) {
        activeHydrationStarted.resolve()
        await resumeActiveHydration.promise
      }

      return incoming
    })

    const activeHydration = hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          changes,
          profile: activeProfile,
          selectedOptimizations,
        },
        { cache: { scope: 'private-request' } },
      ),
    )
    await activeHydrationStarted.promise

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          changes,
          profile: cancelledProfile,
          selectedOptimizations,
        },
        { cache: { scope: 'private-request' } },
      ),
      { isCurrent: () => false },
    )

    resumeActiveHydration.resolve()
    await activeHydration

    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
    expect(sdk.states.profile.current).toEqual(activeProfile)
    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
  })

  it('does not apply intercepted state after hydration is no longer current', async () => {
    const serverProfile = createProfile('server-profile')
    const intercepted = createDeferred()
    const sdk = new ContentfulOptimization(config)
    let current = true
    sdk.interceptors.state.add(async (incoming) => {
      await intercepted.promise
      return incoming
    })

    const hydration = hydrateOptimizationHandoff(
      sdk,
      createContentHandoff(
        {
          changes,
          profile: serverProfile,
          selectedOptimizations,
        },
        { cache: { scope: 'private-request' } },
      ),
      { isCurrent: () => current },
    )

    current = false
    intercepted.resolve()

    await expect(hydration).resolves.toBeUndefined()
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'idle' })
    expect(sdk.states.profile.current).toBeUndefined()
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()
  })

  it('propagates interceptor rejection after hydration is no longer current', async () => {
    const intercepted = createDeferred()
    const sdk = new ContentfulOptimization(config)
    let current = true
    sdk.interceptors.state.add(async () => {
      await intercepted.promise
      return {}
    })

    const hydration = hydrateOptimizationHandoff(
      sdk,
      createContentHandoff({ changes, selectedOptimizations }),
      { isCurrent: () => current },
    )

    current = false
    intercepted.reject(new Error('unmounted hydration failed'))

    await expect(hydration).rejects.toThrow('unmounted hydration failed')
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'idle' })
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()
  })

  it('rejects analytics-only handoffs', async () => {
    const sdk = new ContentfulOptimization(config)

    await expect(
      Reflect.apply(hydrateOptimizationHandoff, undefined, [
        sdk,
        {
          cache: { scope: 'static' },
          hydration: 'analytics-only',
          initialPageEvent: 'skip',
        },
      ]),
    ).rejects.toThrow('content optimization handoffs')
  })
})
