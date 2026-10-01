import ContentfulOptimization from '@contentful/optimization-web'
import { ExperienceApiClient } from '@contentful/optimization-web/api-client'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { EventBuilder, InterceptorManager } from '@contentful/optimization-web/core-sdk'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import { logger } from '@contentful/optimization-web/logger'
import { afterEach, describe, expect, it, rs } from '@rstest/core'
import { act, StrictMode, useContext, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { BeforeInitialPageOptions } from '../before-initial-page/beforeInitialPage'
import { OptimizationHydrationContext } from '../context/OptimizationHydrationContext'
import { OptimizationRoot } from './OptimizationRoot'
const replayEventBuilder = new EventBuilder({
  channel: 'server',
  library: { name: 'test-server', version: '1.0.0' },
})

const testConfig = {
  spaceId: 'test-space-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

function createContentHandoff(
  overrides: Partial<ContentOptimizationHandoff> = {},
): ContentOptimizationHandoff {
  return {
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    state: { selectedOptimizations: [] },
    ...overrides,
  }
}

function createReplayHandoff(replay = createReplay('/products')): ContentOptimizationHandoff {
  return createContentHandoff({ replay })
}

function createReplay(routeKey: string): NonNullable<ContentOptimizationHandoff['replay']> {
  return {
    experience: [replayEventBuilder.buildPageView({})],
    insights: [],
    routeKey,
  }
}

interface ClientRenderResult {
  readonly rerender: (element: ReactElement) => Promise<void>
  readonly unmount: () => void
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function renderClientAsync(element: ReactElement): Promise<ClientRenderResult> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  async function render(nextElement: ReactElement): Promise<void> {
    await act(async () => {
      root.render(nextElement)
      await Promise.resolve()
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

function createDeferred<T>(): {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
} {
  let resolveDeferred: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve
  })

  return {
    promise,
    resolve(value: T) {
      if (resolveDeferred === undefined) throw new Error('Expected deferred resolver.')
      resolveDeferred(value)
    },
  }
}

function createBeforeInitialPageRoot({
  buildPagePayload,
  children = <div />,
  handoff,
  beforeInitialPage,
  routeKey = '/initial',
}: {
  readonly buildPagePayload?: () => { properties: { route: string } }
  readonly children?: ReactElement
  readonly handoff?: ContentOptimizationHandoff
  readonly beforeInitialPage: BeforeInitialPageOptions
  readonly routeKey?: string
}): ReactElement {
  return (
    <OptimizationRoot
      {...testConfig}
      buildPagePayload={buildPagePayload ?? (() => ({ properties: { route: routeKey } }))}
      handoff={handoff}
      beforeInitialPage={beforeInitialPage}
      routeKey={routeKey}
    >
      {children}
    </OptimizationRoot>
  )
}

afterEach(() => {
  rs.useRealTimers()
  rs.restoreAllMocks()
})

describe('OptimizationRoot handoff', () => {
  it('emits the initial browser page event from explicit route payload props', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    const buildPagePayload = rs.fn(() => ({ properties: { route: '/products' } }))

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff()}
        routeKey="/products"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({ properties: { route: '/products' } })
    expect(buildPagePayload).toHaveBeenCalledWith({ isInitialEmission: true })

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('emits the initial browser page event from a serializable initial payload', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    const initialPagePayload = { properties: { route: '/products' } }

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff()}
        routeKey="/products"
        initialPagePayload={initialPagePayload}
      >
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith(initialPagePayload)

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('emits an empty initial payload without explicit route payload props', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    const warn = rs.spyOn(logger, 'warn').mockImplementation(() => undefined)

    const rendered = await renderClientAsync(
      <OptimizationRoot {...testConfig} handoff={createContentHandoff()} routeKey="/products">
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(trackCurrentPage).toHaveBeenCalledWith({})
    expect(warn).not.toHaveBeenCalled()

    rendered.unmount()
    trackCurrentPage.mockRestore()
    warn.mockRestore()
  })

  it('leaves a handoff without a route inert without legacy warnings', async () => {
    const trackCurrentPage = rs.spyOn(ContentfulOptimization.prototype, 'page')

    const rendered = await renderClientAsync(
      <OptimizationRoot {...testConfig} handoff={createContentHandoff()}>
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).not.toHaveBeenCalled()

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('lets the root hydration prop override handoff hydration for children', async () => {
    let capturedHydration: unknown

    function Probe(): null {
      capturedHydration = useContext(OptimizationHydrationContext)
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff({ hydration: 'client-only-hidden-until-ready' })}
        hydration="preserve-server"
      >
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedHydration).toBe('preserve-server')

    rendered.unmount()
  })

  it('makes preserve-server hydration visible to children without a handoff', async () => {
    let capturedHydration: unknown

    function Probe(): null {
      capturedHydration = useContext(OptimizationHydrationContext)
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationRoot {...testConfig} hydration="preserve-server">
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedHydration).toBe('preserve-server')

    rendered.unmount()
  })
})

const replayData: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: {
    id: 'profile',
    stableId: 'profile',
    random: 1,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: 'session',
      isReturningVisitor: false,
      count: 1,
      activeSessionLength: 0,
      averageSessionLength: 0,
      landingPage: {
        path: '/',
        query: {},
        referrer: '',
        search: '',
        title: '',
        url: 'https://example.test/',
      },
    },
  },
}

describe('OptimizationRoot initial operation', () => {
  it('renders children while callback work and page delivery are pending', async () => {
    const callback = createDeferred<undefined>()
    const page = createDeferred<{ accepted: true }>()
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockImplementation(async () => await page.promise)
    function Probe(): ReactElement {
      return <div>preview content</div>
    }
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        children: <Probe />,
        beforeInitialPage: {
          run: async () => {
            await callback.promise
          },
        },
      }),
    )
    expect(document.body.textContent).toContain('preview content')
    expect(trackCurrentPage).not.toHaveBeenCalled()
    callback.resolve(undefined)
    await flushMicrotasks()
    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('preview content')
    page.resolve({ accepted: true })
    await flushMicrotasks()
    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it('registers state observers before replay and skips the browser prerequisite for a matching page', async () => {
    const upsert = rs
      .spyOn(ExperienceApiClient.prototype, 'upsertProfile')
      .mockResolvedValue(replayData)
    const observed: string[] = []
    const run = rs.fn(() => undefined)
    const handoff = createReplayHandoff({
      routeKey: '/products',
      experience: [
        replayEventBuilder.buildIdentify({ userId: 'visitor' }),
        replayEventBuilder.buildPageView({}),
      ],
      insights: [],
    })
    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={handoff}
        routeKey="/products"
        buildPagePayload={() => ({})}
        beforeInitialPage={{ run }}
        onStatesReady={(states) => {
          const subscription = states.eventStream.subscribe((event) => {
            if (event) observed.push(event.type)
          })
          return () => {
            subscription.unsubscribe()
          }
        }}
      >
        <div>preview</div>
      </OptimizationRoot>,
    )
    await flushMicrotasks()
    expect(run).not.toHaveBeenCalled()
    expect(observed).toEqual(['identify', 'page'])
    expect(upsert).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it('runs prerequisite work before a mismatched handoff falls back', async () => {
    const order: string[] = []
    const track = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockImplementation(async () => {
        order.push('page')
        await Promise.resolve()
        return { accepted: true }
      })
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        handoff: createReplayHandoff(createReplay('/server')),
        routeKey: '/browser',
        beforeInitialPage: {
          run: () => {
            order.push('callback')
          },
        },
      }),
    )
    await flushMicrotasks()
    expect(order).toEqual(['callback', 'page'])
    expect(track).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it('delivers the admitted journal and then tracks navigation during hydration', async () => {
    const hydration = createDeferred<unknown>()
    const runInterceptors = InterceptorManager.prototype.run
    rs.spyOn(InterceptorManager.prototype, 'run').mockImplementationOnce(async function run(
      this: InterceptorManager<unknown>,
      state: unknown,
    ) {
      await hydration.promise
      const result: unknown = await runInterceptors.call(this, state)
      return result
    })
    const upsert = rs
      .spyOn(ExperienceApiClient.prototype, 'upsertProfile')
      .mockResolvedValue(replayData)
    const track = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    const run = rs.fn(() => undefined)
    const handoff = createReplayHandoff(createReplay('/initial'))
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({ handoff, beforeInitialPage: { run } }),
    )
    await rendered.rerender(
      createBeforeInitialPageRoot({ handoff, routeKey: '/latest', beforeInitialPage: { run } }),
    )
    hydration.resolve(undefined)
    await flushMicrotasks()
    expect(run).not.toHaveBeenCalled()
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith({ properties: { route: '/latest' } })
    rendered.unmount()
  })

  it('reads the latest page payload after prerequisite work', async () => {
    const callback = createDeferred<undefined>()
    const beforeInitialPage = {
      run: async () => {
        await callback.promise
      },
    }
    const track = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    const handoff = createContentHandoff()
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({ handoff, beforeInitialPage }),
    )
    const payload = (): { properties: { route: string } } => ({ properties: { route: '/latest' } })
    await rendered.rerender(
      createBeforeInitialPageRoot({
        handoff,
        beforeInitialPage,
        routeKey: '/latest',
        buildPagePayload: payload,
      }),
    )
    callback.resolve(undefined)
    await flushMicrotasks()
    expect(track).toHaveBeenCalledWith(payload())
    rendered.unmount()
  })

  it('reports callback errors and still attempts the ordinary page', async () => {
    const error = new Error('callback failed')
    const onError = rs.fn()
    const track = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        beforeInitialPage: {
          run: () => {
            throw error
          },
          onError,
        },
      }),
    )
    await flushMicrotasks()
    expect(onError).toHaveBeenCalledWith(error)
    expect(track).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it('bounds callback waiting without blocking rendered content', async () => {
    rs.useFakeTimers()
    const callback = createDeferred<undefined>()
    const onError = rs.fn()
    const track = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        children: <div>visible preview</div>,
        beforeInitialPage: {
          run: async () => {
            await callback.promise
          },
          maxWaitMs: 10,
          onError,
        },
      }),
    )
    expect(document.body.textContent).toContain('visible preview')
    await act(async () => {
      await rs.advanceTimersByTimeAsync(10)
    })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledTimes(1)
    callback.resolve(undefined)
    rendered.unmount()
  })

  it('cancels not-yet-started page work on unmount', async () => {
    const callback = createDeferred<undefined>()
    const track = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        beforeInitialPage: {
          run: async () => {
            await callback.promise
          },
        },
      }),
    )
    rendered.unmount()
    callback.resolve(undefined)
    await flushMicrotasks()
    expect(track).not.toHaveBeenCalled()
  })

  it('retries a blocked initial page after live consent changes', async () => {
    const upsert = rs
      .spyOn(ExperienceApiClient.prototype, 'upsertProfile')
      .mockResolvedValue(replayData)
    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        allowedEventTypes={[]}
        defaults={{ consent: false }}
        routeKey="/consent"
        buildPagePayload={() => ({})}
        beforeInitialPage={{ run: () => undefined }}
      >
        <div>preview</div>
      </OptimizationRoot>,
    )
    expect(upsert).not.toHaveBeenCalled()
    const sdk = window.contentfulOptimization
    if (sdk === undefined) throw new Error('Expected the live singleton.')
    await act(async () => {
      sdk.consent(true)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(upsert).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it('does not duplicate initial callback or page work in StrictMode', async () => {
    const run = rs.fn(() => undefined)
    const track = rs
      .spyOn(ContentfulOptimization.prototype, 'page')
      .mockResolvedValue({ accepted: true })
    const rendered = await renderClientAsync(
      <StrictMode>{createBeforeInitialPageRoot({ beforeInitialPage: { run } })}</StrictMode>,
    )
    await flushMicrotasks()
    expect(run).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])(
    'rejects invalid callback wait %s before initialization',
    (maxWaitMs) => {
      expect(() =>
        renderToString(
          createBeforeInitialPageRoot({ beforeInitialPage: { run: () => undefined, maxWaitMs } }),
        ),
      ).toThrow('beforeInitialPage.maxWaitMs must be a positive finite number.')
    },
  )
})
