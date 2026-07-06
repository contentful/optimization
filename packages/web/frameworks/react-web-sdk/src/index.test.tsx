import ContentfulOptimization from '@contentful/optimization-web'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { rs } from '@rstest/core'
import type { Entry } from 'contentful'
import { act, StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import {
  LiveUpdatesProvider,
  OptimizationContext,
  OptimizationProvider,
  OptimizationRoot,
  OptimizedEntry,
  useCanOptimizeState,
  useConsentState,
  useEntryResolver,
  useEventStreamState,
  useLiveUpdates,
  useOptimization,
  useOptimizationActions,
  useOptimizationContext,
  useOptimizedEntry,
  useProfileState,
  useSelectedOptimizationsState,
  type OptimizationContextValue,
  type OptimizationSdk,
  type UseEntryResolverResult,
  type UseOptimizationActionsResult,
} from './index'
import {
  captureRenderError,
  createObservable,
  createOptimizationSdk,
  createTestEntry,
  requireOptimizationSdk,
} from './test/sdkTestUtils'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

function renderClient(element: ReactElement): {
  rerender: (next: ReactElement) => void
  unmount: () => void
} {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    rerender(next: ReactElement) {
      act(() => {
        root.render(next)
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

function requireEntryResolver(value: UseEntryResolverResult | undefined): UseEntryResolverResult {
  if (value === undefined) {
    throw new Error('Expected entry resolver to be captured')
  }

  return value
}

describe('@contentful/optimization-react-web core providers', () => {
  it('exports core API symbols', () => {
    expect(OptimizationContext).toBeDefined()
    expect(LiveUpdatesProvider).toBeTypeOf('function')
    expect(OptimizationProvider).toBeTypeOf('function')
    expect(OptimizationRoot).toBeTypeOf('function')
    expect(useEntryResolver).toBeTypeOf('function')
    expect(useCanOptimizeState).toBeTypeOf('function')
    expect(useConsentState).toBeTypeOf('function')
    expect(useEventStreamState).toBeTypeOf('function')
    expect(useOptimization).toBeTypeOf('function')
    expect(useOptimizationActions).toBeTypeOf('function')
    expect(useOptimizationContext).toBeTypeOf('function')
    expect(useOptimizedEntry).toBeTypeOf('function')
    expect(useProfileState).toBeTypeOf('function')
    expect(useSelectedOptimizationsState).toBeTypeOf('function')
    expect(useLiveUpdates).toBeTypeOf('function')
    expect(OptimizedEntry).toBeTypeOf('function')
  })

  it('creates optimization instance from config props via OptimizationProvider', () => {
    let capturedOptimization: OptimizationSdk | undefined = undefined

    function Probe(): null {
      capturedOptimization = useOptimization()
      return null
    }

    const rendered = renderClient(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        locale="de-DE"
      >
        <Probe />
      </OptimizationProvider>,
    )

    const optimization = requireOptimizationSdk(capturedOptimization)

    expect(optimization).toBeInstanceOf(ContentfulOptimization)
    expect(optimization.locale).toBe('de-DE')
    expect(optimization.trackHover).toBeTypeOf('function')
    expect(optimization.tracking).toBeDefined()
    rendered.unmount()

    capturedOptimization = undefined
    const withoutLocale = renderClient(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(requireOptimizationSdk(capturedOptimization).locale).toBeUndefined()
    withoutLocale.unmount()
  })

  it('does not create an owned optimization instance during server render', () => {
    let renderedChild = false

    function Probe(): null {
      renderedChild = true
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

    expect(markup).toBe('')
    expect(renderedChild).toBe(false)
    expect(window.contentfulOptimization).toBeUndefined()
  })

  it('provides optimization and live updates from OptimizationRoot', () => {
    let capturedOptimization: OptimizationSdk | undefined = undefined
    let capturedGlobalLiveUpdates: boolean | null = null

    function Probe(): null {
      capturedOptimization = useOptimization()
      const { globalLiveUpdates } = useLiveUpdates()
      capturedGlobalLiveUpdates = globalLiveUpdates
      return null
    }

    const rendered = renderClient(
      <OptimizationRoot
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        liveUpdates={true}
      >
        <Probe />
      </OptimizationRoot>,
    )

    const optimization = requireOptimizationSdk(capturedOptimization)

    expect(optimization).toBeInstanceOf(ContentfulOptimization)
    expect(capturedGlobalLiveUpdates).toBe(true)
    rendered.unmount()
  })

  it('throws actionable error when useOptimization is called outside provider', () => {
    function BrokenProbe(): null {
      useOptimization()
      return null
    }

    const capturedError = captureRenderError(<BrokenProbe />)

    expect(capturedError).toBeInstanceOf(Error)
    if (!(capturedError instanceof Error)) {
      throw new Error('Expected useOptimization to throw an Error')
    }

    expect(capturedError.message).toContain(
      'useOptimization must be used within an OptimizationProvider',
    )
    expect(capturedError.message).toContain('<OptimizationRoot clientId="your-client-id">')
  })

  it('returns provider initialization state from useOptimizationContext when the sdk is unavailable', () => {
    const initializationError = new Error('SDK initialization failed.')
    let capturedContext: OptimizationContextValue | null = null

    function Probe(): null {
      capturedContext = useOptimizationContext()
      return null
    }

    renderToString(
      <OptimizationContext.Provider
        value={{ sdk: undefined, isReady: false, error: initializationError }}
      >
        <Probe />
      </OptimizationContext.Provider>,
    )

    expect(capturedContext).toEqual(
      expect.objectContaining({
        sdk: undefined,
        isReady: false,
        error: initializationError,
      }),
    )
  })

  it('throws when useOptimization is called before readiness', () => {
    function BrokenProbe(): null {
      useOptimization()
      return null
    }

    const capturedError = captureRenderError(
      <OptimizationContext.Provider
        value={{ sdk: undefined, isReady: false, error: new Error('SDK unavailable.') }}
      >
        <BrokenProbe />
      </OptimizationContext.Provider>,
    )

    expect(capturedError).toBeInstanceOf(Error)
    if (!(capturedError instanceof Error)) {
      throw new Error('Expected useOptimization to throw an Error')
    }

    expect(capturedError.message).toContain('ContentfulOptimization SDK failed to initialize')
  })

  it('throws actionable error when useOptimizationContext is called outside provider', () => {
    function BrokenProbe(): null {
      useOptimizationContext()
      return null
    }

    const capturedError = captureRenderError(<BrokenProbe />)

    expect(capturedError).toBeInstanceOf(Error)
    if (!(capturedError instanceof Error)) {
      throw new Error('Expected useOptimizationContext to throw an Error')
    }

    expect(capturedError.message).toContain(
      'useOptimization must be used within an OptimizationProvider',
    )
  })

  it('returns the SDK from useOptimization and exposes resolved-entry helpers from useEntryResolver', () => {
    const resolveOptimizedEntryCalls: unknown[] = []
    let capturedOptimization: OptimizationSdk | undefined = undefined
    let capturedResolver: UseEntryResolverResult | undefined = undefined

    function Probe(): null {
      capturedOptimization = useOptimization()
      capturedResolver = useEntryResolver()
      return null
    }

    const selectedOptimizationState: SelectedOptimizationArray = [
      {
        experienceId: 'exp-a',
        variantIndex: 1,
        variants: { baseline: 'entry-variant' },
      },
    ]
    const sdk = createOptimizationSdk({
      resolveOptimizedEntry: (entry: Entry, selectedOptimizations?: SelectedOptimizationArray) => {
        resolveOptimizedEntryCalls.push([entry, selectedOptimizations ?? selectedOptimizationState])
        return {
          entry: {
            ...entry,
            sys: {
              ...entry.sys,
              id: 'entry-variant',
            },
          },
          selectedOptimization: undefined,
        }
      },
      states: {
        selectedOptimizations: createObservable(selectedOptimizationState),
      },
    })

    renderToString(
      <OptimizationContext.Provider value={{ sdk, isReady: true, error: undefined }}>
        <Probe />
      </OptimizationContext.Provider>,
    )

    const optimization = requireOptimizationSdk(capturedOptimization)
    const resolver = requireEntryResolver(capturedResolver)
    const baselineEntry = createTestEntry('entry-1')

    expect(optimization.tracking).toBe(sdk.tracking)
    expect(optimization.trackHover).toBe(sdk.trackHover)
    expect(resolver.resolveEntry(baselineEntry).sys.id).toBe('entry-variant')
    expect(resolver.resolveEntryData(baselineEntry)).toEqual({
      entry: {
        ...baselineEntry,
        sys: {
          ...baselineEntry.sys,
          id: 'entry-variant',
        },
      },
      selectedOptimization: undefined,
    })
    expect(resolveOptimizedEntryCalls).toEqual([
      [
        baselineEntry,
        [
          {
            experienceId: 'exp-a',
            variantIndex: 1,
            variants: { baseline: 'entry-variant' },
          },
        ],
      ],
      [
        baselineEntry,
        [
          {
            experienceId: 'exp-a',
            variantIndex: 1,
            variants: { baseline: 'entry-variant' },
          },
        ],
      ],
    ])
  })

  it('exposes bound SDK action hooks that are safe to destructure', async () => {
    const thisValues: unknown[] = []
    const consent: OptimizationSdk['consent'] = rs.fn(function (this: OptimizationSdk, value) {
      thisValues.push(this)
      expect(value).toBe(true)
    })
    const flush: OptimizationSdk['flush'] = rs.fn(async function (this: OptimizationSdk) {
      thisValues.push(this)
      await Promise.resolve()
    })
    const identify: OptimizationSdk['identify'] = rs.fn(async function (this: OptimizationSdk) {
      thisValues.push(this)
      await Promise.resolve()
      return { accepted: true }
    })
    const page: OptimizationSdk['page'] = rs.fn(async function (this: OptimizationSdk) {
      thisValues.push(this)
      await Promise.resolve()
      return { accepted: true }
    })
    const reset: OptimizationSdk['reset'] = rs.fn(function (this: OptimizationSdk) {
      thisValues.push(this)
    })
    const screen: OptimizationSdk['screen'] = rs.fn(async function (this: OptimizationSdk) {
      thisValues.push(this)
      await Promise.resolve()
      return { accepted: true }
    })
    const setLocale = rs.fn(() => undefined)
    const track: OptimizationSdk['track'] = rs.fn(async function (this: OptimizationSdk) {
      thisValues.push(this)
      await Promise.resolve()
      return { accepted: true }
    })
    const trackClick: OptimizationSdk['trackClick'] = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const trackView: OptimizationSdk['trackView'] = rs.fn(async () => {
      await Promise.resolve()
      return { accepted: true }
    })
    const captures: UseOptimizationActionsResult[] = []

    function Probe(): null {
      captures.push(useOptimizationActions())
      return null
    }

    const sdk = createOptimizationSdk({
      consent,
      flush,
      identify,
      page,
      reset,
      screen,
      setLocale,
      track,
      trackClick,
      trackView,
    })

    const rendered = renderClient(
      <OptimizationContext.Provider value={{ sdk, isReady: true, error: undefined }}>
        <Probe />
      </OptimizationContext.Provider>,
    )

    rendered.rerender(
      <OptimizationContext.Provider value={{ sdk, isReady: true, error: undefined }}>
        <Probe />
      </OptimizationContext.Provider>,
    )

    const [firstRender, secondRender] = captures

    expect(secondRender).toBeDefined()
    if (!firstRender || !secondRender) {
      throw new Error('Expected action-hook captures across renders')
    }

    expect(secondRender).toBe(firstRender)

    firstRender.setConsent(true)
    await firstRender.flushEvents()
    await firstRender.identifyUser({ userId: 'user-1' })
    await firstRender.trackPageView({ properties: { title: 'Home' } })
    firstRender.resetUser()
    await firstRender.trackScreen({ name: 'Cart', properties: { source: 'test' } })
    await firstRender.trackEvent({ event: 'purchase', properties: { revenue: 99 } })

    expect(consent).toHaveBeenCalledWith(true)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(identify).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(page).toHaveBeenCalledWith({ properties: { title: 'Home' } })
    expect(reset).toHaveBeenCalledTimes(1)
    expect(screen).toHaveBeenCalledWith({ name: 'Cart', properties: { source: 'test' } })
    expect(track).toHaveBeenCalledWith({ event: 'purchase', properties: { revenue: 99 } })
    expect(thisValues).toEqual([sdk, sdk, sdk, sdk, sdk, sdk, sdk])

    rendered.unmount()
  })

  it('defaults liveUpdates to false in OptimizationRoot', () => {
    let capturedGlobalLiveUpdates = false

    function Probe(): null {
      const { globalLiveUpdates } = useLiveUpdates()
      capturedGlobalLiveUpdates = globalLiveUpdates
      return null
    }

    const rendered = renderClient(
      <OptimizationRoot
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
      >
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedGlobalLiveUpdates).toBe(false)
    rendered.unmount()
  })

  it('throws actionable error when useLiveUpdates is called outside provider', () => {
    function BrokenProbe(): null {
      useLiveUpdates()
      return null
    }

    const capturedError = captureRenderError(<BrokenProbe />)

    expect(capturedError).toBeInstanceOf(Error)
    if (!(capturedError instanceof Error)) {
      throw new Error('Expected useLiveUpdates to throw an Error')
    }

    expect(capturedError.message).toContain(
      'useLiveUpdates must be used within a LiveUpdatesProvider',
    )
  })

  it('supports live updates fallback semantics for dependent components', () => {
    const results: boolean[] = []

    function Probe({ liveUpdates }: { liveUpdates?: boolean }): null {
      const context = useLiveUpdates()
      const isLive = liveUpdates ?? context.globalLiveUpdates
      results.push(isLive)
      return null
    }

    function FirstScenario(): ReactElement {
      return (
        <OptimizationRoot
          clientId={`${testConfig.clientId}-1`}
          environment={testConfig.environment}
          api={testConfig.api}
          liveUpdates={true}
        >
          <Probe />
          <Probe liveUpdates={false} />
        </OptimizationRoot>
      )
    }

    function SecondScenario(): ReactElement {
      return (
        <OptimizationRoot
          clientId={`${testConfig.clientId}-2`}
          environment={testConfig.environment}
          api={testConfig.api}
          liveUpdates={false}
        >
          <Probe liveUpdates={true} />
        </OptimizationRoot>
      )
    }

    renderClient(<FirstScenario />).unmount()
    renderClient(<SecondScenario />).unmount()

    expect(results).toEqual([true, false, true])
  })

  it('destroys the optimization singleton on provider unmount', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        <OptimizationProvider
          clientId={testConfig.clientId}
          environment={testConfig.environment}
          api={testConfig.api}
        >
          <div />
        </OptimizationProvider>,
      )
    })

    expect(window.contentfulOptimization).toBeInstanceOf(ContentfulOptimization)

    act(() => {
      root.unmount()
    })

    expect(window.contentfulOptimization).toBeUndefined()

    const remountRoot = createRoot(container)

    act(() => {
      remountRoot.render(
        <OptimizationProvider
          clientId={testConfig.clientId}
          environment={testConfig.environment}
          api={testConfig.api}
        >
          <div />
        </OptimizationProvider>,
      )
    })

    expect(window.contentfulOptimization).toBeInstanceOf(ContentfulOptimization)

    act(() => {
      remountRoot.unmount()
    })

    container.remove()
  })

  it('cleans up layout-effect initialization during StrictMode replay', () => {
    const rendered = renderClient(
      <StrictMode>
        <OptimizationProvider
          clientId={testConfig.clientId}
          environment={testConfig.environment}
          api={testConfig.api}
        >
          <div />
        </OptimizationProvider>
      </StrictMode>,
    )

    expect(window.contentfulOptimization).toBeInstanceOf(ContentfulOptimization)

    rendered.unmount()

    expect(window.contentfulOptimization).toBeUndefined()
  })

  it('uses an injected sdk instance without taking ownership of teardown', () => {
    const sdk = createOptimizationSdk()
    const destroySpy = rs.spyOn(sdk, 'destroy')
    let capturedOptimization: OptimizationSdk | undefined = undefined
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    function Probe(): null {
      capturedOptimization = useOptimization()
      return null
    }

    act(() => {
      root.render(
        <OptimizationProvider sdk={sdk}>
          <Probe />
        </OptimizationProvider>,
      )
    })

    const optimization = requireOptimizationSdk(capturedOptimization)

    expect(optimization).toBe(sdk)

    act(() => {
      root.unmount()
    })

    expect(destroySpy).not.toHaveBeenCalled()
    container.remove()
  })
})
