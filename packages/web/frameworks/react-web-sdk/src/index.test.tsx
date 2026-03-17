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
  useLiveUpdates,
  useOptimization,
  type UseOptimizationResult,
} from './index'
import {
  captureRenderError,
  createObservable,
  createOptimizationSdk,
  createTestEntry,
  requireOptimizationContext,
  requireOptimizationResult,
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
    expect(OptimizedEntry).toBeTypeOf('function')
  })

  it('creates optimization instance from config props via OptimizationProvider', () => {
    let capturedContext: OptimizationContextValue | null = null

    function Probe(): null {
      capturedContext = useOptimization()
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

    const optimizationContext = requireOptimizationContext(capturedContext)

    expect(optimizationContext.sdk).toBeInstanceOf(ContentfulOptimization)
    expect(optimizationContext.isReady).toBe(true)
    expect(optimizationContext.error).toBeUndefined()
  })

  it('provides optimization and live updates from OptimizationRoot', () => {
    let capturedContext: OptimizationContextValue | null = null
    let capturedGlobalLiveUpdates: boolean | null = null

    function Probe(): null {
      capturedContext = useOptimization()
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

    const optimizationContext = requireOptimizationContext(capturedContext)

    expect(optimizationContext.sdk).toBeInstanceOf(ContentfulOptimization)
    expect(optimizationContext.isReady).toBe(true)
    expect(capturedGlobalLiveUpdates).toBe(true)
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

  it('returns provider initialization state when the sdk is unavailable', () => {
    const initializationError = new Error('SDK initialization failed.')
    let capturedContext: OptimizationContextValue | null = null

    function Probe(): null {
      capturedContext = useOptimization()
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

  it('delegates tracking helpers from useOptimization to the optimization instance', async () => {
    const trackViewCalls: unknown[] = []
    const trackView = async (input: unknown): Promise<undefined> => {
      trackViewCalls.push(input)
      await Promise.resolve()
      return undefined
    }
    let optimization: UseOptimizationResult | undefined = undefined

    function Probe(): null {
      optimization = useOptimization()
      return null
    }

    const sdk = createOptimizationSdk({ trackView })
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

    const optimizationResult = requireOptimizationResult(optimization)
    const viewPayload = {
      componentId: 'hero',
      variantIndex: 0,
      viewId: 'view-1',
      viewDurationMs: 1,
    }

    await expect(optimizationResult.trackView(viewPayload)).resolves.toBeUndefined()

    expect(trackViewCalls).toEqual([viewPayload])
  })

  it('keeps useOptimization tracking helpers inert while the sdk is unavailable', async () => {
    let optimization: UseOptimizationResult | undefined = undefined

    function Probe(): null {
      optimization = useOptimization()
      return null
    }

    renderToString(
      <OptimizationContext.Provider
        value={{ sdk: undefined, isReady: false, error: new Error('SDK unavailable.') }}
      >
        <Probe />
      </OptimizationContext.Provider>,
    )

    const optimizationResult = requireOptimizationResult(optimization)

    await expect(
      optimizationResult.trackView({
        componentId: 'hero',
        variantIndex: 0,
        viewId: 'view-1',
        viewDurationMs: 1,
      }),
    ).resolves.toBeUndefined()
  })

  it('delegates entry resolution from useOptimization to the optimization instance', () => {
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
    let optimization: UseOptimizationResult | undefined = undefined

    function Probe(): null {
      optimization = useOptimization()
      return null
    }

    const sdk: OptimizationSdk = createOptimizationSdk({
      personalizeEntry: (
        entry: Entry,
        selectedPersonalizations: unknown,
      ): { entry: Entry; personalization: undefined } => {
        personalizeEntryCalls.push([entry, selectedPersonalizations])
        return personalizeEntry(entry, selectedPersonalizations)
      },
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
    })
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

    const optimizationResult = requireOptimizationResult(optimization)

    const baselineEntry = createTestEntry('entry-1')

    expect(optimizationResult.resolveEntry(baselineEntry)).toEqual({
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

  it('keeps useOptimization entry resolution inert while the sdk is unavailable', () => {
    let optimization: UseOptimizationResult | undefined = undefined

    function Probe(): null {
      optimization = useOptimization()
      return null
    }

    renderToString(
      <OptimizationContext.Provider
        value={{ sdk: undefined, isReady: false, error: new Error('SDK unavailable.') }}
      >
        <Probe />
      </OptimizationContext.Provider>,
    )

    const optimizationResult = requireOptimizationResult(optimization)
    const baselineEntry = createTestEntry('entry-1')

    expect(optimizationResult.resolveEntry(baselineEntry)).toEqual(baselineEntry)
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
