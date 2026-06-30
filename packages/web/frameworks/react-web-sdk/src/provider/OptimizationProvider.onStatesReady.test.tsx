import ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { beforeEach, describe, expect, it, rs } from '@rstest/core'
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { resetAutoPageEmitterState, useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'
import type { OptimizationContextValue } from '../context/OptimizationContext'
import {
  OptimizationProvider,
  type OptimizationProviderProps,
  OptimizationRoot,
  type OptimizationRootProps,
  type OptimizationSdk,
  useOptimization,
  useOptimizationContext,
} from '../index'
import { createOptimizationSdk, requireOptimizationSdk } from '../test/sdkTestUtils'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

function TestAutoPageEmitter(): null {
  useAutoPageEmitter({
    enabled: true,
    routeKey: '/',
    buildPayload: () => ({}),
  })

  return null
}

type EventPayload = NonNullable<OptimizationSdk['states']['eventStream']['current']>

function createPageEvent(): EventPayload {
  const timestamp = '2024-01-01T00:00:00.000Z'
  const properties = {
    path: '/',
    query: {},
    referrer: '',
    search: '',
    url: 'http://localhost/',
  }

  return {
    channel: 'web',
    context: {
      campaign: {},
      gdpr: { isConsentGiven: true },
      library: {
        name: '@contentful/optimization-react-web',
        version: '0.0.0',
      },
      locale: 'en-US',
      page: properties,
    },
    messageId: 'message-id',
    originalTimestamp: timestamp,
    properties,
    sentAt: timestamp,
    timestamp,
    type: 'page',
  }
}

function createServerOptimizationState(profileId: string): OptimizationData {
  return {
    changes: [],
    selectedOptimizations: [],
    profile: {
      id: profileId,
      stableId: profileId,
      random: 0.5,
      audiences: [],
      traits: {},
      location: {},
      session: {
        id: `${profileId}-session`,
        isReturningVisitor: false,
        landingPage: {
          path: '/',
          query: {},
          referrer: '',
          search: '',
          title: '',
          url: 'http://localhost/',
        },
        count: 1,
        activeSessionLength: 0,
        averageSessionLength: 0,
      },
    },
  }
}

interface ClientRenderOptions {
  readonly beforeRender?: boolean
}

interface ClientRenderResult {
  readonly unmount: () => void
}

function createClientRoot(): {
  render: (element: ReactElement) => void
  renderAsync: (element: ReactElement, options?: ClientRenderOptions) => Promise<void>
} & ClientRenderResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  return {
    render(element) {
      act(() => {
        root.render(element)
      })
    },
    async renderAsync(element, { beforeRender = false } = {}) {
      await act(async () => {
        if (beforeRender) await Promise.resolve()
        root.render(element)
        await Promise.resolve()
        await Promise.resolve()
      })
    },
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

async function renderClientAsync(
  element: ReactElement,
  { beforeRender = false }: ClientRenderOptions = {},
): Promise<ClientRenderResult> {
  const clientRoot = createClientRoot()

  await clientRoot.renderAsync(element, { beforeRender })

  return clientRoot
}

describe('OptimizationProvider onStatesReady', () => {
  beforeEach(() => {
    resetAutoPageEmitterState()
  })

  it('accepts onStatesReady on OptimizationProvider and OptimizationRoot props', () => {
    const onStatesReady = rs.fn()
    const providerProps: OptimizationProviderProps = {
      children: <></>,
      ...testConfig,
      onStatesReady,
    }
    const rootProps: OptimizationRootProps = {
      children: <></>,
      ...testConfig,
      onStatesReady,
    }

    expect(providerProps.onStatesReady).toBe(onStatesReady)
    expect(rootProps.onStatesReady).toBe(onStatesReady)
  })

  it('registers provider-managed state subscribers before child page effects emit events', async () => {
    type EventSubscriber = Parameters<OptimizationSdk['states']['eventStream']['subscribe']>[0]

    const eventSubscribers = new Set<EventSubscriber>()
    const observedEvents: EventPayload[] = []
    const pageEvent = createPageEvent()
    const page = rs.fn(async () => {
      eventSubscribers.forEach((subscriber) => {
        subscriber(pageEvent)
      })
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({
      page,
      states: {
        eventStream: {
          current: undefined,
          subscribe(next: EventSubscriber) {
            eventSubscribers.add(next)
            next(undefined)

            return {
              unsubscribe() {
                eventSubscribers.delete(next)
              },
            }
          },
          subscribeOnce: () => ({ unsubscribe: () => undefined }),
        },
      },
    })
    const rendered = await renderClientAsync(
      <OptimizationProvider
        sdk={sdk}
        onStatesReady={(states) =>
          states.eventStream.subscribe((event) => {
            if (event) observedEvents.push(event)
          }).unsubscribe
        }
      >
        <TestAutoPageEmitter />
      </OptimizationProvider>,
      { beforeRender: true },
    )

    expect(page).toHaveBeenCalledTimes(1)
    expect(observedEvents).toEqual([pageEvent])

    rendered.unmount()
  })

  it('applies serverOptimizationState to owned SDK instances before onStatesReady and child render', async () => {
    const serverOptimizationState = createServerOptimizationState('owned-server-profile')
    const setupOrder: string[] = []
    let profileFromOnStatesReady: OptimizationData['profile'] | undefined = undefined
    let profileFromChild: OptimizationData['profile'] | undefined = undefined

    function Probe(): null {
      setupOrder.push('child')
      profileFromChild = useOptimization().states.profile.current
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        serverOptimizationState={serverOptimizationState}
        onStatesReady={(states) => {
          setupOrder.push('onStatesReady')
          profileFromOnStatesReady = states.profile.current
        }}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(setupOrder).toEqual(['onStatesReady', 'child'])
    expect(profileFromOnStatesReady).toEqual(serverOptimizationState.profile)
    expect(profileFromChild).toEqual(serverOptimizationState.profile)
    rendered.unmount()
  })

  it('applies serverOptimizationState to injected SDK instances before child render', async () => {
    const serverOptimizationState = createServerOptimizationState('injected-server-profile')
    const sdk = new ContentfulOptimization(testConfig)
    let profileFromChild: OptimizationData['profile'] | undefined = undefined

    function Probe(): null {
      profileFromChild = useOptimization().states.profile.current
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationProvider sdk={sdk} serverOptimizationState={serverOptimizationState}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(profileFromChild).toEqual(serverOptimizationState.profile)
    rendered.unmount()
    sdk.destroy()
  })

  it('applies serverOptimizationState to injected SDK instances before onStatesReady and child render', async () => {
    const serverOptimizationState = createServerOptimizationState('injected-ready-profile')
    const sdk = new ContentfulOptimization(testConfig)
    const setupOrder: string[] = []
    let profileFromOnStatesReady: OptimizationData['profile'] | undefined = undefined
    let profileFromChild: OptimizationData['profile'] | undefined = undefined

    function Probe(): null {
      setupOrder.push('child')
      profileFromChild = useOptimization().states.profile.current
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationProvider
        sdk={sdk}
        serverOptimizationState={serverOptimizationState}
        onStatesReady={(states) => {
          setupOrder.push('onStatesReady')
          profileFromOnStatesReady = states.profile.current
        }}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(setupOrder).toEqual(['onStatesReady', 'child'])
    expect(profileFromOnStatesReady).toEqual(serverOptimizationState.profile)
    expect(profileFromChild).toEqual(serverOptimizationState.profile)
    rendered.unmount()
    sdk.destroy()
  })

  it('passes serverOptimizationState through OptimizationRoot before child render', async () => {
    const serverOptimizationState = createServerOptimizationState('root-server-profile')
    let profileFromChild: OptimizationData['profile'] | undefined = undefined

    function Probe(): null {
      profileFromChild = useOptimization().states.profile.current
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationRoot
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        serverOptimizationState={serverOptimizationState}
      >
        <Probe />
      </OptimizationRoot>,
    )

    expect(profileFromChild).toEqual(serverOptimizationState.profile)
    rendered.unmount()
  })

  it('does not construct owned sdk instances during server render', () => {
    let childRendered = false

    function Probe(): null {
      childRendered = true
      return null
    }

    const markup = renderToString(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
      >
        <Probe />
      </OptimizationProvider>,
    )

    // Children render during SSR; the SDK constructor must never run on the server.
    expect(markup).toMatchInlineSnapshot(`""`)
    expect(childRendered).toBe(true)
    expect(window.contentfulOptimization).toBeUndefined()
  })

  it('renders injected sdk children during initial render when no state setup is needed', () => {
    let capturedOptimization: ReturnType<typeof useOptimization> | undefined = undefined
    let childRendered = false
    const sdk = createOptimizationSdk()

    function Probe(): null {
      childRendered = true
      capturedOptimization = useOptimization()
      return null
    }

    const markup = renderToString(
      <OptimizationProvider sdk={sdk}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(markup).toBe('')
    expect(childRendered).toBe(true)
    expect(requireOptimizationSdk(capturedOptimization)).toBe(sdk)
  })

  it('preserves injected sdk context identity across unchanged provider rerenders', () => {
    const sdk = createOptimizationSdk()
    const capturedContexts: OptimizationContextValue[] = []
    const rendered = createClientRoot()

    function Probe(): null {
      capturedContexts.push(useOptimizationContext())
      return null
    }

    rendered.render(
      <OptimizationProvider sdk={sdk}>
        <Probe />
      </OptimizationProvider>,
    )

    rendered.render(
      <OptimizationProvider sdk={sdk}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(capturedContexts).toHaveLength(2)
    expect(capturedContexts[1]).toBe(capturedContexts[0])

    rendered.unmount()
  })

  it('does not render injected sdk children during server render when state setup must run first', () => {
    const sdk = createOptimizationSdk()
    const onStatesReady = rs.fn()
    let childRendered = false

    function Probe(): null {
      childRendered = true
      return null
    }

    const markup = renderToString(
      <OptimizationProvider sdk={sdk} onStatesReady={onStatesReady}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(markup).toBe('')
    expect(childRendered).toBe(false)
    expect(onStatesReady).not.toHaveBeenCalled()
  })

  it('destroys owned sdk instances when onStatesReady throws', () => {
    const error = new Error('states setup failed')
    let capturedContext: OptimizationContextValue | null = null
    const destroySpy = rs.spyOn(ContentfulOptimization.prototype, 'destroy')
    const rendered = createClientRoot()

    function Probe(): null {
      capturedContext = useOptimizationContext()
      return null
    }

    rendered.render(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        onStatesReady={() => {
          throw error
        }}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(capturedContext).toEqual({
      sdk: undefined,
      isReady: false,
      error,
    })
    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(window.contentfulOptimization).toBeUndefined()
    destroySpy.mockRestore()
    rendered.unmount()
  })

  it('runs callback cleanup for injected SDK instances without taking teardown ownership', () => {
    const sdk = createOptimizationSdk()
    const destroySpy = rs.spyOn(sdk, 'destroy')
    const cleanup = rs.fn()
    let capturedOptimization: ReturnType<typeof useOptimization> | undefined = undefined
    const rendered = createClientRoot()

    function Probe(): null {
      capturedOptimization = useOptimization()
      return null
    }

    rendered.render(
      <OptimizationProvider sdk={sdk} onStatesReady={() => cleanup}>
        <Probe />
      </OptimizationProvider>,
    )

    const optimization = requireOptimizationSdk(capturedOptimization)

    expect(optimization).toBe(sdk)

    rendered.unmount()

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(destroySpy).not.toHaveBeenCalled()
  })

  it('runs onStatesReady cleanup before owned sdk teardown', () => {
    const order: string[] = []
    const { destroy: originalDestroy } = ContentfulOptimization.prototype
    const destroySpy = rs
      .spyOn(ContentfulOptimization.prototype, 'destroy')
      .mockImplementation(function destroy(this: ContentfulOptimization): void {
        order.push('destroy')
        originalDestroy.call(this)
      })
    const rendered = createClientRoot()

    rendered.render(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        onStatesReady={() => () => {
          order.push('cleanup')
        }}
      >
        <div />
      </OptimizationProvider>,
    )

    rendered.unmount()

    expect(order).toEqual(['cleanup', 'destroy'])
    expect(destroySpy).toHaveBeenCalledTimes(1)
    destroySpy.mockRestore()
  })

  it('captures provider props on first mount until the key changes', () => {
    const firstSdk = createOptimizationSdk()
    const secondSdk = createOptimizationSdk()
    const firstReady = rs.fn()
    const secondReady = rs.fn()
    let capturedOptimization: ReturnType<typeof useOptimization> | undefined = undefined
    const rendered = createClientRoot()

    function Probe(): null {
      capturedOptimization = useOptimization()
      return null
    }

    rendered.render(
      <OptimizationProvider sdk={firstSdk} onStatesReady={firstReady}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(requireOptimizationSdk(capturedOptimization)).toBe(firstSdk)

    rendered.render(
      <OptimizationProvider sdk={secondSdk} onStatesReady={secondReady}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(requireOptimizationSdk(capturedOptimization)).toBe(firstSdk)
    expect(firstReady).toHaveBeenCalledTimes(1)
    expect(secondReady).not.toHaveBeenCalled()

    rendered.unmount()
  })
})
