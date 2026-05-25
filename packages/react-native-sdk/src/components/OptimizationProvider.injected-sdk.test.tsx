import { afterEach, describe, expect, it, rs } from '@rstest/core'
import React, { act, type ReactElement } from 'react'
import type ContentfulOptimization from '../ContentfulOptimization'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const createOptimization = rs.fn()

rs.mock('../ContentfulOptimization', () => ({
  default: {
    create: createOptimization,
  },
}))

interface TestRenderer {
  unmount: () => void
  update: (element: ReactElement) => void
}

interface TestRendererModule {
  create: (element: ReactElement) => TestRenderer
}

interface Subscription {
  unsubscribe: () => void
}

interface SdkStub {
  destroy: () => void
  states: {
    eventStream: {
      current: undefined
      subscribe: () => Subscription
      subscribeOnce: () => Subscription
    }
  }
}

function isContentfulOptimization(
  value: SdkStub,
): value is SdkStub & ContentfulOptimization {
  void value
  return true
}

function isTestRendererModule(value: unknown): value is TestRendererModule {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return typeof Reflect.get(value, 'create') === 'function'
}

async function loadTestRenderer(): Promise<TestRendererModule> {
  const moduleName = 'react-test-renderer'
  const testRendererModule: unknown = await import(moduleName)

  if (!isTestRendererModule(testRendererModule)) {
    throw new Error('Expected react-test-renderer to expose create().')
  }

  return testRendererModule
}

function createSdk(): ContentfulOptimization {
  const sdk: SdkStub = {
    destroy: rs.fn(),
    states: {
      eventStream: {
        current: undefined,
        subscribe(): Subscription {
          return { unsubscribe: () => undefined }
        },
        subscribeOnce(): Subscription {
          return { unsubscribe: () => undefined }
        },
      },
    },
  }

  if (!isContentfulOptimization(sdk)) {
    throw new Error('Expected SDK stub to satisfy ContentfulOptimization')
  }

  return sdk
}

describe('OptimizationProvider injected SDK performance', () => {
  let renderer: TestRenderer | undefined = undefined

  void afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount()
      })
      renderer = undefined
    }

    rs.restoreAllMocks()
  })

  it('renders children during initial render when no state setup is needed', async () => {
    const [{ OptimizationProvider }, { useOptimization }] = await Promise.all([
      import('./OptimizationProvider'),
      import('../context/OptimizationContext'),
    ])
    const injectedSdk = createSdk()
    const testRenderer = await loadTestRenderer()
    let capturedSdk: ContentfulOptimization | undefined = undefined
    let childRendered = false

    function Probe(): null {
      childRendered = true
      capturedSdk = useOptimization()
      return null
    }

    act(() => {
      renderer = testRenderer.create(
        <OptimizationProvider sdk={injectedSdk}>
          <Probe />
        </OptimizationProvider>,
      )
    })

    expect(childRendered).toBe(true)
    expect(capturedSdk).toBe(injectedSdk)
    expect(createOptimization).not.toHaveBeenCalled()
  })

  it('preserves context identity across unchanged provider rerenders', async () => {
    const [{ OptimizationProvider }, { default: OptimizationContext }] = await Promise.all([
      import('./OptimizationProvider'),
      import('../context/OptimizationContext'),
    ])
    const injectedSdk = createSdk()
    const capturedContexts: unknown[] = []
    const testRenderer = await loadTestRenderer()

    function Probe(): null {
      capturedContexts.push(React.useContext(OptimizationContext))
      return null
    }

    act(() => {
      renderer = testRenderer.create(
        <OptimizationProvider sdk={injectedSdk}>
          <Probe />
        </OptimizationProvider>,
      )
    })

    act(() => {
      renderer?.update(
        <OptimizationProvider sdk={injectedSdk}>
          <Probe />
        </OptimizationProvider>,
      )
    })

    expect(capturedContexts).toHaveLength(2)
    expect(capturedContexts[1]).toBe(capturedContexts[0])
  })
})
