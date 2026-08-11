import ContentfulOptimization from '@contentful/optimization-web'
import type { AnalyticsOptimizationHandoff } from '@contentful/optimization-web/analytics'
import { InterceptorManager, signals } from '@contentful/optimization-web/core-sdk'
import { describe, expect, it, rs } from '@rstest/core'
import { act, StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useOptimization } from '../hooks/useOptimization'
import { captureRenderError } from '../test/sdkTestUtils'
import { OptimizationAnalyticsRoot } from './OptimizationAnalyticsRoot'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

const analyticsHandoff: AnalyticsOptimizationHandoff = {
  cache: { scope: 'static' },
  hydration: 'analytics-only',
  initialPageEvent: 'emit',
  state: { selectedOptimizations: [] },
}

type AnalyticsProfile = NonNullable<NonNullable<AnalyticsOptimizationHandoff['state']>['profile']>
function createProfile(id: string): AnalyticsProfile {
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

  const profile = Reflect.get(input, 'profile')
  if (profile === null || typeof profile !== 'object') return undefined

  const id = Reflect.get(profile, 'id')
  return typeof id === 'string' ? id : undefined
}

async function renderClientAsync(element: ReactElement): Promise<{
  rerender: (next: ReactElement) => Promise<void>
  unmount: () => void
}> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  async function render(next: ReactElement): Promise<void> {
    await act(async () => {
      root.render(next)
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  await render(element)

  return {
    rerender: render,
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('OptimizationAnalyticsRoot', () => {
  it('hydrates analytics handoff and tracks the initial route without content context', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const resolveOptimizedEntry = rs.spyOn(
      ContentfulOptimization.prototype,
      'resolveOptimizedEntry',
    )
    const buildPagePayload = rs.fn(() => ({ properties: { route: '/segments/a' } }))

    const rendered = await renderClientAsync(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={analyticsHandoff}
        routeKey="/segments/a"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationAnalyticsRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: buildPagePayload,
      initialPageEvent: 'emit',
      routeKey: '/segments/a',
    })
    expect(resolveOptimizedEntry).not.toHaveBeenCalled()

    rendered.unmount()
    trackCurrentPage.mockRestore()
    resolveOptimizedEntry.mockRestore()
  })

  it('skips only the initially hydrated analytics route', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const buildPagePayload = rs.fn(() => ({}))
    const handoff: AnalyticsOptimizationHandoff = {
      ...analyticsHandoff,
      initialPageEvent: 'skip',
    }

    const rendered = await renderClientAsync(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={handoff}
        routeKey="/"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationAnalyticsRoot>,
    )

    await rendered.rerender(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={handoff}
        routeKey="/products"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationAnalyticsRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledTimes(2)
    expect(trackCurrentPage).toHaveBeenNthCalledWith(1, {
      buildPayload: buildPagePayload,
      initialPageEvent: 'skip',
      routeKey: '/',
    })
    expect(trackCurrentPage).toHaveBeenNthCalledWith(2, {
      buildPayload: buildPagePayload,
      initialPageEvent: 'emit',
      routeKey: '/products',
    })

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('keeps a skipped initial analytics route skipped through StrictMode replay', async () => {
    const requests: unknown[] = []
    const fetchMethod = rs.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve()
      if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.')
      requests.push(JSON.parse(init.body))

      return new Response(
        JSON.stringify({
          data: {
            changes: [],
            experiences: [],
            profile: createProfile('strict-mode-profile'),
          },
          error: false,
          message: 'ok',
        }),
        { status: 200 },
      )
    })
    const buildPagePayload = rs.fn(() => ({ properties: { route: 'client' } }))
    const handoff: AnalyticsOptimizationHandoff = {
      ...analyticsHandoff,
      initialPageEvent: 'skip',
    }
    let rendered: Awaited<ReturnType<typeof renderClientAsync>> | undefined

    try {
      rendered = await renderClientAsync(
        <StrictMode>
          <OptimizationAnalyticsRoot
            {...testConfig}
            defaults={{ consent: true }}
            fetchOptions={{ fetchMethod }}
            handoff={handoff}
            routeKey="/"
            buildPagePayload={buildPagePayload}
          >
            <div />
          </OptimizationAnalyticsRoot>
        </StrictMode>,
      )

      expect(fetchMethod).not.toHaveBeenCalled()

      await rendered.rerender(
        <StrictMode>
          <OptimizationAnalyticsRoot
            {...testConfig}
            defaults={{ consent: true }}
            fetchOptions={{ fetchMethod }}
            handoff={handoff}
            routeKey="/products"
            buildPagePayload={buildPagePayload}
          >
            <div />
          </OptimizationAnalyticsRoot>
        </StrictMode>,
      )

      expect(fetchMethod).toHaveBeenCalledTimes(1)
      expect(requests[0]).toEqual(
        expect.objectContaining({
          events: [
            expect.objectContaining({
              properties: expect.objectContaining({ route: 'client' }),
              type: 'page',
            }),
          ],
        }),
      )
    } finally {
      rendered?.unmount()
    }
  })

  it('hydrates analytics handoff with a serializable initial payload', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const initialPagePayload = { properties: { route: '/segments/a' } }

    const rendered = await renderClientAsync(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={analyticsHandoff}
        routeKey="/segments/a"
        initialPagePayload={initialPagePayload}
      >
        <div />
      </OptimizationAnalyticsRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/segments/a',
    })
    const firstCall = trackCurrentPage.mock.calls[0]
    if (firstCall === undefined) throw new Error('Expected trackCurrentPage to be called.')
    const [{ buildPayload }] = firstCall
    if (buildPayload === undefined) throw new Error('Expected buildPayload to be provided.')
    expect(buildPayload({ isInitialEmission: true })).toBe(initialPagePayload)

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('does not track an older route when analytics hydration resolves after a newer handoff', async () => {
    const firstProfile = createProfile('first-profile')
    const secondProfile = createProfile('second-profile')
    const firstHydration = createDeferred()
    const secondHydration = createDeferred()
    const buildPagePayload = rs.fn(() => ({}))
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const runInterceptors = InterceptorManager.prototype.run
    const runInterceptorsSpy = rs
      .spyOn(InterceptorManager.prototype, 'run')
      .mockImplementation(async function run(
        this: InterceptorManager<unknown>,
        input: unknown,
      ): Promise<unknown> {
        if (readProfileId(input) === firstProfile.id) await firstHydration.promise
        if (readProfileId(input) === secondProfile.id) await secondHydration.promise

        return await runInterceptors.call(this, input)
      })

    const rendered = await renderClientAsync(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={{
          ...analyticsHandoff,
          cache: { scope: 'private-request' },
          state: { profile: firstProfile, selectedOptimizations: [] },
        }}
        routeKey="/segments/a"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationAnalyticsRoot>,
    )

    await rendered.rerender(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={{
          ...analyticsHandoff,
          cache: { scope: 'private-request' },
          state: { profile: secondProfile, selectedOptimizations: [] },
        }}
        routeKey="/segments/b"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationAnalyticsRoot>,
    )

    secondHydration.resolve()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: buildPagePayload,
      initialPageEvent: 'emit',
      routeKey: '/segments/b',
    })

    firstHydration.resolve()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(trackCurrentPage).toHaveBeenCalledTimes(1)

    rendered.unmount()
    trackCurrentPage.mockRestore()
    runInterceptorsSpy.mockRestore()
  })

  it('does not apply analytics state or track the page after unmount', async () => {
    const delayedProfile = createProfile('delayed-profile')
    const hydration = createDeferred()
    const buildPagePayload = rs.fn(() => ({}))
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const runInterceptors = InterceptorManager.prototype.run
    const runInterceptorsSpy = rs
      .spyOn(InterceptorManager.prototype, 'run')
      .mockImplementation(async function run(
        this: InterceptorManager<unknown>,
        input: unknown,
      ): Promise<unknown> {
        if (readProfileId(input) === delayedProfile.id) await hydration.promise

        return await runInterceptors.call(this, input)
      })

    signals.profile.value = undefined

    const rendered = await renderClientAsync(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={{
          ...analyticsHandoff,
          cache: { scope: 'private-request' },
          state: { profile: delayedProfile, selectedOptimizations: [] },
        }}
        routeKey="/segments/a"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationAnalyticsRoot>,
    )

    rendered.unmount()
    hydration.resolve()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(signals.profile.value).toBeUndefined()
    expect(trackCurrentPage).not.toHaveBeenCalled()

    trackCurrentPage.mockRestore()
    runInterceptorsSpy.mockRestore()
  })

  it('does not provide content-resolution context to descendants', () => {
    function Probe(): null {
      useOptimization()
      return null
    }

    const error = captureRenderError(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={analyticsHandoff}
        routeKey="/segments/a"
        buildPagePayload={() => ({})}
      >
        <Probe />
      </OptimizationAnalyticsRoot>,
    )

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) {
      throw new Error('Expected useOptimization to throw')
    }

    expect(error.message).toContain('useOptimization must be used within an OptimizationProvider')
  })
})
