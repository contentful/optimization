import {
  batch,
  InterceptorManager,
  signals,
  type OptimizationSelectionState,
} from '@contentful/optimization-core'
import type {
  ChangeArray,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-core/api-schemas'
import {
  hydrateOptimizationAnalyticsHandoff,
  initializeOptimizationAnalyticsRuntime,
  type AnalyticsOptimizationHandoff,
  type OptimizationAnalyticsRuntime,
} from './analytics'
import ContentfulOptimization from './ContentfulOptimization'
import { hydrateOptimizationHandoffState } from './handoff'
import LocalStore from './storage/LocalStore'

const config = {
  clientId: 'key_123',
  environment: 'main',
}

const selectedOptimizations: SelectedOptimizationArray = [
  {
    experienceId: 'experience-id',
    sticky: true,
    variantIndex: 1,
    variants: { baseline: 'variant' },
  },
]

const changes: ChangeArray = [
  {
    key: 'flag',
    type: 'Variable',
    value: true,
    meta: { experienceId: 'experience-id', variantIndex: 1 },
  },
]

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

const profile: Profile = createProfile('profile-id')

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

function readProfileId(input: unknown): string | undefined {
  if (input === null || typeof input !== 'object') return undefined

  const profileValue = Reflect.get(input, 'profile')
  if (profileValue === null || typeof profileValue !== 'object') return undefined

  const id = Reflect.get(profileValue, 'id')
  return typeof id === 'string' ? id : undefined
}

function createAnalyticsHandoff(
  overrides: Partial<AnalyticsOptimizationHandoff> = {},
): AnalyticsOptimizationHandoff {
  return {
    cache: { scope: 'private-request' },
    hydration: 'analytics-only',
    initialPageEvent: 'emit',
    state: {
      profile,
      selectedOptimizations,
    },
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

function readRequestBody(init: RequestInit | undefined): string {
  const { body } = init ?? {}

  if (typeof body === 'string') return body

  throw new Error('Expected a string request body.')
}

function parseBody(init: RequestInit | undefined): unknown {
  return JSON.parse(readRequestBody(init))
}

function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url

  throw new Error('Expected a string, URL, or Request input.')
}

function createFetchMethod(): {
  readonly fetchMethod: ReturnType<typeof rs.fn>
  readonly requests: Array<{ readonly body: unknown; readonly url: string }>
} {
  const requests: Array<{ readonly body: unknown; readonly url: string }> = []
  const fetchMethod = rs.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    await Promise.resolve()
    const url = readRequestUrl(input)
    requests.push({ body: parseBody(init), url })

    if (url.includes('/profiles')) {
      return new Response(
        JSON.stringify({
          data: {
            changes: [],
            experiences: selectedOptimizations,
            profile,
          },
          error: false,
          message: 'ok',
        }),
        { status: 200 },
      )
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  })

  return { fetchMethod, requests }
}

describe('Optimization analytics handoff runtime', () => {
  let runtime: OptimizationAnalyticsRuntime | undefined

  beforeEach(() => {
    delete window.contentfulOptimization
    document.body.innerHTML = ''
    localStorage.clear()
    resetSignals()
  })

  afterEach(() => {
    runtime?.destroy()
    runtime = undefined
    window.contentfulOptimization?.destroy()
    delete window.contentfulOptimization
    document.body.innerHTML = ''
    rs.restoreAllMocks()
  })

  it('retains the stateful singleton lock while the internal SDK is hidden from window', () => {
    runtime = initializeOptimizationAnalyticsRuntime(config)

    expect(window.contentfulOptimization).toBeUndefined()
    expect(() => new ContentfulOptimization(config)).toThrow(
      /Only one stateful instance is supported per runtime/,
    )

    runtime.destroy()
    runtime = undefined

    const replacement = new ContentfulOptimization(config)
    replacement.destroy()
  })

  it('exposes read-only current-page coordination state', async () => {
    runtime = initializeOptimizationAnalyticsRuntime(config)
    const readableStates: Pick<ContentfulOptimization['states'], 'currentStateTracking'> =
      runtime.states

    expect(Object.keys(readableStates)).toEqual(['currentStateTracking'])
    expect(readableStates.currentStateTracking.current).toEqual(
      expect.objectContaining({ status: 'idle' }),
    )

    await runtime.trackCurrentPage({ initialPageEvent: 'skip', routeKey: '/server-emitted' })

    expect(readableStates.currentStateTracking.current).toEqual(
      expect.objectContaining({ key: '/server-emitted', status: 'accepted' }),
    )
  })

  it('emits the initial page event and entry clicks from existing data attributes', async () => {
    const entry = document.createElement('button')
    entry.dataset.ctflBaselineId = 'baseline'
    entry.dataset.ctflEntryId = 'variant'
    entry.dataset.ctflOptimizationId = 'experience-id'
    entry.dataset.ctflSticky = 'true'
    entry.dataset.ctflVariantIndex = '1'
    document.body.append(entry)
    const { fetchMethod, requests } = createFetchMethod()
    runtime = initializeOptimizationAnalyticsRuntime({
      ...config,
      defaults: { consent: true, persistenceConsent: true },
      fetchOptions: { fetchMethod },
    })

    await hydrateOptimizationAnalyticsHandoff(runtime, createAnalyticsHandoff(), {
      routeKey: '/segment-a',
      buildPagePayload: ({ isInitialEmission }) => ({
        properties: { initial: isInitialEmission, route: '/segment-a' },
      }),
    })

    entry.click()
    await Promise.resolve()
    await runtime.flush()

    const pageRequest = requests.find((request) => request.url.includes('/profiles'))
    const insightsRequest = requests.find((request) => request.url.includes('/events'))

    expect(pageRequest?.body).toEqual(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            properties: expect.objectContaining({ initial: true, route: '/segment-a' }),
            type: 'page',
          }),
        ],
      }),
    )
    expect(insightsRequest?.body).toEqual([
      expect.objectContaining({
        profile,
        events: [
          expect.objectContaining({
            componentId: 'variant',
            experienceId: 'experience-id',
            type: 'component_click',
            variantIndex: 1,
          }),
        ],
      }),
    ])
    expect('resolveOptimizedEntry' in runtime).toBe(false)
    expect('fetchOptimizedEntry' in runtime).toBe(false)
  })

  it('does not track an older analytics route after a newer handoff starts', async () => {
    const firstProfile = createProfile('first-profile')
    const secondProfile = createProfile('second-profile')
    const firstHydration = createDeferred()
    const secondHydration = createDeferred()
    const firstPayload = rs.fn(() => ({}))
    const secondPayload = rs.fn(() => ({}))
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const runInterceptors = InterceptorManager.prototype.run
    rs.spyOn(InterceptorManager.prototype, 'run').mockImplementation(async function run(
      this: InterceptorManager<unknown>,
      input: unknown,
    ): Promise<unknown> {
      if (readProfileId(input) === firstProfile.id) await firstHydration.promise
      if (readProfileId(input) === secondProfile.id) await secondHydration.promise

      return await runInterceptors.call(this, input)
    })
    runtime = initializeOptimizationAnalyticsRuntime(config)

    const first = hydrateOptimizationAnalyticsHandoff(
      runtime,
      createAnalyticsHandoff({
        state: {
          profile: firstProfile,
          selectedOptimizations,
        },
      }),
      {
        routeKey: '/segment-a',
        buildPagePayload: firstPayload,
      },
    )
    const second = hydrateOptimizationAnalyticsHandoff(
      runtime,
      createAnalyticsHandoff({
        state: {
          profile: secondProfile,
          selectedOptimizations,
        },
      }),
      {
        routeKey: '/segment-b',
        buildPagePayload: secondPayload,
      },
    )

    secondHydration.resolve()
    await second

    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: secondPayload,
      initialPageEvent: 'emit',
      routeKey: '/segment-b',
    })

    firstHydration.resolve()
    await first

    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
  })

  it('does not track an analytics route superseded by content hydration', async () => {
    const analyticsProfile = createProfile('analytics-profile')
    const contentProfile = createProfile('content-profile')
    const analyticsHydration = createDeferred()
    const buildPagePayload = rs.fn(() => ({}))
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const runInterceptors = InterceptorManager.prototype.run
    rs.spyOn(InterceptorManager.prototype, 'run').mockImplementation(async function run(
      this: InterceptorManager<unknown>,
      input: unknown,
    ): Promise<unknown> {
      if (readProfileId(input) === analyticsProfile.id) await analyticsHydration.promise

      return await runInterceptors.call(this, input)
    })
    runtime = initializeOptimizationAnalyticsRuntime(config)
    const contentStateInterceptors = new InterceptorManager<OptimizationSelectionState>()
    const contentTarget = {
      interceptors: { state: contentStateInterceptors },
    }

    const staleAnalytics = hydrateOptimizationAnalyticsHandoff(
      runtime,
      createAnalyticsHandoff({
        state: {
          profile: analyticsProfile,
          selectedOptimizations,
        },
      }),
      {
        routeKey: '/analytics',
        buildPagePayload,
      },
    )

    await hydrateOptimizationHandoffState(contentTarget, {
      profile: contentProfile,
      selectedOptimizations,
    })

    analyticsHydration.resolve()
    await staleAnalytics

    expect(trackCurrentPage).not.toHaveBeenCalled()
    expect(buildPagePayload).not.toHaveBeenCalled()
    expect(signals.profile.value).toEqual(contentProfile)
  })

  it('hydrates static profileless analytics state without overwriting durable continuity', async () => {
    const [selectedOptimization] = selectedOptimizations
    const [change] = changes
    if (selectedOptimization === undefined || change === undefined)
      throw new Error('Expected analytics fixtures.')

    const durableProfile = createProfile('durable-profile')
    const durableSelectedOptimizations: SelectedOptimizationArray = [
      { ...selectedOptimization, variantIndex: 2 },
    ]
    const durableChanges: ChangeArray = [{ ...change, value: false }]
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    runtime = initializeOptimizationAnalyticsRuntime({
      ...config,
      defaults: { consent: true, persistenceConsent: true },
    })
    LocalStore.profile = durableProfile
    LocalStore.changes = durableChanges
    LocalStore.selectedOptimizations = durableSelectedOptimizations

    await hydrateOptimizationAnalyticsHandoff(
      runtime,
      createAnalyticsHandoff({
        cache: { scope: 'static' },
        state: { changes, selectedOptimizations },
      }),
      {
        routeKey: '/segment-a',
        buildPagePayload: () => ({}),
      },
    )

    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(LocalStore.changes).toEqual(durableChanges)
    expect(LocalStore.profile).toEqual(durableProfile)
    expect(LocalStore.selectedOptimizations).toEqual(durableSelectedOptimizations)
  })

  it('persists private-request analytics state to durable continuity', async () => {
    const durableProfile = createProfile('durable-profile')
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    runtime = initializeOptimizationAnalyticsRuntime({
      ...config,
      defaults: { consent: true, persistenceConsent: true },
    })
    LocalStore.profile = durableProfile

    await hydrateOptimizationAnalyticsHandoff(
      runtime,
      createAnalyticsHandoff({
        state: { changes, selectedOptimizations },
      }),
      {
        routeKey: '/segment-a',
        buildPagePayload: () => ({}),
      },
    )

    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(LocalStore.changes).toEqual(changes)
    expect(LocalStore.profile).toEqual(durableProfile)
    expect(LocalStore.selectedOptimizations).toEqual(selectedOptimizations)
  })

  it('warns without throwing when skipping the page event without profile continuity', async () => {
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined)
    runtime = initializeOptimizationAnalyticsRuntime({
      ...config,
      logLevel: 'warn',
    })

    await expect(
      hydrateOptimizationAnalyticsHandoff(
        runtime,
        createAnalyticsHandoff({
          initialPageEvent: 'skip',
          state: { selectedOptimizations },
        }),
        {
          routeKey: '/segment-a',
          buildPagePayload: () => ({}),
        },
      ),
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('without handoff profile state or browser profile continuity'),
    )
  })

  it('rejects content handoffs', async () => {
    runtime = initializeOptimizationAnalyticsRuntime(config)

    await expect(
      Reflect.apply(hydrateOptimizationAnalyticsHandoff, undefined, [
        runtime,
        {
          cache: { scope: 'static' },
          hydration: 'preserve-server',
          initialPageEvent: 'emit',
        },
        {
          routeKey: '/',
          buildPagePayload: () => ({}),
        },
      ]),
    ).rejects.toThrow('analytics-only optimization handoffs')
  })

  it('rejects invalid initialPageEvent values', async () => {
    runtime = initializeOptimizationAnalyticsRuntime(config)

    await expect(
      Reflect.apply(hydrateOptimizationAnalyticsHandoff, undefined, [
        runtime,
        {
          ...createAnalyticsHandoff(),
          initialPageEvent: 'invalid',
        },
        {
          routeKey: '/',
          buildPagePayload: () => ({}),
        },
      ]),
    ).rejects.toThrow('initialPageEvent')
  })

  it('rejects public profile state before hydrating browser signals', async () => {
    runtime = initializeOptimizationAnalyticsRuntime(config)

    await expect(
      hydrateOptimizationAnalyticsHandoff(
        runtime,
        createAnalyticsHandoff({
          cache: { scope: 'public-permutation', key: 'segment-a' },
        }),
        {
          routeKey: '/',
          buildPagePayload: () => ({}),
        },
      ),
    ).rejects.toThrow(
      'Profile state should not be included in public or static optimization caches.',
    )

    expect(signals.profile.value).toBeUndefined()
    expect(signals.selectedOptimizations.value).toBeUndefined()
  })
})
