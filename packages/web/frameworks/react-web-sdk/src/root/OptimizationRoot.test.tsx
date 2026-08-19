import ContentfulOptimization from '@contentful/optimization-web'
import { InterceptorManager } from '@contentful/optimization-web/core-sdk'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import { logger } from '@contentful/optimization-web/logger'
import { afterEach, describe, expect, it, rs } from '@rstest/core'
import { act, StrictMode, useContext, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { BeforeInitialPageOptions } from '../before-initial-page/beforeInitialPage'
import { useBeforeInitialPageReady } from '../context/BeforeInitialPageContext'
import type { OptimizationContextValue } from '../context/OptimizationContext'
import { OptimizationHydrationContext } from '../context/OptimizationHydrationContext'
import { useOptimizationContext } from '../hooks/useOptimization'
import { OptimizationRoot } from './OptimizationRoot'

const testConfig = {
  clientId: 'test-client-id',
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
    initialPageEvent: 'skip',
    state: { selectedOptimizations: [] },
    ...overrides,
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
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const buildPagePayload = rs.fn(() => ({ properties: { route: '/products' } }))

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff({ initialPageEvent: 'emit' })}
        routeKey="/products"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: buildPagePayload,
      initialPageEvent: 'emit',
      routeKey: '/products',
    })

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('emits the initial browser page event from a serializable initial payload', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const initialPagePayload = { properties: { route: '/products' } }

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff({ initialPageEvent: 'emit' })}
        routeKey="/products"
        initialPagePayload={initialPagePayload}
      >
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/products',
    })
    const firstCall = trackCurrentPage.mock.calls[0]
    if (firstCall === undefined) throw new Error('Expected trackCurrentPage to be called.')
    const [{ buildPayload }] = firstCall
    if (buildPayload === undefined) throw new Error('Expected buildPayload to be provided.')
    expect(buildPayload({ isInitialEmission: true })).toBe(initialPagePayload)

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('marks the skipped initial route without route payload props', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const warn = rs.spyOn(logger, 'warn').mockImplementation(() => undefined)

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff({ initialPageEvent: 'skip' })}
        routeKey="/products"
      >
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(trackCurrentPage).toHaveBeenCalledWith({
      initialPageEvent: 'skip',
      routeKey: '/products',
    })
    expect(warn).not.toHaveBeenCalled()

    rendered.unmount()
    trackCurrentPage.mockRestore()
    warn.mockRestore()
  })

  it('warns and skips initial browser page emission without route payload props', async () => {
    const trackCurrentPage = rs.spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
    const warn = rs.spyOn(logger, 'warn').mockImplementation(() => undefined)

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff({ initialPageEvent: 'emit' })}
      >
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      'React:OptimizationRoot',
      expect.stringContaining('without routeKey and buildPagePayload'),
    )

    rendered.unmount()
    trackCurrentPage.mockRestore()
    warn.mockRestore()
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

describe('OptimizationRoot before initial page', () => {
  it('awaits callback work before the direct page and releases readiness after page terminality', async () => {
    const callback = createDeferred<undefined>()
    const page = createDeferred<{ accepted: true }>()
    const order: string[] = []
    const readiness: boolean[] = []
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockImplementationOnce(async () => {
        order.push('page')
        return await page.promise
      })
      .mockResolvedValue({ accepted: true })

    function ReadinessProbe(): null {
      readiness.push(useBeforeInitialPageReady())
      return null
    }

    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        children: <ReadinessProbe />,
        beforeInitialPage: {
          run: async () => {
            order.push('callback')
            await callback.promise
            return 'ready'
          },
        },
      }),
    )

    expect(order).toEqual(['callback'])
    expect(trackCurrentPage).not.toHaveBeenCalled()
    expect(readiness.at(-1)).toBe(false)

    callback.resolve(undefined)
    await flushMicrotasks()

    expect(order).toEqual(['callback', 'page'])
    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(readiness.at(-1)).toBe(false)

    page.resolve({ accepted: true })
    await flushMicrotasks()

    expect(readiness.at(-1)).toBe(true)
    expect(trackCurrentPage).toHaveBeenCalledTimes(2)
    expect(trackCurrentPage).toHaveBeenNthCalledWith(1, {
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/initial',
    })
    expect(trackCurrentPage).toHaveBeenNthCalledWith(2, {
      initialPageEvent: 'skip',
      routeKey: '/initial',
    })

    rendered.unmount()
  })

  it.each([
    {
      name: 'synchronous callback throw',
      run(error: Error): undefined {
        throw error
      },
    },
    {
      name: 'callback rejection',
      async run(error: Error): Promise<never> {
        return await Promise.reject(error)
      },
    },
  ])('reports one $name and still attempts the page', async ({ run }) => {
    const callbackError = new Error('callback failed')
    const onError = rs.fn()
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        beforeInitialPage: {
          onError,
          run: (): ReturnType<typeof run> => {
            const result = run(callbackError)
            return result
          },
        },
      }),
    )

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(callbackError)
    expect(trackCurrentPage).toHaveBeenCalledTimes(2)
    expect(trackCurrentPage).toHaveBeenNthCalledWith(1, {
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/initial',
    })
    expect(trackCurrentPage).toHaveBeenNthCalledWith(2, {
      initialPageEvent: 'skip',
      routeKey: '/initial',
    })

    rendered.unmount()
  })

  it.each([
    { configured: undefined, beforeDeadline: 2_999, deadline: 1 },
    { configured: 25, beforeDeadline: 24, deadline: 1 },
  ])(
    'starts the page only when the $configured watchdog expires',
    async ({ beforeDeadline, configured, deadline }) => {
      rs.useFakeTimers()
      const callback = createDeferred<undefined>()
      const onError = rs.fn()
      const trackCurrentPage = rs
        .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
        .mockResolvedValue({ accepted: true })
      const rendered = await renderClientAsync(
        createBeforeInitialPageRoot({
          beforeInitialPage: {
            maxWaitMs: configured,
            onError,
            run: async () => {
              await callback.promise
              return 'ready'
            },
          },
        }),
      )

      await act(async () => {
        await rs.advanceTimersByTimeAsync(beforeDeadline)
      })
      expect(onError).not.toHaveBeenCalled()
      expect(trackCurrentPage).not.toHaveBeenCalled()

      await act(async () => {
        await rs.advanceTimersByTimeAsync(deadline)
      })
      expect(onError).toHaveBeenCalledTimes(1)
      expect(trackCurrentPage).toHaveBeenCalledTimes(2)

      callback.resolve(undefined)
      await flushMicrotasks()
      expect(trackCurrentPage).toHaveBeenCalledTimes(2)

      rendered.unmount()
    },
  )

  it('reads the latest route and payload builder after callback work settles', async () => {
    const callback = createDeferred<undefined>()
    const beforeInitialPage = {
      run: async () => {
        await callback.promise
        return 'ready'
      },
    }
    const firstBuilder = rs.fn(() => ({ properties: { route: '/initial' } }))
    const latestBuilder = rs.fn(() => ({ properties: { route: '/latest' } }))
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const handoff = createContentHandoff({ initialPageEvent: 'skip' })
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        buildPagePayload: firstBuilder,
        handoff,
        beforeInitialPage,
      }),
    )

    await rendered.rerender(
      createBeforeInitialPageRoot({
        buildPagePayload: latestBuilder,
        handoff,
        beforeInitialPage,
        routeKey: '/latest',
      }),
    )
    callback.resolve(undefined)
    await flushMicrotasks()

    expect(trackCurrentPage).toHaveBeenNthCalledWith(1, {
      buildPayload: latestBuilder,
      initialPageEvent: 'emit',
      routeKey: '/latest',
    })
    expect(trackCurrentPage).toHaveBeenNthCalledWith(2, {
      initialPageEvent: 'skip',
      routeKey: '/latest',
    })
    expect(firstBuilder).not.toHaveBeenCalled()

    rendered.unmount()
  })

  it('marks the attempted route before observing route changes made during the direct page', async () => {
    const page = createDeferred<{ accepted: true }>()
    const beforeInitialPage = { run: () => undefined }
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockImplementationOnce(async () => await page.promise)
      .mockResolvedValue({ accepted: true })
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({ beforeInitialPage, routeKey: '/attempted' }),
    )

    expect(trackCurrentPage).toHaveBeenCalledTimes(1)
    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/attempted',
    })

    await rendered.rerender(
      createBeforeInitialPageRoot({ beforeInitialPage, routeKey: '/during-page' }),
    )
    expect(trackCurrentPage).toHaveBeenCalledTimes(1)

    page.resolve({ accepted: true })
    await flushMicrotasks()

    expect(trackCurrentPage).toHaveBeenCalledTimes(2)
    expect(trackCurrentPage).toHaveBeenNthCalledWith(2, {
      initialPageEvent: 'skip',
      routeKey: '/attempted',
    })

    await rendered.rerender(
      createBeforeInitialPageRoot({ beforeInitialPage, routeKey: '/after-readiness' }),
    )
    expect(trackCurrentPage).toHaveBeenCalledTimes(3)
    expect(trackCurrentPage).toHaveBeenNthCalledWith(3, {
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/after-readiness',
    })

    rendered.unmount()
  })

  it('uses direct skip only after a successful same-route skip handoff', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        handoff: createContentHandoff({ initialPageEvent: 'skip' }),
        beforeInitialPage: { run: () => undefined },
      }),
    )

    expect(trackCurrentPage).toHaveBeenCalledTimes(2)
    expect(trackCurrentPage).toHaveBeenNthCalledWith(1, {
      initialPageEvent: 'skip',
      routeKey: '/initial',
    })
    expect(trackCurrentPage).toHaveBeenNthCalledWith(2, {
      initialPageEvent: 'skip',
      routeKey: '/initial',
    })

    rendered.unmount()
  })

  it('retains a failed owned handoff runtime and emits the direct page', async () => {
    const hydrationError = new Error('handoff apply failed')
    rs.spyOn(InterceptorManager.prototype, 'run').mockRejectedValueOnce(hydrationError)
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    let capturedContext: OptimizationContextValue | undefined

    function ContextProbe(): null {
      capturedContext = useOptimizationContext()
      return null
    }

    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        children: <ContextProbe />,
        handoff: createContentHandoff({ initialPageEvent: 'skip' }),
        beforeInitialPage: { run: () => undefined },
      }),
    )

    expect(capturedContext).toEqual(
      expect.objectContaining({ error: hydrationError, isLive: true }),
    )
    expect(capturedContext?.sdk).toBeInstanceOf(ContentfulOptimization)
    expect(trackCurrentPage).toHaveBeenNthCalledWith(1, {
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/initial',
    })
    expect(trackCurrentPage).toHaveBeenNthCalledWith(2, {
      initialPageEvent: 'skip',
      routeKey: '/initial',
    })

    rendered.unmount()
  })

  it.each([
    {
      logsError: true,
      name: 'rejected',
      result: async () => await Promise.reject(new Error('page failed')),
    },
    {
      logsError: false,
      name: 'unaccepted',
      result: async () => await Promise.resolve({ accepted: false as const }),
    },
  ])(
    'marks the attempted route without a same-route emitting retry after a $name direct page',
    async ({ logsError, result }) => {
      const logError = rs.spyOn(logger, 'error').mockImplementation(() => undefined)
      const trackCurrentPage = rs
        .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
        .mockImplementationOnce(result)
        .mockResolvedValue({ accepted: true })
      const beforeInitialPage = { run: () => undefined }
      const rendered = await renderClientAsync(createBeforeInitialPageRoot({ beforeInitialPage }))

      expect(trackCurrentPage).toHaveBeenCalledTimes(2)
      expect(trackCurrentPage).toHaveBeenNthCalledWith(1, {
        buildPayload: expect.any(Function),
        initialPageEvent: 'emit',
        routeKey: '/initial',
      })
      expect(trackCurrentPage).toHaveBeenNthCalledWith(2, {
        initialPageEvent: 'skip',
        routeKey: '/initial',
      })

      await rendered.rerender(
        createBeforeInitialPageRoot({ beforeInitialPage, routeKey: '/later' }),
      )

      expect(trackCurrentPage).toHaveBeenCalledTimes(3)
      expect(trackCurrentPage).toHaveBeenNthCalledWith(3, {
        buildPayload: expect.any(Function),
        initialPageEvent: 'emit',
        routeKey: '/later',
      })
      expect(logError).toHaveBeenCalledTimes(logsError ? 1 : 0)

      rendered.unmount()
    },
  )

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'throws for maxWaitMs %s before provider, callback, page, onError, or timer work',
    (maxWaitMs) => {
      rs.useFakeTimers()
      const run = rs.fn()
      const onError = rs.fn()
      const trackCurrentPage = rs.spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')

      expect(() =>
        renderToString(
          createBeforeInitialPageRoot({
            beforeInitialPage: { maxWaitMs, onError, run },
          }),
        ),
      ).toThrow(new TypeError('beforeInitialPage.maxWaitMs must be a positive finite number.'))
      expect(window.contentfulOptimization).toBeUndefined()
      expect(run).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
      expect(trackCurrentPage).not.toHaveBeenCalled()
      expect(rs.getTimerCount()).toBe(0)
    },
  )

  it('suppresses page and readiness continuation after unmount', async () => {
    const callback = createDeferred<undefined>()
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const rendered = await renderClientAsync(
      createBeforeInitialPageRoot({
        beforeInitialPage: {
          run: async () => {
            await callback.promise
            return 'ready'
          },
        },
      }),
    )

    rendered.unmount()
    callback.resolve(undefined)
    await flushMicrotasks()

    expect(trackCurrentPage).not.toHaveBeenCalled()
  })

  it('does not deliberately duplicate callback or page work during StrictMode effect replay', async () => {
    const run = rs.fn(() => undefined)
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const rendered = await renderClientAsync(
      <StrictMode>{createBeforeInitialPageRoot({ beforeInitialPage: { run } })}</StrictMode>,
    )

    expect(run).toHaveBeenCalledTimes(1)
    expect(trackCurrentPage).toHaveBeenCalledTimes(2)

    rendered.unmount()
  })
})
