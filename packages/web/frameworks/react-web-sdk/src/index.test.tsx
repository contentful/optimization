import ContentfulOptimization from '@contentful/optimization-web'
import type { Entry } from 'contentful'
import type { ReactElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import {
  LiveUpdatesProvider,
  OptimizationContext,
  type OptimizationContextValue,
  OptimizationProvider,
  OptimizationRoot,
  OptimizedEntry,
  type UseAnalyticsResult,
  type UsePersonalizationResult,
  useAnalytics,
  useLiveUpdates,
  useOptimization,
  usePersonalization,
} from './index'
import {
  createObservable,
  createTestEntry,
  requireAnalyticsResult,
  requirePersonalizationResult,
} from './test/optimizationTestUtils'
import type { OptimizationSdk } from './types'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  analytics: { baseUrl: 'http://localhost:8000/insights/' },
  personalization: { baseUrl: 'http://localhost:8000/experience/' },
}

function cleanupGlobalInstance(): void {
  if (typeof window !== 'undefined' && window.contentfulOptimization) {
    window.contentfulOptimization.destroy()
  }
}

describe('@contentful/optimization-react-web core providers', () => {
  void beforeEach(() => {
    cleanupGlobalInstance()
  })

  void afterEach(() => {
    cleanupGlobalInstance()
  })

  it('exports core API symbols', () => {
    expect(OptimizationContext).toBeDefined()
    expect(LiveUpdatesProvider).toBeTypeOf('function')
    expect(OptimizationProvider).toBeTypeOf('function')
    expect(OptimizationRoot).toBeTypeOf('function')
    expect(useOptimization).toBeTypeOf('function')
    expect(useLiveUpdates).toBeTypeOf('function')
    expect(usePersonalization).toBeTypeOf('function')
    expect(OptimizedEntry).toBeTypeOf('function')
    expect(useAnalytics).toBeTypeOf('function')
  })

  it('creates optimization instance from config props via OptimizationProvider', () => {
    let capturedInstance: OptimizationSdk | null = null

    function Probe(): null {
      capturedInstance = useOptimization().sdk ?? null
      return null
    }

    renderToString(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        analytics={testConfig.analytics}
        personalization={testConfig.personalization}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(capturedInstance).toBeInstanceOf(ContentfulOptimization)
  })

  it('provides optimization and live updates from OptimizationRoot', () => {
    let capturedInstance: OptimizationSdk | null = null
    let capturedGlobalLiveUpdates: boolean | null = null

    function Probe(): null {
      capturedInstance = useOptimization().sdk ?? null
      const { globalLiveUpdates } = useLiveUpdates()
      capturedGlobalLiveUpdates = globalLiveUpdates
      return null
    }

    renderToString(
      <OptimizationRoot
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        analytics={testConfig.analytics}
        personalization={testConfig.personalization}
        liveUpdates={true}
      >
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedInstance).toBeInstanceOf(ContentfulOptimization)
    expect(capturedGlobalLiveUpdates).toBe(true)
  })

  it('throws actionable error when useOptimization is called outside provider', () => {
    function BrokenProbe(): null {
      useOptimization()
      return null
    }

    let capturedError: unknown = null

    try {
      renderToString(<BrokenProbe />)
    } catch (error: unknown) {
      capturedError = error
    }

    expect(capturedError).toBeInstanceOf(Error)
    if (!(capturedError instanceof Error)) {
      throw new Error('Expected useOptimization to throw an Error')
    }

    expect(capturedError.message).toContain(
      'useOptimization must be used within an OptimizationProvider',
    )
    expect(capturedError.message).toContain('<OptimizationRoot clientId="your-client-id">')
  })

  it('defaults liveUpdates to false in OptimizationRoot', () => {
    let capturedGlobalLiveUpdates = false

    function Probe(): null {
      const { globalLiveUpdates } = useLiveUpdates()
      capturedGlobalLiveUpdates = globalLiveUpdates
      return null
    }

    renderToString(
      <OptimizationRoot
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        analytics={testConfig.analytics}
        personalization={testConfig.personalization}
      >
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedGlobalLiveUpdates).toBe(false)
  })

  it('throws actionable error when useLiveUpdates is called outside provider', () => {
    function BrokenProbe(): null {
      useLiveUpdates()
      return null
    }

    let capturedError: unknown = null

    try {
      renderToString(<BrokenProbe />)
    } catch (error: unknown) {
      capturedError = error
    }

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
          analytics={testConfig.analytics}
          personalization={testConfig.personalization}
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
          analytics={testConfig.analytics}
          personalization={testConfig.personalization}
          liveUpdates={false}
        >
          <Probe liveUpdates={true} />
        </OptimizationRoot>
      )
    }

    renderToString(<FirstScenario />)
    cleanupGlobalInstance()
    renderToString(<SecondScenario />)

    expect(results).toEqual([true, false, true])
  })

  it('delegates analytics hook methods to the optimization instance', async () => {
    const trackViewCalls: unknown[] = []
    const trackView = async (input: unknown): Promise<undefined> => {
      trackViewCalls.push(input)
      await Promise.resolve()
      return undefined
    }
    let analytics: UseAnalyticsResult | undefined = undefined

    function Probe(): null {
      analytics = useAnalytics()
      return null
    }

    const sdk: OptimizationSdk = {
      consent: () => undefined,
      identify: async () => {
        await Promise.resolve()
        return undefined
      },
      page: async () => {
        await Promise.resolve()
        return undefined
      },
      personalizeEntry: (entry: Entry) => ({ entry }),
      reset: () => undefined,
      states: {
        blockedEventStream: createObservable(undefined),
        canPersonalize: createObservable(false),
        consent: createObservable(undefined),
        eventStream: createObservable(undefined),
        flag: () => createObservable(undefined),
        previewPanelAttached: createObservable(false),
        previewPanelOpen: createObservable(false),
        profile: createObservable(undefined),
        selectedPersonalizations: createObservable(undefined),
      },
      track: async () => {
        await Promise.resolve()
        return undefined
      },
      trackView,
    }
    const contextValue: OptimizationContextValue = {
      sdk,
      isReady: true,
      error: undefined,
    }

    renderToString(
      <OptimizationContext.Provider value={contextValue}>
        <Probe />
      </OptimizationContext.Provider>,
    )

    const analyticsResult = requireAnalyticsResult(analytics)
    const viewPayload = {
      componentId: 'hero',
      variantIndex: 0,
      viewId: 'view-1',
      viewDurationMs: 1,
    }

    await expect(analyticsResult.trackView(viewPayload)).resolves.toBeUndefined()

    expect(trackViewCalls).toEqual([viewPayload])
  })

  it('keeps analytics hook inert while the sdk is unavailable', () => {
    let analytics: UseAnalyticsResult | undefined = undefined

    function Probe(): null {
      analytics = useAnalytics()
      return null
    }

    renderToString(
      <OptimizationContext.Provider value={{ sdk: undefined, isReady: false, error: undefined }}>
        <Probe />
      </OptimizationContext.Provider>,
    )

    const analyticsResult = requireAnalyticsResult(analytics)

    expect(
      analyticsResult.trackView({
        componentId: 'hero',
        variantIndex: 0,
        viewId: 'view-1',
        viewDurationMs: 1,
      }),
    ).toBeUndefined()
  })

  it('delegates personalization hook entry resolution to the optimization instance', () => {
    const personalizeEntryCalls: unknown[] = []
    const personalizeEntry = (
      entry: Entry,
      _selectedPersonalizations: unknown,
    ): { entry: Entry; personalization: undefined } => ({
      entry: {
        ...entry,
        sys: {
          ...entry.sys,
          id: 'entry-1-variant',
        },
      },
      personalization: undefined,
    })
    let personalization: UsePersonalizationResult | undefined = undefined

    function Probe(): null {
      personalization = usePersonalization()
      return null
    }

    const sdk: OptimizationSdk = {
      consent: () => undefined,
      identify: async () => {
        await Promise.resolve()
        return undefined
      },
      page: async () => {
        await Promise.resolve()
        return undefined
      },
      personalizeEntry: (
        entry: Entry,
        selectedPersonalizations: unknown,
      ): { entry: Entry; personalization: undefined } => {
        personalizeEntryCalls.push([entry, selectedPersonalizations])
        return personalizeEntry(entry, selectedPersonalizations)
      },
      reset: () => undefined,
      states: {
        blockedEventStream: createObservable(undefined),
        canPersonalize: createObservable(false),
        consent: createObservable(undefined),
        eventStream: createObservable(undefined),
        flag: () => createObservable(undefined),
        previewPanelAttached: createObservable(false),
        previewPanelOpen: createObservable(false),
        profile: createObservable(undefined),
        selectedPersonalizations: createObservable([
          {
            experienceId: 'exp-a',
            variantIndex: 0,
            variants: { baseline: 'entry-1-variant' },
          },
        ]),
      },
      track: async () => {
        await Promise.resolve()
        return undefined
      },
      trackView: async () => {
        await Promise.resolve()
        return undefined
      },
    }
    const contextValue: OptimizationContextValue = {
      sdk,
      isReady: true,
      error: undefined,
    }

    renderToString(
      <OptimizationContext.Provider value={contextValue}>
        <Probe />
      </OptimizationContext.Provider>,
    )

    const personalizationResult = requirePersonalizationResult(personalization)

    const baselineEntry = createTestEntry('entry-1')

    expect(personalizationResult.resolveEntry(baselineEntry)).toEqual({
      ...baselineEntry,
      sys: {
        ...baselineEntry.sys,
        id: 'entry-1-variant',
      },
    })
    expect(personalizeEntryCalls).toEqual([
      [
        baselineEntry,
        [
          {
            experienceId: 'exp-a',
            variantIndex: 0,
            variants: { baseline: 'entry-1-variant' },
          },
        ],
      ],
    ])
  })

  it('keeps personalization hook inert while the sdk is unavailable', () => {
    let personalization: UsePersonalizationResult | undefined = undefined

    function Probe(): null {
      personalization = usePersonalization()
      return null
    }

    renderToString(
      <OptimizationContext.Provider value={{ sdk: undefined, isReady: false, error: undefined }}>
        <Probe />
      </OptimizationContext.Provider>,
    )

    const personalizationResult = requirePersonalizationResult(personalization)

    const baselineEntry = createTestEntry('entry-1')
    expect(personalizationResult.resolveEntry(baselineEntry)).toEqual(baselineEntry)
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
          analytics={testConfig.analytics}
          personalization={testConfig.personalization}
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
          analytics={testConfig.analytics}
          personalization={testConfig.personalization}
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
})
