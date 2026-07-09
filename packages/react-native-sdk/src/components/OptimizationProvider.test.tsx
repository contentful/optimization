import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import React, { act, useEffect, type ReactElement } from 'react'
import type ContentfulOptimization from '../ContentfulOptimization'
import type { OptimizationSdk } from '../OptimizationSdk'
import { loadTestRenderer } from '../test/testRenderer'
import type { OptimizationProviderProps } from './OptimizationProvider'
import type { OptimizationRootProps } from './OptimizationRoot'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const createOptimization = rs.fn()

rs.mock('../ContentfulOptimization', () => ({
  default: {
    create: createOptimization,
  },
}))

rs.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: rs.fn(),
    multiGet: rs.fn().mockResolvedValue([]),
    removeItem: rs.fn(),
    setItem: rs.fn(),
  },
}))

interface Deferred<T> {
  promise: Promise<T>
  reject: (error: unknown) => void
  resolve: (value: T) => void
}

interface Subscription {
  unsubscribe: () => void
}

interface TestRenderer {
  toJSON: () => unknown
  unmount: () => void
  update: (element: ReactElement) => void
}

type EventStream = ContentfulOptimization['states']['eventStream']
type EventPayload = NonNullable<EventStream['current']>
type TestSdk = Pick<
  ContentfulOptimization,
  'destroy' | 'prefetchManagedEntries' | 'screen' | 'setLocale'
> & {
  states: Pick<ContentfulOptimization['states'], 'eventStream'>
}

interface ErrorBoundaryProps {
  children: ReactElement
  onError: (error: Error) => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error)
  }

  render(): React.ReactNode {
    return this.state.hasError ? null : this.props.children
  }
}

function createDeferred<T>(): Deferred<T> {
  const { promise, reject, resolve } = Promise.withResolvers<T>()
  return { promise, reject, resolve }
}

function createEventStream(): {
  emit: (event: EventStream['current']) => void
  observable: EventStream
} {
  type EventSubscriber = Parameters<EventStream['subscribe']>[0]

  const subscribers = new Set<EventSubscriber>()

  return {
    emit(event) {
      subscribers.forEach((subscriber) => {
        subscriber(event)
      })
    },
    observable: {
      current: undefined,
      subscribe(next) {
        subscribers.add(next)
        next(undefined)

        return {
          unsubscribe() {
            subscribers.delete(next)
          },
        }
      },
      subscribeOnce(): Subscription {
        return { unsubscribe: () => undefined }
      },
    },
  }
}

function createSdk(): {
  emitEvent: (event: EventStream['current']) => void
  sdk: TestSdk
  screenEvent: EventPayload
  teardownOrder: string[]
} {
  const eventStream = createEventStream()
  const timestamp = '2024-01-01T00:00:00.000Z'
  const screenEvent: EventPayload = {
    channel: 'mobile',
    context: {
      campaign: {},
      gdpr: { isConsentGiven: true },
      library: {
        name: '@contentful/optimization-react-native',
        version: '0.0.0',
      },
      locale: 'en-US',
      screen: { name: 'Home' },
    },
    messageId: 'message-id',
    name: 'Home',
    originalTimestamp: timestamp,
    properties: {},
    sentAt: timestamp,
    timestamp,
    type: 'screen',
  }
  const teardownOrder: string[] = []
  const sdk = {
    destroy: () => {
      teardownOrder.push('destroy')
    },
    prefetchManagedEntries: rs.fn(async () => await Promise.resolve([])),
    setLocale: () => undefined,
    screen: async () => {
      eventStream.emit(screenEvent)
      await Promise.resolve()
      return { accepted: true }
    },
    states: {
      eventStream: eventStream.observable,
    },
  }

  return {
    emitEvent: eventStream.emit,
    sdk,
    screenEvent,
    teardownOrder,
  }
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function requireRenderer(value: TestRenderer | undefined): TestRenderer {
  if (!value) {
    throw new Error('Expected renderer to be created')
  }

  return value
}

function requireError(value: Error | undefined): Error {
  if (!value) {
    throw new Error('Expected error to be captured')
  }

  return value
}

// The OptimizationProvider only touches the TestSdk-shaped subset of
// ContentfulOptimization in this test. The predicate validates that subset
// at runtime so the type narrowing isn't a blind assertion.
function isContentfulOptimization(value: TestSdk): value is TestSdk & ContentfulOptimization {
  return (
    typeof value.destroy === 'function' &&
    typeof value.prefetchManagedEntries === 'function' &&
    typeof value.screen === 'function' &&
    typeof value.setLocale === 'function' &&
    typeof value.states.eventStream.subscribe === 'function'
  )
}

function createContentfulOptimizationStub(sdk: TestSdk): ContentfulOptimization {
  if (!isContentfulOptimization(sdk)) {
    throw new Error('Expected SDK stub to satisfy ContentfulOptimization')
  }
  return sdk
}

async function renderWithAct(element: ReactElement): Promise<TestRenderer> {
  const testRenderer = await loadTestRenderer<TestRenderer>()
  let nextRenderer: TestRenderer | undefined = undefined

  await act(async () => {
    nextRenderer = testRenderer.create(element)
    await Promise.resolve()
    await Promise.resolve()
  })

  return requireRenderer(nextRenderer)
}

describe('OptimizationProvider onStatesReady', () => {
  let renderer: TestRenderer | undefined = undefined

  void beforeEach(() => {
    renderer = undefined
    createOptimization.mockReset()
  })

  void afterEach(async () => {
    if (renderer) {
      await act(async () => {
        renderer?.unmount()
        await Promise.resolve()
      })
    }
    rs.restoreAllMocks()
  })

  it('registers state subscribers before child effects emit screen events', async () => {
    const [{ OptimizationProvider }, { useOptimization }] = await Promise.all([
      import('./OptimizationProvider'),
      import('../context/OptimizationContext'),
    ])
    const { sdk, screenEvent } = createSdk()
    const observedEvents: unknown[] = []
    const order: string[] = []
    createOptimization.mockResolvedValue(sdk)

    function ScreenEmitter(): null {
      const optimization = useOptimization()
      order.push('child-render')

      useEffect(() => {
        order.push('child-effect')
        void optimization.screen({
          name: 'Home',
          properties: {},
          screen: { name: 'Home' },
        })
      }, [optimization])

      return null
    }

    renderer = await renderWithAct(
      <OptimizationProvider
        clientId="test-client-id"
        onStatesReady={(states) => {
          order.push('onStatesReady')
          return states.eventStream.subscribe((event) => {
            if (event) observedEvents.push(event)
          }).unsubscribe
        }}
      >
        <ScreenEmitter />
      </OptimizationProvider>,
    )

    expect(order).toEqual(['onStatesReady', 'child-render', 'child-effect'])
    expect(observedEvents).toEqual([screenEvent])
  })

  it('accepts onStatesReady on OptimizationRoot props', () => {
    const onStatesReady = rs.fn()
    const { sdk } = createSdk()
    const providerProps: OptimizationProviderProps = {
      children: <></>,
      onStatesReady,
      sdk: createContentfulOptimizationStub(sdk),
    }
    const rootProps: OptimizationRootProps = {
      children: <></>,
      clientId: 'test-client-id',
      onStatesReady,
    }

    expect(providerProps.onStatesReady).toBe(onStatesReady)
    expect(rootProps.onStatesReady).toBe(onStatesReady)
  })

  it('accepts prefetchManagedEntries on provider and root props', () => {
    const descriptors = ['hero-entry'] as const
    const { sdk } = createSdk()
    const providerConfigProps: OptimizationProviderProps = {
      children: <></>,
      clientId: 'test-client-id',
      prefetchManagedEntries: descriptors,
    }
    const providerSdkProps: OptimizationProviderProps = {
      children: <></>,
      prefetchManagedEntries: descriptors,
      sdk: createContentfulOptimizationStub(sdk),
    }
    const rootProps: OptimizationRootProps = {
      children: <></>,
      clientId: 'test-client-id',
      prefetchManagedEntries: descriptors,
    }

    expect(providerConfigProps.prefetchManagedEntries).toBe(descriptors)
    expect(providerSdkProps.prefetchManagedEntries).toBe(descriptors)
    expect(rootProps.prefetchManagedEntries).toBe(descriptors)
  })

  it('gates children until owned async initialization resolves', async () => {
    const { OptimizationProvider } = await import('./OptimizationProvider')
    const { sdk } = createSdk()
    const deferred = createDeferred<TestSdk>()
    let childRendered = false
    createOptimization.mockReturnValue(deferred.promise)

    function Probe(): null {
      childRendered = true
      return null
    }

    const testRenderer = await loadTestRenderer<TestRenderer>()
    act(() => {
      renderer = testRenderer.create(
        <OptimizationProvider clientId="test-client-id">
          <Probe />
        </OptimizationProvider>,
      )
    })

    expect(childRendered).toBe(false)

    deferred.resolve(sdk)
    await flushPromises()

    expect(childRendered).toBe(true)
  })

  it('passes locale through owned initialization', async () => {
    const { OptimizationProvider } = await import('./OptimizationProvider')
    const { sdk } = createSdk()
    createOptimization.mockResolvedValue(sdk)

    renderer = await renderWithAct(
      <OptimizationProvider clientId="test-client-id" locale="en-US">
        <></>
      </OptimizationProvider>,
    )

    expect(createOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en-US',
      }),
    )
  })

  it('strips managed-entry prefetch descriptors from owned initialization and warms after readiness', async () => {
    const { OptimizationProvider } = await import('./OptimizationProvider')
    const { sdk } = createSdk()
    const descriptors = ['hero-entry'] as const
    createOptimization.mockResolvedValue(sdk)

    renderer = await renderWithAct(
      <OptimizationProvider clientId="test-client-id" prefetchManagedEntries={descriptors}>
        <></>
      </OptimizationProvider>,
    )
    await flushPromises()

    expect(createOptimization).toHaveBeenCalledWith({ clientId: 'test-client-id' })
    expect(sdk.prefetchManagedEntries).toHaveBeenCalledWith(descriptors)
  })

  it('keeps children mounted and preserves the owned SDK when managed-entry prefetch fails', async () => {
    const [{ OptimizationProvider }, { default: OptimizationContext, useOptimization }] =
      await Promise.all([
        import('./OptimizationProvider'),
        import('../context/OptimizationContext'),
      ])
    const { sdk, teardownOrder } = createSdk()
    const error = new Error('prefetch failed')
    const descriptors = ['hero-entry'] as const
    const observedErrors: Array<Error | undefined> = []
    let capturedSdk: OptimizationSdk | undefined = undefined
    let unmountCount = 0
    sdk.prefetchManagedEntries = rs.fn(async () => {
      await Promise.resolve()
      throw error
    })
    createOptimization.mockResolvedValue(sdk)

    function Probe(): null {
      capturedSdk = useOptimization()
      observedErrors.push(React.useContext(OptimizationContext)?.error)

      useEffect(
        () => () => {
          unmountCount += 1
        },
        [],
      )

      return null
    }

    renderer = await renderWithAct(
      <OptimizationProvider clientId="test-client-id" prefetchManagedEntries={descriptors}>
        <Probe />
      </OptimizationProvider>,
    )
    await flushPromises()

    expect(sdk.prefetchManagedEntries).toHaveBeenCalledWith(descriptors)
    expect(capturedSdk).toBe(sdk)
    expect(observedErrors).toContain(error)
    expect(unmountCount).toBe(0)
    expect(teardownOrder).toEqual([])
  })

  it('runs onStatesReady cleanup before destroying the sdk', async () => {
    const { OptimizationProvider } = await import('./OptimizationProvider')
    const { sdk, teardownOrder } = createSdk()
    createOptimization.mockResolvedValue(sdk)

    renderer = await renderWithAct(
      <OptimizationProvider
        clientId="test-client-id"
        onStatesReady={() => () => {
          teardownOrder.push('cleanup')
        }}
      >
        <></>
      </OptimizationProvider>,
    )

    await act(async () => {
      requireRenderer(renderer).unmount()
      await Promise.resolve()
    })

    expect(teardownOrder).toEqual(['cleanup', 'destroy'])
  })

  it('skips onStatesReady when unmounted before async creation resolves', async () => {
    const { OptimizationProvider } = await import('./OptimizationProvider')
    const { sdk, teardownOrder } = createSdk()
    const deferred = createDeferred<TestSdk>()
    const onStatesReady = rs.fn()
    createOptimization.mockReturnValue(deferred.promise)

    const testRenderer = await loadTestRenderer<TestRenderer>()
    act(() => {
      renderer = testRenderer.create(
        <OptimizationProvider clientId="test-client-id" onStatesReady={onStatesReady}>
          <></>
        </OptimizationProvider>,
      )
    })

    await act(async () => {
      requireRenderer(renderer).unmount()
      await Promise.resolve()
    })
    deferred.resolve(sdk)
    await flushPromises()

    expect(onStatesReady).not.toHaveBeenCalled()
    expect(teardownOrder).toEqual(['destroy'])
  })

  it('destroys the sdk when onStatesReady throws', async () => {
    const [{ OptimizationProvider }, { useOptimization }] = await Promise.all([
      import('./OptimizationProvider'),
      import('../context/OptimizationContext'),
    ])
    const { sdk, teardownOrder } = createSdk()
    const error = new Error('states setup failed')
    const capturedError: { error: Error | undefined } = { error: undefined }
    createOptimization.mockResolvedValue(sdk)

    function BrokenProbe(): null {
      useOptimization()
      return null
    }

    renderer = await renderWithAct(
      <OptimizationProvider
        clientId="test-client-id"
        onStatesReady={() => {
          throw error
        }}
      >
        <ErrorBoundary
          onError={(nextError) => {
            capturedError.error = nextError
          }}
        >
          <BrokenProbe />
        </ErrorBoundary>
      </OptimizationProvider>,
    )

    expect(requireRenderer(renderer).toJSON()).toBeNull()
    const hookError = requireError(capturedError.error)
    expect(hookError.message).toContain('ContentfulOptimization SDK failed to initialize')
    expect(Reflect.get(hookError, 'cause')).toBe(error)
    expect(teardownOrder).toEqual(['destroy'])
  })

  it('uses an injected sdk without taking teardown ownership', async () => {
    const [{ OptimizationProvider }, { useOptimization }] = await Promise.all([
      import('./OptimizationProvider'),
      import('../context/OptimizationContext'),
    ])
    const { sdk, teardownOrder } = createSdk()
    const injectedSdk = createContentfulOptimizationStub(sdk)
    const cleanup = rs.fn(() => {
      teardownOrder.push('cleanup')
    })
    let capturedSdk: OptimizationSdk | undefined = undefined

    function Probe(): null {
      capturedSdk = useOptimization()
      return null
    }

    renderer = await renderWithAct(
      <OptimizationProvider sdk={injectedSdk} onStatesReady={() => cleanup}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(capturedSdk).toBe(injectedSdk)

    await act(async () => {
      requireRenderer(renderer).unmount()
      await Promise.resolve()
    })

    expect(teardownOrder).toEqual(['cleanup'])
  })

  it('captures provider props on first mount until the key changes', async () => {
    const [{ OptimizationProvider }, { useOptimization }] = await Promise.all([
      import('./OptimizationProvider'),
      import('../context/OptimizationContext'),
    ])
    const firstReady = rs.fn()
    const secondReady = rs.fn()
    const { sdk: firstSdk } = createSdk()
    const { sdk: secondSdk } = createSdk()
    const firstInjectedSdk = createContentfulOptimizationStub(firstSdk)
    const secondInjectedSdk = createContentfulOptimizationStub(secondSdk)
    let capturedSdk: OptimizationSdk | undefined = undefined

    function Probe(): null {
      capturedSdk = useOptimization()
      return null
    }

    renderer = await renderWithAct(
      <OptimizationProvider sdk={firstInjectedSdk} onStatesReady={firstReady}>
        <Probe />
      </OptimizationProvider>,
    )

    await act(async () => {
      requireRenderer(renderer).update(
        <OptimizationProvider sdk={secondInjectedSdk} onStatesReady={secondReady}>
          <Probe />
        </OptimizationProvider>,
      )
      await Promise.resolve()
    })

    expect(capturedSdk).toBe(firstInjectedSdk)
    expect(firstReady).toHaveBeenCalledTimes(1)
    expect(secondReady).not.toHaveBeenCalled()
  })
})
