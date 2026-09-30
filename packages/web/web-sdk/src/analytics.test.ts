import { batch, EventBuilder, InterceptorManager, signals } from '@contentful/optimization-core'
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
import LocalStore from './storage/LocalStore'
const replayEventBuilder = new EventBuilder({
  channel: 'server',
  library: { name: 'test-server', version: '1.0.0' },
})

const config = {
  spaceId: 'key_123',
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
          error: null,
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

  it('stages and consumes an analytics handoff replay through ordinary page tracking', async () => {
    const { fetchMethod, requests } = createFetchMethod()
    runtime = initializeOptimizationAnalyticsRuntime({
      ...config,
      defaults: { consent: true, persistenceConsent: true },
      fetchOptions: { fetchMethod },
    })

    await hydrateOptimizationAnalyticsHandoff(
      runtime,
      createAnalyticsHandoff({
        replay: {
          experience: [
            replayEventBuilder.buildIdentify({ userId: 'handoff-user' }),
            replayEventBuilder.buildPageView({}),
          ],
          insights: [],
          routeKey: '/segment-a',
        },
      }),
      {
        buildPagePayload: () => ({ properties: { ordinary: true } }),
        routeKey: '/segment-a',
      },
    )

    const pageRequest = requests.find((request) => request.url.includes('/profiles'))
    expect(pageRequest?.body).toEqual(
      expect.objectContaining({
        events: [
          expect.objectContaining({ type: 'identify' }),
          expect.objectContaining({ type: 'page' }),
        ],
      }),
    )
    const replayedPage = Reflect.get(pageRequest?.body ?? {}, 'events')
    if (!Array.isArray(replayedPage)) throw new Error('Expected replayed analytics events.')
    const pageEvent = replayedPage.find((event) => Reflect.get(event, 'type') === 'page')
    expect(Reflect.get(pageEvent ?? {}, 'properties')).not.toEqual(
      expect.objectContaining({ ordinary: true }),
    )
  })

  it('keeps latest state while each replay-less initialization makes its page attempt', async () => {
    const firstProfile = createProfile('first-profile')
    const secondProfile = createProfile('second-profile')
    const firstHydration = createDeferred()
    const secondHydration = createDeferred()
    const firstPayload = rs.fn(() => ({}))
    const secondPayload = rs.fn(() => ({}))
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
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
    expect(trackCurrentPage).toHaveBeenCalledWith({})

    firstHydration.resolve()
    await first

    expect(trackCurrentPage).toHaveBeenCalledTimes(2)
  })

  it('tracks the ordinary page when private-request analytics hydration fails', async () => {
    const baselineSelectedOptimizations: SelectedOptimizationArray = []
    const hydrationError = new Error('handoff failed')
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined)
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    rs.spyOn(InterceptorManager.prototype, 'run').mockRejectedValue(hydrationError)
    runtime = initializeOptimizationAnalyticsRuntime({ ...config, logLevel: 'warn' })
    signals.selectedOptimizations.value = baselineSelectedOptimizations

    await expect(
      hydrateOptimizationAnalyticsHandoff(runtime, createAnalyticsHandoff(), {
        buildPagePayload: () => ({ properties: { ordinary: true } }),
        routeKey: '/segment-a',
      }),
    ).resolves.toBeUndefined()

    expect(signals.selectedOptimizations.value).toBe(baselineSelectedOptimizations)
    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(trackCurrentPage).toHaveBeenCalledWith({ properties: { ordinary: true } })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Handoff state could not be applied'),
      hydrationError,
    )
  })

  it('hydrates static profileless analytics state without overwriting durable continuity', async () => {
    const [selectedOptimization] = selectedOptimizations
    const [change] = changes
    if (selectedOptimization === undefined || change?.type !== 'Variable')
      throw new Error('Expected analytics fixtures.')

    const durableProfile = createProfile('durable-profile')
    const durableSelectedOptimizations: SelectedOptimizationArray = [
      { ...selectedOptimization, variantIndex: 2 },
    ]
    const durableChanges: ChangeArray = [{ ...change, value: false }]
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
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

  it('keeps private-request analytics state in memory', async () => {
    const durableProfile = createProfile('durable-profile')
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
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
    expect(LocalStore.changes).toBeUndefined()
    expect(LocalStore.profile).toEqual(durableProfile)
    expect(LocalStore.selectedOptimizations).toBeUndefined()
  })

  it('rejects content handoffs', async () => {
    runtime = initializeOptimizationAnalyticsRuntime(config)

    await expect(
      Reflect.apply(hydrateOptimizationAnalyticsHandoff, undefined, [
        runtime,
        {
          cache: { scope: 'static' },
          hydration: 'preserve-server',
        },
        {
          routeKey: '/',
          buildPagePayload: () => ({}),
        },
      ]),
    ).rejects.toThrow('analytics-only optimization handoffs')
  })

  it('fails closed for unsafe public and static analytics handoffs', async () => {
    const trackCurrentPage = rs.spyOn(ContentfulOptimization.prototype, 'page')
    runtime = initializeOptimizationAnalyticsRuntime(config)

    for (const cache of [
      { scope: 'public-permutation', key: 'segment-a' },
      { scope: 'static' },
    ] as const) {
      await expect(
        hydrateOptimizationAnalyticsHandoff(runtime, createAnalyticsHandoff({ cache }), {
          routeKey: '/',
          buildPagePayload: () => ({}),
        }),
      ).rejects.toThrow(
        'Profile state should not be included in public or static optimization caches.',
      )
    }

    expect(signals.profile.value).toBeUndefined()
    expect(signals.selectedOptimizations.value).toBeUndefined()
    expect(trackCurrentPage).not.toHaveBeenCalled()
  })
})
