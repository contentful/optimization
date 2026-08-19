import ContentfulOptimization from '@contentful/optimization-web'
import { rs } from '@rstest/core'
import { act, StrictMode, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { resetAutoPageEmitterState } from '../auto-page/useAutoPageEmitter'
import type { BeforeInitialPageOptions } from '../before-initial-page/beforeInitialPage'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { OptimizationContext } from '../context/OptimizationContext'
import { OptimizationRoot } from '../root/OptimizationRoot'
import { createOptimizationSdk, defaultLiveUpdatesContext } from '../test/sdkTestUtils'
import {
  NextAppAutoPageTracker,
  useNextAppAutoPageInputs,
  type NextAppAutoPageContext,
} from './next-app'

const routerState = {
  back: () => undefined,
  forward: () => undefined,
  prefetch: async () => {
    await Promise.resolve()
  },
  push: () => undefined,
  refresh: () => undefined,
  replace: () => undefined,
} as const
let currentPathname = '/'
let currentRouterState = routerState
let currentSearchParams = new URLSearchParams()

rs.mock('next/navigation.js', () => ({
  usePathname: () => currentPathname,
  useRouter: () => currentRouterState,
  useSearchParams: () => currentSearchParams,
}))

function setCurrentRoute(
  pathname: string,
  searchParams = new URLSearchParams(),
  updateBrowserLocation = true,
): void {
  currentPathname = pathname
  currentSearchParams = searchParams

  if (updateBrowserLocation) {
    const search = searchParams.toString()
    window.history.replaceState(null, '', `${pathname}${search.length > 0 ? `?${search}` : ''}`)
  }
}

async function renderTracker(
  node: ReactNode,
  sdk: ReturnType<typeof createOptimizationSdk>,
): Promise<{
  rerender: (nextNode: ReactNode) => Promise<void>
  unmount: () => Promise<void>
}> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  async function render(nextNode: ReactNode): Promise<void> {
    await act(async () => {
      await Promise.resolve()
      root.render(
        <OptimizationContext.Provider value={{ sdk, error: undefined }}>
          <LiveUpdatesContext.Provider value={defaultLiveUpdatesContext()}>
            {nextNode}
          </LiveUpdatesContext.Provider>
        </OptimizationContext.Provider>,
      )
    })
  }

  await render(node)

  return {
    rerender: render,
    async unmount(): Promise<void> {
      await act(async () => {
        await Promise.resolve()
        root.unmount()
      })
      container.remove()
    },
  }
}

function AutoPageInputsProbe({
  browserCommitHref,
  onInputs,
}: {
  readonly browserCommitHref?: string
  readonly onInputs: (inputs: ReturnType<typeof useNextAppAutoPageInputs>) => void
}): null {
  const inputs = useNextAppAutoPageInputs()

  useLayoutEffect(() => {
    if (browserCommitHref !== undefined) {
      window.history.replaceState(null, '', browserCommitHref)
    }
  }, [browserCommitHref])

  useEffect(() => {
    onInputs(inputs)
  }, [inputs.buildPagePayload, inputs.routeKey, onInputs])

  return null
}

function BeforeInitialPageRequestRoot({
  beforeInitialPage,
}: {
  readonly beforeInitialPage: BeforeInitialPageOptions
}): ReactNode {
  const { buildPagePayload, routeKey } = useNextAppAutoPageInputs()

  return (
    <OptimizationRoot
      api={{
        experienceBaseUrl: 'http://localhost:8000/experience/',
        insightsBaseUrl: 'http://localhost:8000/insights/',
      }}
      buildPagePayload={buildPagePayload}
      clientId="test-client-id"
      environment="main"
      beforeInitialPage={beforeInitialPage}
      routeKey={routeKey}
    >
      <div />
    </OptimizationRoot>
  )
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

describe('NextAppAutoPageTracker', () => {
  void afterEach(() => {
    rs.restoreAllMocks()
  })

  void beforeEach(() => {
    resetAutoPageEmitterState()
    setCurrentRoute('/')
    currentRouterState = routerState
  })

  it('is exported from the router subpath module', () => {
    expect(NextAppAutoPageTracker).toBeTypeOf('function')
    expect(useNextAppAutoPageInputs).toBeTypeOf('function')
  })

  it('derives lazy route inputs without emitting a page', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const onInputs = rs.fn<(inputs: ReturnType<typeof useNextAppAutoPageInputs>) => void>()
    setCurrentRoute('/products', new URLSearchParams('tab=featured'))

    const rendered = await renderTracker(<AutoPageInputsProbe onInputs={onInputs} />, sdk)
    const firstInputs = onInputs.mock.calls.at(-1)?.[0]

    expect(firstInputs?.routeKey).toBe('/products?tab=featured')
    expect(firstInputs?.buildPagePayload({ isInitialEmission: true })).toEqual({
      properties: {
        path: '/products',
        query: { tab: 'featured' },
        search: '?tab=featured',
        url: `${window.location.origin}/products?tab=featured`,
      },
    })
    expect(page).not.toHaveBeenCalled()

    setCurrentRoute('/products/new', new URLSearchParams('ref=nav'))
    await rendered.rerender(<AutoPageInputsProbe onInputs={onInputs} />)

    const nextInputs = onInputs.mock.calls.at(-1)?.[0]
    expect(nextInputs?.routeKey).toBe('/products/new?ref=nav')
    expect(nextInputs?.buildPagePayload({ isInitialEmission: false })).toEqual({
      properties: {
        path: '/products/new',
        query: { ref: 'nav' },
        search: '?ref=nav',
        url: `${window.location.origin}/products/new?ref=nav`,
      },
    })
    expect(nextInputs?.buildPagePayload).not.toBe(firstInputs?.buildPagePayload)
    expect(page).not.toHaveBeenCalled()

    await rendered.unmount()
  })

  it('adopts a route whose browser URL commits after the router render', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const onInputs = rs.fn<(inputs: ReturnType<typeof useNextAppAutoPageInputs>) => void>()
    const rendered = await renderTracker(<AutoPageInputsProbe onInputs={onInputs} />, sdk)

    setCurrentRoute('/products', new URLSearchParams('tab=featured'), false)
    await rendered.rerender(
      <AutoPageInputsProbe browserCommitHref="/products?tab=featured" onInputs={onInputs} />,
    )

    const inputs = onInputs.mock.calls.at(-1)?.[0]
    expect(inputs?.routeKey).toBe('/products?tab=featured')
    expect(inputs?.buildPagePayload({ isInitialEmission: false })).toEqual({
      properties: {
        path: '/products',
        query: { tab: 'featured' },
        search: '?tab=featured',
        url: `${window.location.origin}/products?tab=featured`,
      },
    })
    expect(page).not.toHaveBeenCalled()

    await rendered.unmount()
  })

  it('keeps a percent-encoded browser route during stale hook replay', async () => {
    const sdk = createOptimizationSdk()
    const onInputs = rs.fn<(inputs: ReturnType<typeof useNextAppAutoPageInputs>) => void>()
    currentPathname = '/search'
    currentSearchParams = new URLSearchParams('q=hello%20world')
    window.history.replaceState(null, '', '/search?q=hello%20world')

    const rendered = await renderTracker(<AutoPageInputsProbe onInputs={onInputs} />, sdk)

    expect(window.location.search).toBe('?q=hello%20world')
    expect(onInputs.mock.calls.at(-1)?.[0].routeKey).toBe('/search?q=hello+world')

    setCurrentRoute('/stale', new URLSearchParams('q=older'), false)
    await rendered.rerender(<AutoPageInputsProbe onInputs={onInputs} />)

    const inputs = onInputs.mock.calls.at(-1)?.[0]
    expect(inputs?.routeKey).toBe('/search?q=hello+world')
    expect(inputs?.buildPagePayload({ isInitialEmission: false })).toEqual({
      properties: {
        path: '/search',
        query: { q: 'hello world' },
        search: '?q=hello+world',
        url: `${window.location.origin}/search?q=hello+world`,
      },
    })

    await rendered.unmount()
  })

  it('keeps the attempted latest route across readiness without suppressing a later route', async () => {
    const callback = createDeferred<undefined>()
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const beforeInitialPage = {
      run: async () => {
        await callback.promise
      },
    }
    setCurrentRoute('/page-two', new URLSearchParams('beforeInitialPage=readiness'))
    const rendered = await renderTracker(
      <BeforeInitialPageRequestRoot beforeInitialPage={beforeInitialPage} />,
      createOptimizationSdk(),
    )

    setCurrentRoute('/')
    await rendered.rerender(<BeforeInitialPageRequestRoot beforeInitialPage={beforeInitialPage} />)
    callback.resolve(undefined)
    await act(async () => {
      await callback.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(trackCurrentPage).toHaveBeenCalledTimes(2)
    expect(trackCurrentPage).toHaveBeenNthCalledWith(1, {
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/',
    })
    expect(trackCurrentPage).toHaveBeenNthCalledWith(2, {
      initialPageEvent: 'skip',
      routeKey: '/',
    })

    setCurrentRoute('/page-two', new URLSearchParams('beforeInitialPage=readiness'), false)
    await rendered.rerender(<BeforeInitialPageRequestRoot beforeInitialPage={beforeInitialPage} />)
    expect(trackCurrentPage).toHaveBeenCalledTimes(2)

    setCurrentRoute('/page-two')
    await rendered.rerender(<BeforeInitialPageRequestRoot beforeInitialPage={beforeInitialPage} />)
    expect(trackCurrentPage).toHaveBeenCalledTimes(3)
    expect(trackCurrentPage).toHaveBeenNthCalledWith(3, {
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/page-two',
    })

    await rendered.unmount()
  })

  it('emits once on initial render', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })

    const rendered = await renderTracker(<NextAppAutoPageTracker />, sdk)

    expect(page).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledWith({
      properties: {
        path: '/',
        query: {},
        search: '',
        url: `${window.location.origin}/`,
      },
    })

    await rendered.unmount()
  })

  it('emits again when the route key changes', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderTracker(<NextAppAutoPageTracker />, sdk)

    setCurrentRoute('/products', new URLSearchParams('tab=featured'))

    await rendered.rerender(<NextAppAutoPageTracker />)

    expect(page).toHaveBeenCalledTimes(2)
    expect(page).toHaveBeenNthCalledWith(2, {
      properties: {
        path: '/products',
        query: { tab: 'featured' },
        search: '?tab=featured',
        url: `${window.location.origin}/products?tab=featured`,
      },
    })

    await rendered.unmount()
  })

  it('suppresses duplicate consecutive route keys', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderTracker(<NextAppAutoPageTracker />, sdk)

    await rendered.rerender(<NextAppAutoPageTracker />)

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })

  it('skips only the initial route when server rendering already emitted its page event', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderTracker(<NextAppAutoPageTracker initialPageEvent="skip" />, sdk)

    expect(page).not.toHaveBeenCalled()

    setCurrentRoute('/products')

    await rendered.rerender(<NextAppAutoPageTracker initialPageEvent="skip" />)

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.rerender(<NextAppAutoPageTracker />)

    expect(page).toHaveBeenCalledTimes(1)

    setCurrentRoute('/')

    await rendered.rerender(<NextAppAutoPageTracker initialPageEvent="skip" />)

    expect(page).toHaveBeenCalledTimes(2)

    await rendered.unmount()
  })

  it('merges static and dynamic payloads for each emission', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    setCurrentRoute('/products', new URLSearchParams('tab=featured'))
    const getPagePayload = rs.fn(
      ({ url, isInitialEmission }: NextAppAutoPageContext & { isInitialEmission: boolean }) => ({
        locale: isInitialEmission ? 'en-US' : 'de-DE',
        properties: {
          path: url,
          source: 'dynamic',
        },
      }),
    )

    const rendered = await renderTracker(
      <NextAppAutoPageTracker
        pagePayload={{
          locale: 'fr-FR',
          properties: {
            path: '/static',
            source: 'static',
            campaign: 'spring',
          },
        }}
        getPagePayload={(context) =>
          getPagePayload({ ...context.context, isInitialEmission: context.isInitialEmission })
        }
      />,
      sdk,
    )

    expect(page).toHaveBeenCalledWith({
      locale: 'en-US',
      properties: {
        campaign: 'spring',
        path: '/products?tab=featured',
        query: { tab: 'featured' },
        search: '?tab=featured',
        source: 'dynamic',
        url: `${window.location.origin}/products?tab=featured`,
      },
    })
    expect(getPagePayload).toHaveBeenCalledWith({
      routeKey: '/products?tab=featured',
      pathname: '/products',
      router: routerState,
      search: '?tab=featured',
      searchParams: currentSearchParams,
      url: '/products?tab=featured',
      isInitialEmission: true,
    })

    await rendered.unmount()
  })

  it('suppresses StrictMode duplicate mount emission for the same route key', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })

    const rendered = await renderTracker(
      <StrictMode>
        <NextAppAutoPageTracker />
      </StrictMode>,
      sdk,
    )

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })
})
