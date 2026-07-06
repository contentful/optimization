import { rs } from '@rstest/core'
import { act, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { resetAutoPageEmitterState } from '../auto-page/useAutoPageEmitter'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { OptimizationContext } from '../context/OptimizationContext'
import { createOptimizationSdk, defaultLiveUpdatesContext } from '../test/sdkTestUtils'
import { NextPagesAutoPageTracker, type NextPagesAutoPageContext } from './next-pages'

const routerState = {
  asPath: '/',
  isReady: true,
  pathname: '/',
  query: {},
}
let currentRouterState = routerState

rs.mock('next/router.js', () => ({
  useRouter: () => currentRouterState,
}))

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

describe('NextPagesAutoPageTracker', () => {
  void afterEach(() => {
    rs.restoreAllMocks()
  })

  void beforeEach(() => {
    resetAutoPageEmitterState()
    routerState.asPath = '/'
    routerState.isReady = true
    routerState.pathname = '/'
    routerState.query = {}
    currentRouterState = routerState
  })

  it('is exported from the router subpath module', () => {
    expect(NextPagesAutoPageTracker).toBeTypeOf('function')
  })

  it('emits once on initial ready render', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })

    const rendered = await renderTracker(<NextPagesAutoPageTracker />, sdk)

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
    const rendered = await renderTracker(<NextPagesAutoPageTracker />, sdk)

    routerState.asPath = '/products?tab=featured'
    routerState.pathname = '/products'
    routerState.query = { tab: 'featured' }

    await rendered.rerender(<NextPagesAutoPageTracker />)

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
    const rendered = await renderTracker(<NextPagesAutoPageTracker />, sdk)

    await rendered.rerender(<NextPagesAutoPageTracker />)

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })

  it('can skip only the initial ready render emission', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderTracker(<NextPagesAutoPageTracker initialPageEvent="skip" />, sdk)

    expect(page).not.toHaveBeenCalled()

    routerState.asPath = '/products'
    routerState.pathname = '/products'

    await rendered.rerender(<NextPagesAutoPageTracker initialPageEvent="skip" />)

    expect(page).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledWith({
      properties: {
        path: '/products',
        query: {},
        search: '',
        url: `${window.location.origin}/products`,
      },
    })

    await rendered.unmount()
  })

  it('waits until the router is ready', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    routerState.isReady = false

    const rendered = await renderTracker(<NextPagesAutoPageTracker />, sdk)

    expect(page).not.toHaveBeenCalled()

    routerState.isReady = true
    await rendered.rerender(<NextPagesAutoPageTracker />)

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })

  it('merges static and dynamic payloads for each emission', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const getPagePayload = rs.fn(
      ({
        asPath,
        isInitialEmission,
      }: NextPagesAutoPageContext & { isInitialEmission: boolean }) => ({
        locale: isInitialEmission ? 'en-US' : 'de-DE',
        properties: {
          path: asPath,
          source: 'dynamic',
        },
      }),
    )

    const rendered = await renderTracker(
      <NextPagesAutoPageTracker
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
        path: '/',
        query: {},
        search: '',
        source: 'dynamic',
        url: `${window.location.origin}/`,
      },
    })
    expect(getPagePayload).toHaveBeenCalledWith({
      routeKey: '/',
      pathname: '/',
      asPath: '/',
      query: {},
      router: routerState,
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
        <NextPagesAutoPageTracker />
      </StrictMode>,
      sdk,
    )

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })
})
