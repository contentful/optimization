import { afterEach, describe, expect, it, rs } from '@rstest/core'
import React, { act, type ReactElement } from 'react'
import type ContentfulOptimization from '../ContentfulOptimization'
import type { OptimizationSdk } from '../OptimizationSdk'
import { loadTestRenderer } from '../test/testRenderer'

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

// The OptimizationProvider only touches the SdkStub-shaped subset of
// ContentfulOptimization in this test. The predicate validates that subset
// at runtime so the type narrowing isn't a blind assertion.
function isContentfulOptimization(value: SdkStub): value is SdkStub & ContentfulOptimization {
  return (
    typeof value.destroy === 'function' &&
    typeof value.states.eventStream.subscribe === 'function' &&
    typeof value.states.eventStream.subscribeOnce === 'function'
  )
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
    const testRenderer = await loadTestRenderer<TestRenderer>()
    let capturedSdk: OptimizationSdk | undefined = undefined
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
    const testRenderer = await loadTestRenderer<TestRenderer>()

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
