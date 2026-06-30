import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import React, { act, type ReactElement } from 'react'
import { loadTestRenderer } from '../test/testRenderer'
import type {
  NavigationContainerRef,
  OptimizationNavigationContainerProps,
} from './OptimizationNavigationContainer'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

rs.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: {
    get: rs.fn(() => ({ width: 375, height: 667 })),
    addEventListener: rs.fn(() => ({ remove: rs.fn() })),
  },
  NativeModules: {},
}))

rs.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: rs.fn(),
    setItem: rs.fn(),
    removeItem: rs.fn(),
  },
}))

rs.mock('@contentful/optimization-core/logger', () => ({
  logger: {
    info: rs.fn(),
    debug: rs.fn(),
    error: rs.fn(),
    warn: rs.fn(),
  },
  createScopedLogger: () => ({
    debug: rs.fn(),
    info: rs.fn(),
    log: rs.fn(),
    warn: rs.fn(),
    error: rs.fn(),
    fatal: rs.fn(),
  }),
}))

interface MockScreenEmissionResult {
  readonly accepted: boolean
  readonly data?: unknown
}

const mockTrackCurrentScreen = rs
  .fn<(payload: unknown) => Promise<MockScreenEmissionResult>>()
  .mockResolvedValue({
    accepted: true,
    data: { profile: {}, changes: [], selectedOptimizations: [] },
  })
const mockHasConsent = rs.fn((_method: string) => true)
let acceptedRouteKey: string | undefined = undefined
let inFlightRouteKey: string | undefined = undefined
function getRouteKey(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== 'object') return undefined

  const routeKey = Reflect.get(payload, 'routeKey')

  return typeof routeKey === 'string' ? routeKey : undefined
}

const mockOptimization = {
  hasConsent: mockHasConsent,
  trackCurrentScreen: async (payload: unknown) => {
    const routeKey = getRouteKey(payload)

    if (
      !mockHasConsent('screen') ||
      acceptedRouteKey === routeKey ||
      inFlightRouteKey === routeKey
    ) {
      return { accepted: false }
    }

    inFlightRouteKey = routeKey

    try {
      const result = await mockTrackCurrentScreen(payload)
      if (result.accepted) {
        acceptedRouteKey = routeKey
      }

      return result
    } finally {
      if (inFlightRouteKey === routeKey) {
        inFlightRouteKey = undefined
      }
    }
  },
}

let consentSnapshot: boolean | undefined = undefined

rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => mockOptimization,
}))

rs.mock('../hooks/useOptimizationConsentState', () => ({
  useOptimizationConsentState: () => consentSnapshot,
}))

interface TestRenderer {
  unmount: () => void
  update: (element: ReactElement) => void
}

type NavigationRenderProps = Parameters<OptimizationNavigationContainerProps['children']>[0]
type OptimizationNavigationContainerComponent =
  React.ComponentType<OptimizationNavigationContainerProps>

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolveDeferred: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve
  })

  return {
    promise,
    resolve: (value) => {
      if (!resolveDeferred) {
        throw new Error('Deferred promise was not initialized')
      }
      resolveDeferred(value)
    },
  }
}

function setCurrentRoute(
  props: NavigationRenderProps,
  route: { name: string; params?: Record<string, unknown> },
): void {
  const ref = props.ref as { current: NavigationContainerRef | null }
  ref.current = {
    getCurrentRoute: () => route,
  }
}

function createContainerElement(
  OptimizationNavigationContainer: OptimizationNavigationContainerComponent,
  captureProps: (props: NavigationRenderProps) => void,
  includeParams = false,
): ReactElement {
  return (
    <OptimizationNavigationContainer includeParams={includeParams}>
      {(props) => {
        captureProps(props)
        return null
      }}
    </OptimizationNavigationContainer>
  )
}

describe('OptimizationNavigationContainer', () => {
  let renderer: TestRenderer | undefined = undefined
  let latestProps: NavigationRenderProps | undefined = undefined

  void beforeEach(() => {
    rs.clearAllMocks()
    consentSnapshot = undefined
    acceptedRouteKey = undefined
    inFlightRouteKey = undefined
    mockHasConsent.mockReturnValue(true)
    mockTrackCurrentScreen.mockResolvedValue({
      accepted: true,
      data: { profile: {}, changes: [], selectedOptimizations: [] },
    })
    latestProps = undefined
  })

  void afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount()
      })
      renderer = undefined
    }
  })

  function getProps(): NavigationRenderProps {
    if (!latestProps) {
      throw new Error('Expected navigation props to be captured')
    }

    return latestProps
  }

  async function renderContainer(
    OptimizationNavigationContainer: OptimizationNavigationContainerComponent,
  ): Promise<void> {
    const testRenderer = await loadTestRenderer<TestRenderer>()

    await act(async () => {
      renderer = testRenderer.create(
        createContainerElement(OptimizationNavigationContainer, (props) => {
          latestProps = props
        }),
      )
      await flushPromises()
    })
  }

  async function updateContainer(
    OptimizationNavigationContainer: OptimizationNavigationContainerComponent,
  ): Promise<void> {
    await act(async () => {
      renderer?.update(
        createContainerElement(OptimizationNavigationContainer, (props) => {
          latestProps = props
        }),
      )
      await flushPromises()
    })
  }

  it('builds distinct route keys only when params are included', async () => {
    const { createScreenTrackingDescriptor } = await import('./OptimizationNavigationContainer')

    expect(createScreenTrackingDescriptor('Product', { id: '1' }, false)).toEqual({
      routeKey: 'Product',
      properties: { name: 'Product' },
    })
    expect(createScreenTrackingDescriptor('Product', { id: '1' }, true)).toEqual({
      routeKey: 'Product:{"id":"1"}',
      properties: { name: 'Product', params: { id: '1' } },
    })
    expect(createScreenTrackingDescriptor('Product', { id: '2' }, true).routeKey).toBe(
      'Product:{"id":"2"}',
    )
  })

  it('emits the current route once when screen tracking becomes allowed after ready', async () => {
    const { OptimizationNavigationContainer } = await import('./OptimizationNavigationContainer')

    consentSnapshot = false
    mockHasConsent.mockReturnValue(false)
    await renderContainer(OptimizationNavigationContainer)

    setCurrentRoute(getProps(), { name: 'Home' })

    await act(async () => {
      getProps().onReady()
      await flushPromises()
    })

    expect(mockTrackCurrentScreen).not.toHaveBeenCalled()

    consentSnapshot = true
    mockHasConsent.mockReturnValue(true)
    await updateContainer(OptimizationNavigationContainer)

    expect(mockTrackCurrentScreen).toHaveBeenCalledTimes(1)
    expect(mockTrackCurrentScreen).toHaveBeenCalledWith({
      routeKey: 'Home',
      name: 'Home',
      properties: { name: 'Home' },
      screen: { name: 'Home' },
    })

    consentSnapshot = undefined
    await updateContainer(OptimizationNavigationContainer)

    expect(mockTrackCurrentScreen).toHaveBeenCalledTimes(1)
  })

  it('retries the current route when the previous emission was not accepted', async () => {
    const { OptimizationNavigationContainer } = await import('./OptimizationNavigationContainer')

    mockTrackCurrentScreen
      .mockResolvedValueOnce({ accepted: false, data: undefined })
      .mockResolvedValueOnce({
        accepted: true,
        data: { profile: {}, changes: [], selectedOptimizations: [] },
      })

    await renderContainer(OptimizationNavigationContainer)
    setCurrentRoute(getProps(), { name: 'Home' })

    await act(async () => {
      getProps().onReady()
      await flushPromises()
    })

    expect(mockTrackCurrentScreen).toHaveBeenCalledTimes(1)

    consentSnapshot = true
    await updateContainer(OptimizationNavigationContainer)

    expect(mockTrackCurrentScreen).toHaveBeenCalledTimes(2)
  })

  it('does not duplicate a current route while its screen event is in flight', async () => {
    const { OptimizationNavigationContainer } = await import('./OptimizationNavigationContainer')
    const deferred = createDeferred<{
      accepted: boolean
      data: { profile: object; changes: unknown[]; selectedOptimizations: unknown[] }
    }>()

    mockTrackCurrentScreen.mockReturnValueOnce(deferred.promise)

    await renderContainer(OptimizationNavigationContainer)
    setCurrentRoute(getProps(), { name: 'Home' })

    act(() => {
      getProps().onReady()
    })

    expect(mockTrackCurrentScreen).toHaveBeenCalledTimes(1)

    consentSnapshot = true
    await updateContainer(OptimizationNavigationContainer)

    expect(mockTrackCurrentScreen).toHaveBeenCalledTimes(1)

    await act(async () => {
      deferred.resolve({
        accepted: true,
        data: { profile: {}, changes: [], selectedOptimizations: [] },
      })
      await flushPromises()
    })
  })
})
