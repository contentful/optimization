import { rs } from '@rstest/core'
import { act, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { resetAutoPageEmitterState } from '../auto-page/useAutoPageEmitter'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { OptimizationContext } from '../context/OptimizationContext'
import { createOptimizationSdk, defaultLiveUpdatesContext } from '../test/sdkTestUtils'
import { NextAppAutoPageTracker, type NextAppAutoPageContext } from './next-app'

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

rs.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => currentRouterState,
  useSearchParams: () => currentSearchParams,
}))

const routeState = {
  pathname: '/',
  searchParams: new URLSearchParams(),
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
        <OptimizationContext.Provider value={{ sdk, isReady: true, error: undefined }}>
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

describe('NextAppAutoPageTracker', () => {
  void afterEach(() => {
    rs.restoreAllMocks()
  })

  void beforeEach(() => {
    resetAutoPageEmitterState()
    routeState.pathname = '/'
    routeState.searchParams = new URLSearchParams()
    const { pathname, searchParams } = routeState
    currentPathname = pathname
    currentRouterState = routerState
    currentSearchParams = searchParams
  })

  it('is exported from the router subpath module', () => {
    expect(NextAppAutoPageTracker).toBeTypeOf('function')
  })

  it('emits once on initial render', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })

    const rendered = await renderTracker(<NextAppAutoPageTracker />, sdk)

    expect(page).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledWith({})

    await rendered.unmount()
  })

  it('emits again when the route key changes', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderTracker(<NextAppAutoPageTracker />, sdk)

    routeState.pathname = '/products'
    routeState.searchParams = new URLSearchParams('tab=featured')
    const { pathname, searchParams } = routeState
    currentPathname = pathname
    currentSearchParams = searchParams

    await rendered.rerender(<NextAppAutoPageTracker />)

    expect(page).toHaveBeenCalledTimes(2)
    expect(page).toHaveBeenNthCalledWith(2, {})

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

  it('merges static and dynamic payloads for each emission', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    routeState.pathname = '/products'
    routeState.searchParams = new URLSearchParams('tab=featured')
    const { pathname, searchParams } = routeState
    currentPathname = pathname
    currentSearchParams = searchParams
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
        path: '/products?tab=featured',
        source: 'dynamic',
        campaign: 'spring',
      },
    })
    expect(getPagePayload).toHaveBeenCalledWith({
      routeKey: '/products?tab=featured',
      pathname: '/products',
      router: routerState,
      search: '?tab=featured',
      searchParams: routeState.searchParams,
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
