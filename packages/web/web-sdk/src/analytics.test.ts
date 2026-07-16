import { batch, signals } from '@contentful/optimization-core'
import type { Profile, SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import {
  hydrateOptimizationAnalyticsHandoff,
  initializeOptimizationAnalyticsRuntime,
  type AnalyticsOptimizationHandoff,
  type OptimizationAnalyticsRuntime,
} from './analytics'

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

const profile: Profile = {
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
}

function createAnalyticsHandoff(
  overrides: Partial<AnalyticsOptimizationHandoff> = {},
): AnalyticsOptimizationHandoff {
  return {
    cache: { scope: 'public-permutation', key: 'segment-a' },
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
})
