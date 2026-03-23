import { rs } from '@rstest/core'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, StrictMode, type ReactElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { resetAutoPageEmitterState } from '../auto-page/useAutoPageEmitter'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { OptimizationContext } from '../context/OptimizationContext'
import { createOptimizationSdk, defaultLiveUpdatesContext } from '../test/sdkTestUtils'
import {
  TanStackRouterAutoPageTracker,
  type TanStackRouterAutoPageContext,
} from './tanstack-router'

async function renderRouter(node: ReactNode): Promise<{
  rerender: (nextNode: ReactNode) => Promise<void>
  unmount: () => Promise<void>
}> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  async function render(nextNode: ReactNode): Promise<void> {
    await act(async () => {
      await Promise.resolve()
      root.render(nextNode)
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

async function createTestRouter(
  sdk: ReturnType<typeof createOptimizationSdk>,
  tracker: ReactNode = <TanStackRouterAutoPageTracker />,
  initialEntry = '/',
): Promise<TestRouter> {
  const router = buildTestRouter(sdk, tracker, initialEntry)

  await router.load()

  return router
}

function buildTestRouter(
  sdk: ReturnType<typeof createOptimizationSdk>,
  tracker: ReactNode,
  initialEntry: string,
): ReturnType<typeof createRouter> {
  function RootLayout(): ReactElement {
    return (
      <OptimizationContext.Provider value={{ sdk, isReady: true, error: undefined }}>
        <LiveUpdatesContext.Provider value={defaultLiveUpdatesContext()}>
          {tracker}
          <Outlet />
        </LiveUpdatesContext.Provider>
      </OptimizationContext.Provider>
    )
  }

  const rootRoute = createRootRoute({
    component: RootLayout,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const productsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/products',
    component: () => null,
  })
  const routeTree = rootRoute.addChildren([indexRoute, productsRoute])
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  return createRouter({ routeTree, history })
}

type TestRouter = ReturnType<typeof buildTestRouter>

async function navigateTo(router: TestRouter, path: string): Promise<void> {
  await act(async () => {
    router.history.push(path)
    await router.load()
  })
}

describe('TanStackRouterAutoPageTracker', () => {
  void beforeEach(() => {
    resetAutoPageEmitterState()
  })

  it('is exported from the router subpath module', () => {
    expect(TanStackRouterAutoPageTracker).toBeTypeOf('function')
  })

  it('emits on initial render and route changes', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const router = await createTestRouter(sdk)
    const rendered = await renderRouter(<RouterProvider router={router} />)

    expect(page).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenNthCalledWith(1, {})

    await navigateTo(router, '/products?tab=featured#hero')

    expect(page).toHaveBeenCalledTimes(2)
    expect(page).toHaveBeenNthCalledWith(2, {})

    await rendered.unmount()
  })

  it('suppresses duplicate consecutive route keys and StrictMode remounts', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const router = await createTestRouter(sdk)
    const rendered = await renderRouter(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    )

    expect(page).toHaveBeenCalledTimes(1)

    await navigateTo(router, '/')

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })

  it('merges static and dynamic payloads with route-aware context', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const captured = {
      current: undefined as
        | (TanStackRouterAutoPageContext & { isInitialEmission: boolean })
        | undefined,
    }
    const getPagePayload = rs.fn(
      (context: TanStackRouterAutoPageContext & { isInitialEmission: boolean }) => {
        captured.current = context
        const { url, matches, isInitialEmission } = context

        return {
          locale: isInitialEmission ? 'en-US' : 'de-DE',
          properties: {
            matchCount: matches.length,
            path: url,
            source: 'dynamic',
          },
        }
      },
    )
    const router = await createTestRouter(
      sdk,
      <TanStackRouterAutoPageTracker
        pagePayload={{
          locale: 'fr-FR',
          properties: {
            campaign: 'spring',
            path: '/static',
            source: 'static',
          },
        }}
        getPagePayload={(context) =>
          getPagePayload({ ...context.context, isInitialEmission: context.isInitialEmission })
        }
      />,
      '/products?tab=featured#hero',
    )

    const rendered = await renderRouter(<RouterProvider router={router} />)
    const {
      state: { location, matches },
    } = router

    expect(page).toHaveBeenCalledWith({
      locale: 'en-US',
      properties: {
        campaign: 'spring',
        matchCount: matches.length,
        path: location.href,
        source: 'dynamic',
      },
    })
    if (captured.current === undefined) {
      throw new Error('Expected getPagePayload to be called')
    }

    expect(captured.current).toMatchObject({
      hash: location.hash,
      location,
      pathname: location.pathname,
      routeKey: location.href,
      router,
      search: location.searchStr,
      url: location.href,
      isInitialEmission: true,
    })
    expect(captured.current.matches).toHaveLength(matches.length)

    await rendered.unmount()
  })
})
