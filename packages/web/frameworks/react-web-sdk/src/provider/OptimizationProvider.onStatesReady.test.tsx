import { optimizedEntry } from '@contentful/optimization-core/test/fixtures/optimizedEntry'
import { selectedOptimizations } from '@contentful/optimization-core/test/fixtures/selectedOptimizations'
import ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import {
  type ExperienceRequestState,
  InterceptorManager,
  type Observable,
  signals,
} from '@contentful/optimization-web/core-sdk'
import {
  type ContentOptimizationHandoff,
  hydrateOptimizationHandoff,
} from '@contentful/optimization-web/handoff'
import { describe, expect, it, rs } from '@rstest/core'
import { act, type ReactElement, StrictMode, useContext } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import type { OptimizationContextValue } from '../context/OptimizationContext'
import { OptimizationHydrationContext } from '../context/OptimizationHydrationContext'
import {
  OptimizationProvider,
  type OptimizationProviderProps,
  OptimizationRoot,
  type OptimizationRootProps,
  type OptimizationSdk,
  useOptimization,
  useOptimizationContext,
} from '../index'
import { OptimizedEntry } from '../optimized-entry/OptimizedEntry'
import { useManagedBaselineEntry } from '../optimized-entry/useOptimizedEntry'
import {
  createOptimizableTestEntry,
  createOptimizationSdk,
  createTestEntry,
  requireOptimizationSdk,
} from '../test/sdkTestUtils'

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

function TestRoutePageEmitter({
  initialPageEvent,
  routeKey,
}: {
  readonly initialPageEvent?: 'emit' | 'skip'
  readonly routeKey: string
}): null {
  useAutoPageEmitter({
    buildPayload: () => ({}),
    enabled: true,
    initialPageEvent,
    routeKey,
  })

  return null
}

function stubResponseLessPageTracking(sdk: ContentfulOptimization): void {
  rs.spyOn(sdk, 'trackCurrentPage').mockImplementation(
    async ({ initialPageEvent }) =>
      await Promise.resolve(
        initialPageEvent === 'skip'
          ? { accepted: false, reason: 'already-accepted' }
          : { accepted: false, reason: 'not-allowed' },
      ),
  )
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
    messageId: '11111111-1111-4111-8111-111111111111',
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
        id: 'e77eab64-93ca-4f6e-8492-037c1ff67caa',
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

function readProfileId(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object') return undefined

  const profile = Reflect.get(value, 'profile')
  if (profile === null || typeof profile !== 'object') return undefined

  const id = Reflect.get(profile, 'id')
  return typeof id === 'string' ? id : undefined
}

function createContentHandoff(
  profileId: string,
  overrides: Partial<ContentOptimizationHandoff> = {},
): ContentOptimizationHandoff {
  return {
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    initialPageEvent: 'skip',
    state: createServerOptimizationState(profileId),
    ...overrides,
  }
}

function createDeferred<T = undefined>(): PromiseWithResolvers<T> {
  return Promise.withResolvers<T>()
}

function createMutableObservable<T>(initial: T): {
  readonly emit: (value: T) => void
  readonly observable: Observable<T>
} {
  const subscribers = new Set<(value: T) => void>()
  let current = initial

  return {
    emit(value) {
      current = value
      subscribers.forEach((subscriber) => {
        subscriber(value)
      })
    },
    observable: {
      get current() {
        return current
      },
      subscribe(next) {
        const subscriber = next as (value: T) => void
        subscribers.add(subscriber)
        subscriber(current)

        return { unsubscribe: () => subscribers.delete(subscriber) }
      },
      subscribeOnce: () => ({ unsubscribe: () => undefined }),
    },
  }
}

interface ClientRenderOptions {
  readonly beforeRender?: boolean
}

interface ClientRenderResult {
  readonly container: HTMLDivElement
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
    container,
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

  it('prefetches managed entries after the live SDK is ready', async () => {
    const prefetchManagedEntries = rs.fn(async () => await Promise.resolve([]))
    const sdk = createOptimizationSdk({ prefetchManagedEntries })
    const rendered = await renderClientAsync(
      <OptimizationProvider sdk={sdk} prefetchManagedEntries={['hero-entry']}>
        <></>
      </OptimizationProvider>,
    )

    expect(prefetchManagedEntries).toHaveBeenCalledWith(['hero-entry'])

    rendered.unmount()
  })

  it('hydrates resolved IDs and nested managed entry descriptors with their query', async () => {
    const baselineEntry = createTestEntry('resolved-entry-id')
    const entryQuery = { locale: 'de-DE' } as const
    const managedEntry = {
      contentType: 'page',
      slug: 'home',
      slugField: 'slug',
      entryQuery,
    } as const
    const fetchContentfulEntry = rs.fn(async () => await Promise.resolve(baselineEntry))
    const sdk = createOptimizationSdk()
    Reflect.set(sdk, 'fetchContentfulEntry', fetchContentfulEntry)
    const handoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b', {
      entries: [
        {
          baselineEntry,
          entryId: baselineEntry.sys.id,
          managedEntry,
        },
      ],
    })
    let resolvedIds: Array<string | undefined> = []

    function Probe(): null {
      const resolvedId = useManagedBaselineEntry({ entryId: baselineEntry.sys.id, entryQuery })
      const descriptor = useManagedBaselineEntry({ managedEntry })
      resolvedIds = [resolvedId.entry?.sys.id, descriptor.entry?.sys.id]
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationProvider sdk={sdk} handoff={handoff}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(resolvedIds).toEqual(['resolved-entry-id', 'resolved-entry-id'])
    expect(fetchContentfulEntry).not.toHaveBeenCalled()

    rendered.unmount()
  })

  it('makes standalone hydration visible to provider children without a handoff', async () => {
    let capturedHydration: unknown

    function Probe(): null {
      capturedHydration = useContext(OptimizationHydrationContext)
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationProvider {...testConfig} hydration="preserve-server">
        <Probe />
      </OptimizationProvider>,
    )

    expect(capturedHydration).toBe('preserve-server')
    rendered.unmount()
  })

  it('lets the provider hydration prop override handoff hydration for children', async () => {
    const handoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b', {
      hydration: 'client-only-hidden-until-ready',
    })
    let capturedHydration: unknown

    function Probe(): null {
      capturedHydration = useContext(OptimizationHydrationContext)
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationProvider {...testConfig} handoff={handoff} hydration="preserve-server">
        <Probe />
      </OptimizationProvider>,
    )

    expect(capturedHydration).toBe('preserve-server')
    rendered.unmount()
  })

  it('renders handoff state from a snapshot before owned SDK setup finishes', async () => {
    const handoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b')
    const setupOrder: string[] = []
    let profileFromOnStatesReady: OptimizationData['profile'] | undefined = undefined
    const childProfiles: Array<OptimizationData['profile'] | undefined> = []

    function Probe(): null {
      setupOrder.push('child')
      childProfiles.push(useOptimization().states.profile.current)
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        handoff={handoff}
        onStatesReady={(states) => {
          setupOrder.push('onStatesReady')
          profileFromOnStatesReady = states.profile.current
        }}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(setupOrder).toEqual(['child', 'onStatesReady', 'child'])
    expect(profileFromOnStatesReady).toEqual(handoff.state?.profile)
    expect(childProfiles).toEqual([handoff.state?.profile, handoff.state?.profile])
    rendered.unmount()
  })

  it('replays owned initial handoff hydration safely under StrictMode', async () => {
    const handoff = createContentHandoff('strict-initial-handoff')
    const hydration = createDeferred()
    const onStatesReady = rs.fn()
    const { run: runInterceptors } = InterceptorManager.prototype
    let matchingHydrations = 0
    const runInterceptorsSpy = rs
      .spyOn(InterceptorManager.prototype, 'run')
      .mockImplementation(async function run(
        this: InterceptorManager<unknown>,
        input: unknown,
      ): Promise<unknown> {
        if (readProfileId(input) === handoff.state?.profile?.id) {
          matchingHydrations += 1
          await hydration.promise
        }

        return await runInterceptors.call(this, input)
      })
    const destroySpy = rs.spyOn(ContentfulOptimization.prototype, 'destroy')
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <StrictMode>
        <OptimizationProvider {...testConfig} handoff={handoff} onStatesReady={onStatesReady}>
          <div />
        </OptimizationProvider>
      </StrictMode>,
    )

    expect(matchingHydrations).toBe(2)
    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(window.contentfulOptimization).toBeDefined()
    expect(onStatesReady).not.toHaveBeenCalled()

    await act(async () => {
      hydration.resolve(undefined)
      await hydration.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onStatesReady).toHaveBeenCalledTimes(1)
    expect(signals.profile.value).toEqual(handoff.state?.profile)

    rendered.unmount()
    expect(destroySpy).toHaveBeenCalledTimes(2)
    expect(window.contentfulOptimization).toBeUndefined()

    destroySpy.mockRestore()
    runInterceptorsSpy.mockRestore()
  })

  it('cancels owned initial handoff hydration when unmounted', async () => {
    const initialState = createServerOptimizationState('initial-owned-profile')
    const handoff = createContentHandoff('unmounted-initial-handoff')
    const hydration = createDeferred()
    const hydrationStarted = createDeferred()
    const onStatesReady = rs.fn()
    const { run: runInterceptors } = InterceptorManager.prototype
    const runInterceptorsSpy = rs
      .spyOn(InterceptorManager.prototype, 'run')
      .mockImplementation(async function run(
        this: InterceptorManager<unknown>,
        input: unknown,
      ): Promise<unknown> {
        if (readProfileId(input) === handoff.state?.profile?.id) {
          hydrationStarted.resolve(undefined)
          await hydration.promise
        }

        return await runInterceptors.call(this, input)
      })
    const destroySpy = rs.spyOn(ContentfulOptimization.prototype, 'destroy')
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <OptimizationProvider
        {...testConfig}
        defaults={{ consent: true, profile: initialState.profile }}
        handoff={handoff}
        onStatesReady={onStatesReady}
      >
        <div />
      </OptimizationProvider>,
    )
    await hydrationStarted.promise
    expect(signals.profile.value).toEqual(initialState.profile)

    rendered.unmount()
    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(window.contentfulOptimization).toBeUndefined()

    await act(async () => {
      hydration.resolve(undefined)
      await hydration.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(signals.profile.value).toEqual(initialState.profile)
    expect(onStatesReady).not.toHaveBeenCalled()
    expect(destroySpy).toHaveBeenCalledTimes(1)

    destroySpy.mockRestore()
    runInterceptorsSpy.mockRestore()
  })

  it('cancels injected initial handoff hydration without taking SDK ownership', async () => {
    const initialState = createServerOptimizationState('initial-injected-profile')
    const handoff = createContentHandoff('unmounted-injected-handoff')
    const hydration = createDeferred()
    const hydrationStarted = createDeferred()
    const onStatesReady = rs.fn()
    const sdk = new ContentfulOptimization({
      ...testConfig,
      defaults: { consent: true, profile: initialState.profile },
    })
    sdk.interceptors.state.add(async (incoming) => {
      if (incoming.profile?.id === handoff.state?.profile?.id) {
        hydrationStarted.resolve(undefined)
        await hydration.promise
      }

      return incoming
    })
    const destroySpy = rs.spyOn(sdk, 'destroy')
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={handoff} onStatesReady={onStatesReady}>
        <div />
      </OptimizationProvider>,
    )
    await hydrationStarted.promise

    rendered.unmount()
    expect(destroySpy).not.toHaveBeenCalled()
    expect(window.contentfulOptimization).toBe(sdk)

    await act(async () => {
      hydration.resolve(undefined)
      await hydration.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(sdk.states.profile.current).toEqual(initialState.profile)
    expect(onStatesReady).not.toHaveBeenCalled()
    expect(destroySpy).not.toHaveBeenCalled()

    sdk.destroy()
    expect(destroySpy).toHaveBeenCalledTimes(1)
  })

  it('keeps initial handoff hydration failure fatal and destroys the owned SDK once', async () => {
    const hydrationError = new Error('initial hydration failed')
    const handoff = createContentHandoff('rejected-initial-handoff')
    const onStatesReady = rs.fn()
    const { run: runInterceptors } = InterceptorManager.prototype
    const runInterceptorsSpy = rs
      .spyOn(InterceptorManager.prototype, 'run')
      .mockImplementation(async function run(
        this: InterceptorManager<unknown>,
        input: unknown,
      ): Promise<unknown> {
        if (readProfileId(input) === handoff.state?.profile?.id) {
          return await Promise.reject(hydrationError)
        }

        return await runInterceptors.call(this, input)
      })
    const destroySpy = rs.spyOn(ContentfulOptimization.prototype, 'destroy')
    const rendered = createClientRoot()
    let capturedContext: OptimizationContextValue | null = null

    function Probe(): null {
      capturedContext = useOptimizationContext()
      return null
    }

    await rendered.renderAsync(
      <OptimizationProvider {...testConfig} handoff={handoff} onStatesReady={onStatesReady}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(capturedContext).toEqual(
      expect.objectContaining({ error: hydrationError, isLive: false, sdk: undefined }),
    )
    expect(onStatesReady).not.toHaveBeenCalled()
    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(window.contentfulOptimization).toBeUndefined()

    rendered.unmount()
    expect(destroySpy).toHaveBeenCalledTimes(1)

    destroySpy.mockRestore()
    runInterceptorsSpy.mockRestore()
  })

  it('applies handoff state to injected SDK instances before child render', async () => {
    const handoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b')
    const sdk = new ContentfulOptimization(testConfig)
    let profileFromChild: OptimizationData['profile'] | undefined = undefined

    function Probe(): null {
      profileFromChild = useOptimization().states.profile.current
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationProvider sdk={sdk} handoff={handoff}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(profileFromChild).toEqual(handoff.state?.profile)
    rendered.unmount()
    sdk.destroy()
  })

  it('renders handoff state from a snapshot before injected SDK setup finishes', async () => {
    const handoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b')
    const sdk = new ContentfulOptimization(testConfig)
    const setupOrder: string[] = []
    let profileFromOnStatesReady: OptimizationData['profile'] | undefined = undefined
    const childProfiles: Array<OptimizationData['profile'] | undefined> = []

    function Probe(): null {
      setupOrder.push('child')
      childProfiles.push(useOptimization().states.profile.current)
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationProvider
        sdk={sdk}
        handoff={handoff}
        onStatesReady={(states) => {
          setupOrder.push('onStatesReady')
          profileFromOnStatesReady = states.profile.current
        }}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(setupOrder).toEqual(['child', 'onStatesReady', 'child'])
    expect(profileFromOnStatesReady).toEqual(handoff.state?.profile)
    expect(childProfiles).toEqual([handoff.state?.profile, handoff.state?.profile])
    rendered.unmount()
    sdk.destroy()
  })

  it('passes handoff state through OptimizationRoot before child render', async () => {
    const handoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b')
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
        handoff={handoff}
      >
        <Probe />
      </OptimizationRoot>,
    )

    expect(profileFromChild).toEqual(handoff.state?.profile)
    rendered.unmount()
  })

  it('hydrates changed handoff state into the existing live SDK', async () => {
    const firstHandoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b')
    const secondHandoff = createContentHandoff('a19c3f54d2b84e37a93f6d1c0e5b7284')
    let liveStates: OptimizationSdk['states'] | undefined = undefined
    const onStatesReady = rs.fn((states: OptimizationSdk['states']) => {
      liveStates = states
    })
    const rendered = createClientRoot()
    const requireLiveStates = (): OptimizationSdk['states'] => {
      if (liveStates === undefined) throw new Error('Expected live states to be ready.')

      return liveStates
    }

    await rendered.renderAsync(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        handoff={firstHandoff}
        onStatesReady={onStatesReady}
      >
        <div />
      </OptimizationProvider>,
    )

    expect(requireLiveStates().profile.current).toEqual(firstHandoff.state?.profile)

    await rendered.renderAsync(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        handoff={secondHandoff}
        onStatesReady={onStatesReady}
      >
        <div />
      </OptimizationProvider>,
    )

    expect(requireLiveStates().profile.current).toEqual(secondHandoff.state?.profile)
    expect(onStatesReady).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it('uses each handoff object for only one route occurrence', async () => {
    const handoff = createContentHandoff('preserved-layout-handoff', {
      state: {
        ...createServerOptimizationState('preserved-layout-handoff'),
        selectedOptimizations,
      },
    })
    const sdk = new ContentfulOptimization(testConfig)
    stubResponseLessPageTracking(sdk)
    const rendered = createClientRoot()
    const renderRoute = async (routeKey: string): Promise<void> => {
      await rendered.renderAsync(
        <StrictMode>
          <OptimizationProvider sdk={sdk} handoff={handoff}>
            <TestRoutePageEmitter initialPageEvent="skip" routeKey={routeKey} />
            <OptimizedEntry key={routeKey} baselineEntry={optimizedEntry} liveUpdates={false}>
              {(entry) => entry.sys.id}
            </OptimizedEntry>
          </OptimizationProvider>
        </StrictMode>,
      )
    }

    await renderRoute('/a')
    expect(rendered.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')

    await renderRoute('/b')
    await renderRoute('/a')
    expect(rendered.container.textContent).toContain(optimizedEntry.sys.id)
    expect(rendered.container.textContent).not.toContain('4k6ZyFQnR2POY5IJLLlJRb')

    rendered.unmount()
    sdk.destroy()
  })

  it('claims a fresh handoff object when the route key is unchanged', async () => {
    const firstHandoff = createContentHandoff('same-route-first')
    const replacementHandoff = createContentHandoff('same-route-replacement', {
      state: {
        ...createServerOptimizationState('same-route-replacement'),
        selectedOptimizations,
      },
    })
    const sdk = new ContentfulOptimization(testConfig)
    stubResponseLessPageTracking(sdk)
    const rendered = createClientRoot()
    const renderRoute = async (
      handoff: ContentOptimizationHandoff,
      routeKey: string,
    ): Promise<void> => {
      await rendered.renderAsync(
        <OptimizationProvider sdk={sdk} handoff={handoff}>
          <TestRoutePageEmitter initialPageEvent="skip" routeKey={routeKey} />
          <OptimizedEntry key={routeKey} baselineEntry={optimizedEntry} liveUpdates={false}>
            {(entry) => entry.sys.id}
          </OptimizedEntry>
        </OptimizationProvider>,
      )
    }

    await renderRoute(firstHandoff, '/same')
    await renderRoute(replacementHandoff, '/same')
    expect(rendered.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')

    await renderRoute(replacementHandoff, '/next')
    expect(rendered.container.textContent).toContain(optimizedEntry.sys.id)

    rendered.unmount()
    sdk.destroy()
  })

  it('does not let a newly mounted entry lock the prior route selection before an empty handoff hydrates', async () => {
    const firstHandoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b', {
      state: {
        ...createServerOptimizationState('f0837d7dc6344c36a3a0a06c4cde754b'),
        selectedOptimizations,
      },
    })
    const secondHandoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b')
    const sdk = new ContentfulOptimization(testConfig)
    Reflect.set(sdk, 'trackCurrentPage', async ({ routeKey }: { routeKey: string }) => {
      if (routeKey === '/baseline') await hydrateOptimizationHandoff(sdk, firstHandoff)
      return { accepted: true }
    })
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={firstHandoff}>
        <TestRoutePageEmitter initialPageEvent="skip" routeKey="/selected" />
        <OptimizedEntry baselineEntry={optimizedEntry} liveUpdates={false}>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>,
    )

    expect(rendered.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')

    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={secondHandoff}>
        <TestRoutePageEmitter initialPageEvent="skip" routeKey="/baseline" />
        <OptimizedEntry key="baseline" baselineEntry={optimizedEntry} liveUpdates={false}>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>,
    )

    expect(rendered.container.textContent).toContain(optimizedEntry.sys.id)
    expect(rendered.container.textContent).not.toContain('4k6ZyFQnR2POY5IJLLlJRb')

    rendered.unmount()
    sdk.destroy()
  })

  it('keeps a public permutation handoff authoritative after its initial page response', async () => {
    const publicHandoff = createContentHandoff('unused', {
      cache: { key: 'baseline', scope: 'public-permutation' },
      initialPageEvent: 'emit',
      state: { selectedOptimizations: [] },
    })
    const selectedHandoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b', {
      state: {
        ...createServerOptimizationState('f0837d7dc6344c36a3a0a06c4cde754b'),
        selectedOptimizations,
      },
    })
    const sdk = new ContentfulOptimization(testConfig)
    Reflect.set(sdk, 'trackCurrentPage', async () => {
      await hydrateOptimizationHandoff(sdk, selectedHandoff)
      return { accepted: true }
    })
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={publicHandoff}>
        <TestRoutePageEmitter routeKey="/baseline" />
        <OptimizedEntry baselineEntry={optimizedEntry} liveUpdates={false}>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>,
    )

    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(rendered.container.textContent).toContain(optimizedEntry.sys.id)
    expect(rendered.container.textContent).not.toContain('4k6ZyFQnR2POY5IJLLlJRb')

    rendered.unmount()
    sdk.destroy()
  })

  it('uses the live SDK behind retained public and static snapshots when updates are explicit', async () => {
    const cases = [
      {
        cache: { key: 'baseline', scope: 'public-permutation' as const },
        entryLiveUpdates: true,
        globalLiveUpdates: false,
        previewPanelVisible: false,
      },
      {
        cache: { scope: 'static' as const },
        entryLiveUpdates: undefined,
        globalLiveUpdates: true,
        previewPanelVisible: false,
      },
      {
        cache: { key: 'preview', scope: 'public-permutation' as const },
        entryLiveUpdates: false,
        globalLiveUpdates: false,
        previewPanelVisible: true,
      },
    ]

    for (const { cache, entryLiveUpdates, globalLiveUpdates, previewPanelVisible } of cases) {
      const handoff = createContentHandoff('unused', {
        cache,
        initialPageEvent: 'emit',
        state: { selectedOptimizations: [] },
      })
      const selectedHandoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b', {
        state: {
          ...createServerOptimizationState('f0837d7dc6344c36a3a0a06c4cde754b'),
          selectedOptimizations,
        },
      })
      const sdk = new ContentfulOptimization(testConfig)
      const selectedEntry = createTestEntry('selected-entry')
      Reflect.set(
        sdk,
        'resolveOptimizedEntry',
        (
          entry: typeof optimizedEntry,
          currentSelections: typeof selectedOptimizations | undefined,
        ) =>
          currentSelections?.length
            ? { entry: selectedEntry, selectedOptimization: currentSelections[0] }
            : { entry },
      )
      Reflect.set(sdk, 'trackCurrentPage', async () => await Promise.resolve({ accepted: true }))
      const liveReady = Promise.withResolvers<undefined>()

      function LiveProbe(): null {
        if (useOptimizationContext().isLive) liveReady.resolve(undefined)
        return null
      }

      const rendered = await renderClientAsync(
        <OptimizationProvider sdk={sdk} handoff={handoff}>
          <LiveProbe />
          <TestRoutePageEmitter routeKey="/live" />
          <LiveUpdatesContext.Provider
            value={{
              globalLiveUpdates,
              previewPanelVisible,
              setPreviewPanelVisible: () => undefined,
            }}
          >
            <OptimizedEntry baselineEntry={optimizedEntry} liveUpdates={entryLiveUpdates}>
              {(entry) => entry.sys.id}
            </OptimizedEntry>
          </LiveUpdatesContext.Provider>
        </OptimizationProvider>,
      )

      await act(async () => {
        await liveReady.promise
        await hydrateOptimizationHandoff(sdk, selectedHandoff)
      })

      expect(rendered.container.textContent).toContain(selectedEntry.sys.id)
      expect(rendered.container.textContent).not.toContain(optimizedEntry.sys.id)

      rendered.unmount()
      sdk.destroy()
    }
  })

  it('uses a pending handoff snapshot when live updates are explicit', async () => {
    const handoff = createContentHandoff('pending-handoff', {
      state: { selectedOptimizations: [] },
    })
    const hydration = createDeferred()
    const sdk = new ContentfulOptimization({
      ...testConfig,
      defaults: { consent: true, selectedOptimizations },
    })
    const routeAEntry = createTestEntry('route-a-entry')
    Reflect.set(
      sdk,
      'resolveOptimizedEntry',
      (
        entry: typeof optimizedEntry,
        currentSelections: typeof selectedOptimizations | undefined,
      ) =>
        currentSelections?.length
          ? { entry: routeAEntry, selectedOptimization: currentSelections[0] }
          : { entry },
    )
    sdk.interceptors.state.add(async (incoming) => {
      await hydration.promise
      return incoming
    })
    const rendered = createClientRoot()
    const entry = (
      <OptimizedEntry baselineEntry={optimizedEntry} liveUpdates>
        {(resolved) => resolved.sys.id}
      </OptimizedEntry>
    )

    await rendered.renderAsync(<OptimizationProvider sdk={sdk}>{entry}</OptimizationProvider>)
    expect(rendered.container.textContent).toContain(routeAEntry.sys.id)

    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={handoff}>
        {entry}
      </OptimizationProvider>,
    )

    expect(rendered.container.textContent).toContain(optimizedEntry.sys.id)
    expect(rendered.container.textContent).not.toContain(routeAEntry.sys.id)

    await act(async () => {
      hydration.resolve(undefined)
      await hydration.promise
      await Promise.resolve()
    })
    rendered.unmount()
    sdk.destroy()
  })

  it('keeps a failed no-handoff route baseline-safe when live updates are explicit', async () => {
    const routeResult = createDeferred<{
      readonly accepted: false
      readonly reason: 'not-allowed'
    }>()
    const baselineEntry = createOptimizableTestEntry('failed-baseline')
    const selectedEntry = createTestEntry('failed-selected')
    const sdk = createOptimizationSdk({
      resolveOptimizedEntry: (entry, currentSelections) =>
        currentSelections?.length
          ? { entry: selectedEntry, selectedOptimization: currentSelections[0] }
          : { entry },
      states: {
        canOptimize: createMutableObservable(true).observable,
        experienceRequestState: createMutableObservable<ExperienceRequestState>({
          status: 'success',
        }).observable,
        selectedOptimizations: createMutableObservable(selectedOptimizations).observable,
      },
      trackCurrentPage: async ({ routeKey }) =>
        routeKey === '/failed'
          ? await routeResult.promise
          : await Promise.resolve({ accepted: true as const }),
    })
    const rendered = createClientRoot()
    const renderRoute = async (routeKey: string): Promise<void> => {
      await rendered.renderAsync(
        <OptimizationProvider sdk={sdk}>
          <TestRoutePageEmitter routeKey={routeKey} />
          <OptimizedEntry key={routeKey} baselineEntry={baselineEntry} liveUpdates>
            {(entry) => entry.sys.id}
          </OptimizedEntry>
        </OptimizationProvider>,
      )
    }

    await renderRoute('/selected')
    expect(rendered.container.textContent).toContain(selectedEntry.sys.id)

    await renderRoute('/failed')
    expect(rendered.container.textContent).toContain(baselineEntry.sys.id)

    await act(async () => {
      routeResult.resolve({ accepted: false, reason: 'not-allowed' })
      await routeResult.promise
      await Promise.resolve()
    })
    expect(rendered.container.textContent).toContain(baselineEntry.sys.id)
    expect(rendered.container.textContent).not.toContain(selectedEntry.sys.id)

    rendered.unmount()
  })

  it('does not reopen a settled transition when its tracker remounts', async () => {
    const baselineEntry = createOptimizableTestEntry('baseline-entry')
    const selectedEntry = createTestEntry('selected-entry')
    let accepted = false
    const optimization = createOptimizationSdk({
      resolveOptimizedEntry: (entry, currentSelections) =>
        currentSelections?.length
          ? { entry: selectedEntry, selectedOptimization: currentSelections[0] }
          : { entry },
      states: {
        canOptimize: createMutableObservable(true).observable,
        experienceRequestState: createMutableObservable<ExperienceRequestState>({
          status: 'success',
        }).observable,
        selectedOptimizations: createMutableObservable(selectedOptimizations).observable,
      },
      trackCurrentPage: async () => {
        if (accepted) {
          return await Promise.resolve({ accepted: false as const, reason: 'already-accepted' })
        }

        accepted = true
        return await Promise.resolve({ accepted: true as const })
      },
    })
    const rendered = createClientRoot()
    const route = (
      <OptimizationProvider sdk={optimization}>
        <TestRoutePageEmitter routeKey="/accepted" />
        <OptimizedEntry baselineEntry={baselineEntry} liveUpdates={false}>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>
    )

    await rendered.renderAsync(route)
    expect(rendered.container.textContent).toContain(selectedEntry.sys.id)

    await rendered.renderAsync(
      <OptimizationProvider sdk={optimization}>
        <div />
      </OptimizationProvider>,
    )
    await rendered.renderAsync(route)

    expect(rendered.container.textContent).toContain(selectedEntry.sys.id)
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).not.toBe('hidden')

    rendered.unmount()
  })

  it('keeps StrictMode presentation pending while the singleton page request is in flight', async () => {
    const pageResult = createDeferred<OptimizationData>()
    const pageData = {
      ...createServerOptimizationState('strict-page-response'),
      selectedOptimizations,
    }
    const sdk = new ContentfulOptimization({
      ...testConfig,
      defaults: { consent: true, selectedOptimizations },
    })
    const upsertProfile = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockImplementation(async () => await pageResult.promise)
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk}>
        <StrictMode>
          <TestRoutePageEmitter routeKey="/strict" />
          <OptimizedEntry baselineEntry={optimizedEntry} liveUpdates={false}>
            {(entry) => entry.sys.id}
          </OptimizedEntry>
        </StrictMode>
      </OptimizationProvider>,
    )

    expect(upsertProfile).toHaveBeenCalledTimes(1)
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).toBe('hidden')

    await act(async () => {
      pageResult.resolve(pageData)
      await pageResult.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(rendered.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).not.toBe('hidden')

    rendered.unmount()
    sdk.destroy()
  })

  it('does not let stale A1 or B page completions settle the current A2 presentation', async () => {
    const pageResults = [
      createDeferred<OptimizationData>(),
      createDeferred<OptimizationData>(),
      createDeferred<OptimizationData>(),
    ] as const
    const pageData = {
      ...createServerOptimizationState('route-page-response'),
      selectedOptimizations,
    }
    let pageCall = 0
    const sdk = new ContentfulOptimization({
      ...testConfig,
      defaults: { consent: true, selectedOptimizations },
    })
    const upsertProfile = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockImplementation(async () => {
        const result = pageResults[pageCall]
        pageCall += 1
        if (result === undefined) throw new Error('Unexpected page request.')

        return await result.promise
      })
    const rendered = createClientRoot()
    const renderRoute = async (routeKey: string): Promise<void> => {
      await rendered.renderAsync(
        <OptimizationProvider sdk={sdk}>
          <TestRoutePageEmitter routeKey={routeKey} />
          <OptimizedEntry key={routeKey} baselineEntry={optimizedEntry} liveUpdates={false}>
            {(entry) => entry.sys.id}
          </OptimizedEntry>
        </OptimizationProvider>,
      )
    }

    await renderRoute('/a')
    await renderRoute('/b')
    await renderRoute('/a')

    expect(upsertProfile).toHaveBeenCalledTimes(3)
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).toBe('hidden')

    await act(async () => {
      pageResults[0].resolve(pageData)
      await pageResults[0].promise
      await Promise.resolve()
    })
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).toBe('hidden')

    await act(async () => {
      pageResults[1].resolve(pageData)
      await pageResults[1].promise
      await Promise.resolve()
    })
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).toBe('hidden')

    await act(async () => {
      pageResults[2].resolve(pageData)
      await pageResults[2].promise
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(rendered.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).not.toBe('hidden')

    rendered.unmount()
    sdk.destroy()
  })

  it('keeps a new no-handoff route pending until its deferred page response settles', async () => {
    const deferredPage = createDeferred()
    const baselineEntry = createOptimizableTestEntry('baseline-entry')
    const selectedEntry = createTestEntry('selected-entry')
    const selections = createMutableObservable(selectedOptimizations)
    const requestState = createMutableObservable<ExperienceRequestState>({ status: 'success' })
    const optimization = createOptimizationSdk({
      resolveOptimizedEntry: (entry, currentSelections) =>
        currentSelections?.length
          ? { entry: selectedEntry, selectedOptimization: currentSelections[0] }
          : { entry },
      states: {
        canOptimize: createMutableObservable(true).observable,
        experienceRequestState: requestState.observable,
        selectedOptimizations: selections.observable,
      },
    })
    optimization.trackCurrentPage = async ({ routeKey }) => {
      if (routeKey === '/baseline') {
        requestState.emit({ status: 'pending' })
        await deferredPage.promise
        selections.emit([])
        requestState.emit({ status: 'success' })
      }

      return { accepted: true }
    }
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <OptimizationProvider sdk={optimization}>
        <TestRoutePageEmitter routeKey="/selected" />
        <OptimizedEntry baselineEntry={baselineEntry} liveUpdates={false}>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>,
    )
    expect(rendered.container.textContent).toContain(selectedEntry.sys.id)

    const baselineRoute = (
      <OptimizationProvider sdk={optimization}>
        <TestRoutePageEmitter routeKey="/baseline" />
        <OptimizedEntry key="baseline" baselineEntry={baselineEntry} liveUpdates={false}>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>
    )
    await rendered.renderAsync(baselineRoute)

    expect(rendered.container.textContent).toContain(baselineEntry.sys.id)
    expect(rendered.container.textContent).not.toContain(selectedEntry.sys.id)
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).toBe('hidden')

    await act(async () => {
      deferredPage.resolve(undefined)
      await deferredPage.promise
      await Promise.resolve()
    })

    expect(rendered.container.textContent).toContain(baselineEntry.sys.id)
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).not.toBe('hidden')

    rendered.unmount()
  })

  it('settles non-accepted and rejected route tracking on a baseline-safe presentation', async () => {
    for (const outcome of ['not-allowed', 'rejected'] as const) {
      const baselineEntry = createOptimizableTestEntry(`baseline-${outcome}`)
      const selectedEntry = createTestEntry(`selected-${outcome}`)
      const optimization = createOptimizationSdk({
        resolveOptimizedEntry: (entry, currentSelections) =>
          currentSelections?.length
            ? { entry: selectedEntry, selectedOptimization: currentSelections[0] }
            : { entry },
        states: {
          canOptimize: createMutableObservable(true).observable,
          experienceRequestState: createMutableObservable<ExperienceRequestState>({
            status: 'success',
          }).observable,
          selectedOptimizations: createMutableObservable(selectedOptimizations).observable,
        },
        trackCurrentPage: async ({ routeKey }) => {
          if (routeKey === '/selected') return await Promise.resolve({ accepted: true })
          if (outcome !== 'rejected') {
            return await Promise.resolve({ accepted: false as const, reason: outcome })
          }

          return await Promise.reject(new Error('page failed'))
        },
      })
      const rendered = createClientRoot()

      await rendered.renderAsync(
        <OptimizationProvider sdk={optimization}>
          <TestRoutePageEmitter routeKey="/selected" />
          <OptimizedEntry baselineEntry={baselineEntry} liveUpdates={false}>
            {(entry) => entry.sys.id}
          </OptimizedEntry>
        </OptimizationProvider>,
      )
      expect(rendered.container.textContent).toContain(selectedEntry.sys.id)

      await rendered.renderAsync(
        <OptimizationProvider sdk={optimization}>
          <TestRoutePageEmitter routeKey={`/${outcome}`} />
          <OptimizedEntry key={outcome} baselineEntry={baselineEntry} liveUpdates={false}>
            {(entry) => entry.sys.id}
          </OptimizedEntry>
        </OptimizationProvider>,
      )

      expect(rendered.container.textContent).toContain(baselineEntry.sys.id)
      expect(rendered.container.textContent).not.toContain(selectedEntry.sys.id)
      expect(
        rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
          .visibility,
      ).not.toBe('hidden')

      rendered.unmount()
    }
  })

  it('promotes an offline fallback after an explicit same-route retry succeeds', async () => {
    const pageData = {
      ...createServerOptimizationState('offline-retry-response'),
      selectedOptimizations,
    }
    const sdk = new ContentfulOptimization({
      ...testConfig,
      defaults: { consent: true, selectedOptimizations },
    })
    const upsertProfile = rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue(pageData)
    const rendered = createClientRoot()

    signals.online.value = false
    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk}>
        <TestRoutePageEmitter routeKey="/offline" />
        <OptimizedEntry baselineEntry={optimizedEntry} liveUpdates={false}>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>,
    )

    expect(upsertProfile).not.toHaveBeenCalled()
    expect(rendered.container.textContent).toContain(optimizedEntry.sys.id)
    expect(rendered.container.textContent).not.toContain('4k6ZyFQnR2POY5IJLLlJRb')

    await act(async () => {
      signals.online.value = true
      await sdk.trackCurrentPage({ routeKey: '/offline', buildPayload: () => ({}) })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(upsertProfile).toHaveBeenCalledTimes(1)
    expect(rendered.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')
    expect(rendered.container.textContent).not.toContain(optimizedEntry.sys.id)

    rendered.unmount()
    sdk.destroy()
  })

  it('promotes a consent-blocked fallback to live presentation after consent retry succeeds', async () => {
    const baselineEntry = createOptimizableTestEntry('consent-baseline')
    const selectedEntry = createTestEntry('consent-selected')
    const consent = createMutableObservable<boolean | undefined>(undefined)
    let pageTrackingAllowed = false
    const page = rs.fn(async () => await Promise.resolve({ accepted: true as const }))
    const optimization = createOptimizationSdk({
      hasConsent: () => pageTrackingAllowed,
      page,
      resolveOptimizedEntry: (entry, currentSelections) =>
        currentSelections?.length
          ? { entry: selectedEntry, selectedOptimization: currentSelections[0] }
          : { entry },
      states: {
        canOptimize: createMutableObservable(true).observable,
        consent: consent.observable,
        experienceRequestState: createMutableObservable<ExperienceRequestState>({
          status: 'success',
        }).observable,
        selectedOptimizations: createMutableObservable(selectedOptimizations).observable,
      },
    })
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <OptimizationProvider sdk={optimization}>
        <TestRoutePageEmitter routeKey="/consent" />
        <OptimizedEntry baselineEntry={baselineEntry} liveUpdates={false}>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>,
    )

    expect(page).not.toHaveBeenCalled()
    expect(rendered.container.textContent).toContain(baselineEntry.sys.id)
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).not.toBe('hidden')

    pageTrackingAllowed = true
    await act(async () => {
      consent.emit(true)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(page).toHaveBeenCalledTimes(1)
    expect(rendered.container.textContent).toContain(selectedEntry.sys.id)
    expect(rendered.container.textContent).not.toContain(baselineEntry.sys.id)

    rendered.unmount()
  })

  it('keeps a newer provider handoff authoritative when an older interceptor resolves last', async () => {
    const firstHandoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b')
    const secondHandoff = createContentHandoff('a19c3f54d2b84e37a93f6d1c0e5b7284')
    const firstHydration = createDeferred()
    const secondHydration = createDeferred()
    const sdk = new ContentfulOptimization(testConfig)
    sdk.interceptors.state.add(async (incoming) => {
      if (incoming.profile?.id === firstHandoff.state?.profile?.id) await firstHydration.promise
      if (incoming.profile?.id === secondHandoff.state?.profile?.id) await secondHydration.promise

      return incoming
    })
    const rendered = createClientRoot()

    rendered.render(
      <OptimizationProvider sdk={sdk}>
        <div />
      </OptimizationProvider>,
    )
    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={firstHandoff}>
        <div />
      </OptimizationProvider>,
    )
    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={secondHandoff}>
        <div />
      </OptimizationProvider>,
    )

    secondHydration.resolve(undefined)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(sdk.states.profile.current).toEqual(secondHandoff.state?.profile)

    firstHydration.resolve(undefined)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(sdk.states.profile.current).toEqual(secondHandoff.state?.profile)

    rendered.unmount()
    sdk.destroy()
  })

  it('retains a successfully hydrated later private handoff when page tracking is not allowed', async () => {
    const handoff = createContentHandoff('private-handoff', {
      initialPageEvent: 'emit',
      state: {
        ...createServerOptimizationState('private-handoff'),
        selectedOptimizations,
      },
    })
    const trackingStarted = createDeferred()
    const sdk = new ContentfulOptimization({
      ...testConfig,
      defaults: { consent: true },
    })
    const trackCurrentPage = rs.fn(async () => {
      trackingStarted.resolve(undefined)
      return await Promise.resolve({ accepted: false as const, reason: 'not-allowed' as const })
    })
    Reflect.set(sdk, 'trackCurrentPage', trackCurrentPage)
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk}>
        <div />
      </OptimizationProvider>,
    )
    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={handoff}>
        <TestRoutePageEmitter routeKey="/private-handoff" />
        <OptimizedEntry baselineEntry={optimizedEntry} liveUpdates={false}>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>,
    )
    await act(async () => {
      await trackingStarted.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/private-handoff',
    })
    expect(rendered.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')
    expect(rendered.container.textContent).not.toContain(optimizedEntry.sys.id)

    rendered.unmount()
    sdk.destroy()
  })

  it('keeps rejected hydration on its snapshot after response-less page settlement', async () => {
    const hydrationError = new Error('later hydration failed')
    const handoff = createContentHandoff('rejected-handoff', {
      hydration: 'client-only-hidden-until-ready',
      initialPageEvent: 'emit',
      state: {
        ...createServerOptimizationState('rejected-handoff'),
        selectedOptimizations,
      },
    })
    const sdk = new ContentfulOptimization({
      ...testConfig,
      defaults: { consent: true },
    })
    sdk.interceptors.state.add(async (incoming) => {
      if (incoming.profile?.id === handoff.state?.profile?.id) {
        return await Promise.reject(hydrationError)
      }

      return await Promise.resolve(incoming)
    })
    const trackCurrentPage = rs.spyOn(sdk, 'trackCurrentPage')
    const rendered = createClientRoot()
    let capturedError: Error | undefined = undefined

    function ErrorProbe(): null {
      capturedError = useOptimizationContext().error
      return null
    }

    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk}>
        <ErrorProbe />
      </OptimizationProvider>,
    )
    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={handoff}>
        <ErrorProbe />
        <TestRoutePageEmitter initialPageEvent="skip" routeKey="/rejected-handoff" />
        <OptimizedEntry baselineEntry={optimizedEntry} liveUpdates>
          {(entry) => entry.sys.id}
        </OptimizedEntry>
      </OptimizationProvider>,
    )

    expect(capturedError).toBe(hydrationError)
    expect(trackCurrentPage).toHaveBeenCalledWith({
      initialPageEvent: 'skip',
      routeKey: '/rejected-handoff',
    })
    expect(rendered.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')
    expect(
      rendered.container.querySelector<HTMLElement>('[data-ctfl-loading-layout-target]')?.style
        .visibility,
    ).not.toBe('hidden')

    rendered.unmount()
    sdk.destroy()
  })

  it('does not apply or terminalize later hydration after the provider unmounts', async () => {
    const initialState = createServerOptimizationState('initial-profile')
    const handoff = createContentHandoff('unmounted-handoff')
    const hydrationStarted = createDeferred()
    const hydrationContinuation = createDeferred()
    const sdk = new ContentfulOptimization({
      ...testConfig,
      defaults: { consent: true, profile: initialState.profile },
    })
    sdk.interceptors.state.add(async (incoming) => {
      if (incoming.profile?.id === handoff.state?.profile?.id) {
        hydrationStarted.resolve(undefined)
        await hydrationContinuation.promise
      }

      return incoming
    })
    const rendered = createClientRoot()

    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk}>
        <div />
      </OptimizationProvider>,
    )
    await rendered.renderAsync(
      <OptimizationProvider sdk={sdk} handoff={handoff}>
        <div />
      </OptimizationProvider>,
    )
    await hydrationStarted.promise

    rendered.unmount()
    await act(async () => {
      hydrationContinuation.resolve(undefined)
      await hydrationContinuation.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(sdk.states.profile.current).toEqual(initialState.profile)
    sdk.destroy()
  })

  it('renders config-only children from a snapshot during server render', () => {
    let experienceRequestStatus: string | undefined = undefined

    function Probe(): ReactElement {
      const sdk = useOptimization()
      experienceRequestStatus = sdk.states.experienceRequestState.current.status

      return <span>{experienceRequestStatus}</span>
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

    expect(markup).toContain('success')
    expect(experienceRequestStatus).toBe('success')
    expect(window.contentfulOptimization).toBeUndefined()
  })

  it('renders handoff state during server render', () => {
    const handoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b')
    let profileFromChild: OptimizationData['profile'] | undefined = undefined
    let consentFromChild: boolean | undefined = undefined
    let pageConsentFromChild = false
    let trackConsentFromChild = true

    function Probe(): ReactElement {
      const sdk = useOptimization()
      profileFromChild = sdk.states.profile.current
      consentFromChild = sdk.states.consent.current
      pageConsentFromChild = sdk.hasConsent('page')
      trackConsentFromChild = sdk.hasConsent('track')

      return <span>{sdk.states.profile.current?.id}</span>
    }

    const markup = renderToString(
      <OptimizationProvider
        clientId={testConfig.clientId}
        defaults={{ consent: false, persistenceConsent: false }}
        environment={testConfig.environment}
        api={testConfig.api}
        handoff={handoff}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(markup).toContain('f0837d7dc6344c36a3a0a06c4cde754b')
    expect(profileFromChild).toEqual(handoff.state?.profile)
    expect(consentFromChild).toBe(false)
    expect(pageConsentFromChild).toBe(true)
    expect(trackConsentFromChild).toBe(false)
    expect(window.contentfulOptimization).toBeUndefined()
  })

  it('rejects unsafe handoff state before server snapshot children render', () => {
    const handoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b', {
      cache: { scope: 'static' },
    })
    let childRendered = false

    function Probe(): ReactElement {
      childRendered = true

      return <span>unsafe</span>
    }

    expect(() => {
      renderToString(
        <OptimizationProvider
          clientId={testConfig.clientId}
          environment={testConfig.environment}
          api={testConfig.api}
          handoff={handoff}
        >
          <Probe />
        </OptimizationProvider>,
      )
    }).toThrow('Profile state should not be included in public or static optimization caches.')
    expect(childRendered).toBe(false)
    expect(window.contentfulOptimization).toBeUndefined()
  })

  it('resolves server-selected entries from the snapshot during server render', () => {
    const handoff = createContentHandoff('f0837d7dc6344c36a3a0a06c4cde754b', {
      state: {
        ...createServerOptimizationState('f0837d7dc6344c36a3a0a06c4cde754b'),
        selectedOptimizations,
      },
    })
    let resolvedEntryId: string | undefined = undefined

    function Probe(): ReactElement {
      resolvedEntryId = useOptimization().resolveOptimizedEntry(optimizedEntry).entry.sys.id

      return <span>{resolvedEntryId}</span>
    }

    const markup = renderToString(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        handoff={handoff}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(markup).toContain('4k6ZyFQnR2POY5IJLLlJRb')
    expect(resolvedEntryId).toBe('4k6ZyFQnR2POY5IJLLlJRb')
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

  it('renders injected sdk children during server render before client-only state setup', () => {
    const sdk = createOptimizationSdk()
    const onStatesReady = rs.fn()
    let childRendered = false
    let capturedOptimization: ReturnType<typeof useOptimization> | undefined = undefined

    function Probe(): null {
      childRendered = true
      capturedOptimization = useOptimization()
      return null
    }

    const markup = renderToString(
      <OptimizationProvider sdk={sdk} onStatesReady={onStatesReady}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(markup).toBe('')
    expect(childRendered).toBe(true)
    expect(requireOptimizationSdk(capturedOptimization)).toBe(sdk)
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

    expect(capturedContext).toEqual(expect.objectContaining({ sdk: undefined, error }))
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
