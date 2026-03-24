import { rs } from '@rstest/core'
import { act, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { resetAutoPageEmitterState } from '../auto-page/useAutoPageEmitter'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { OptimizationContext } from '../context/OptimizationContext'
import { createOptimizationSdk, defaultLiveUpdatesContext } from '../test/sdkTestUtils'
import { ReactRouterAutoPageTracker, type ReactRouterAutoPageContext } from './react-router'

const locationState = {
  hash: '',
  key: 'default',
  pathname: '/',
  search: '',
  state: null,
}
const matchesState = [] as Array<{ id: string; pathname: string }>

rs.mock('react-router-dom', () => ({
  useLocation: () => locationState,
  useMatches: () => matchesState,
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

describe('ReactRouterAutoPageTracker', () => {
  void afterEach(() => {
    rs.restoreAllMocks()
  })

  void beforeEach(() => {
    resetAutoPageEmitterState()
    locationState.hash = ''
    locationState.key = 'default'
    locationState.pathname = '/'
    locationState.search = ''
    locationState.state = null
    matchesState.length = 0
  })

  it('is exported from the router subpath module', () => {
    expect(ReactRouterAutoPageTracker).toBeTypeOf('function')
  })

  it('emits on initial render and route changes', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderTracker(<ReactRouterAutoPageTracker />, sdk)

    expect(page).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenNthCalledWith(1, {})

    locationState.pathname = '/products'
    locationState.search = '?tab=featured'
    locationState.hash = '#hero'
    locationState.key = 'products'
    matchesState.splice(0, matchesState.length, { id: 'products', pathname: '/products' })

    await rendered.rerender(<ReactRouterAutoPageTracker />)

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
    const rendered = await renderTracker(
      <StrictMode>
        <ReactRouterAutoPageTracker />
      </StrictMode>,
      sdk,
    )

    expect(page).toHaveBeenCalledTimes(1)

    locationState.key = 'same-url-different-history-entry'
    await rendered.rerender(
      <StrictMode>
        <ReactRouterAutoPageTracker />
      </StrictMode>,
    )

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })

  it('merges static and dynamic payloads with route-aware context', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    locationState.pathname = '/products'
    locationState.search = '?tab=featured'
    locationState.hash = '#hero'
    matchesState.splice(
      0,
      matchesState.length,
      { id: 'root', pathname: '/' },
      { id: 'products', pathname: '/products' },
    )
    const getPagePayload = rs.fn(
      ({
        url,
        matches,
        isInitialEmission,
      }: ReactRouterAutoPageContext & { isInitialEmission: boolean }) => ({
        locale: isInitialEmission ? 'en-US' : 'de-DE',
        properties: {
          matchCount: matches.length,
          path: url,
          source: 'dynamic',
        },
      }),
    )

    const rendered = await renderTracker(
      <ReactRouterAutoPageTracker
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
      sdk,
    )

    expect(page).toHaveBeenCalledWith({
      locale: 'en-US',
      properties: {
        campaign: 'spring',
        matchCount: 2,
        path: '/products?tab=featured#hero',
        source: 'dynamic',
      },
    })
    expect(getPagePayload).toHaveBeenCalledWith({
      hash: '#hero',
      location: locationState,
      matches: matchesState,
      pathname: '/products',
      routeKey: '/products?tab=featured#hero',
      search: '?tab=featured',
      url: '/products?tab=featured#hero',
      isInitialEmission: true,
    })

    await rendered.unmount()
  })
})
