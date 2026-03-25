import ContentfulOptimization from '@contentful/optimization-web'
import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import { rs } from '@rstest/core'
import type { Entry } from 'contentful'
import type { ReactElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import {
  LiveUpdatesProvider,
  OptimizationContext,
  OptimizationProvider,
  OptimizationRoot,
  OptimizedEntry,
  useLiveUpdates,
  useOptimization,
  useOptimizationContext,
  useOptimizedEntry,
  type OptimizationContextValue,
  type UseOptimizationResult,
} from './index'
import {
  captureRenderError,
  createObservable,
  createOptimizationSdk,
  createTestEntry,
  requireOptimizationResult,
} from './test/sdkTestUtils'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

describe('@contentful/optimization-react-web core providers', () => {
  it('exports core API symbols', () => {
    expect(OptimizationContext).toBeDefined()
    expect(LiveUpdatesProvider).toBeTypeOf('function')
    expect(OptimizationProvider).toBeTypeOf('function')
    expect(OptimizationRoot).toBeTypeOf('function')
    expect(useOptimization).toBeTypeOf('function')
    expect(useOptimizationContext).toBeTypeOf('function')
    expect(useOptimizedEntry).toBeTypeOf('function')
    expect(useLiveUpdates).toBeTypeOf('function')
    expect(OptimizedEntry).toBeTypeOf('function')
  })

  it('creates optimization instance from config props via OptimizationProvider', () => {
    let capturedOptimization: UseOptimizationResult | undefined = undefined

    function Probe(): null {
      capturedOptimization = useOptimization()
      return null
    }

    renderToString(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
      >
        <Probe />
      </OptimizationProvider>,
    )

    const optimization = requireOptimizationResult(capturedOptimization)

    expect(optimization.sdk).toBeInstanceOf(ContentfulOptimization)
    expect(optimization.interactionTracking).toBeDefined()
    expect(optimization.resolveEntry).toBeTypeOf('function')
  })

  it('provides optimization and live updates from OptimizationRoot', () => {
    let capturedOptimization: UseOptimizationResult | undefined = undefined
    let capturedGlobalLiveUpdates: boolean | null = null

    function Probe(): null {
      capturedOptimization = useOptimization()
      const { globalLiveUpdates } = useLiveUpdates()
      capturedGlobalLiveUpdates = globalLiveUpdates
      return null
    }

    renderToString(
      <OptimizationRoot
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
        liveUpdates={true}
      >
        <Probe />
      </OptimizationRoot>,
    )

    const optimization = requireOptimizationResult(capturedOptimization)

    expect(optimization.sdk).toBeInstanceOf(ContentfulOptimization)
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

  it('exposes interaction tracking and resolved-entry helpers from useOptimization', () => {
    const personalizeEntryCalls: unknown[] = []
    let capturedOptimization: UseOptimizationResult | undefined = undefined

    function Probe(): null {
      capturedOptimization = useOptimization()
      return null
    }

    const sdk = createOptimizationSdk({
      personalizeEntry: (entry: Entry, selectedPersonalizations?: SelectedPersonalizationArray) => {
        personalizeEntryCalls.push([entry, selectedPersonalizations])
        return {
          entry: {
            ...entry,
            sys: {
              ...entry.sys,
              id: 'entry-variant',
            },
          },
          personalization: undefined,
        }
      },
      states: {
        selectedPersonalizations: createObservable([
          {
            experienceId: 'exp-a',
            variantIndex: 1,
            variants: { baseline: 'entry-variant' },
          },
        ]),
      },
    })

    renderToString(
      <OptimizationContext.Provider value={{ sdk, isReady: true, error: undefined }}>
        <Probe />
      </OptimizationContext.Provider>,
    )

    const optimization = requireOptimizationResult(capturedOptimization)
    const baselineEntry = createTestEntry('entry-1')

    expect(optimization.interactionTracking).toBe(sdk.tracking)
    expect(optimization.resolveEntry(baselineEntry).sys.id).toBe('entry-variant')
    expect(optimization.resolveEntryData(baselineEntry)).toEqual({
      entry: {
        ...baselineEntry,
        sys: {
          ...baselineEntry.sys,
          id: 'entry-variant',
        },
      },
      personalization: undefined,
    })
    expect(personalizeEntryCalls).toEqual([
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
        api={testConfig.api}
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

    renderToString(<FirstScenario />)
    renderToString(<SecondScenario />)

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

  it('uses an injected sdk instance without taking ownership of teardown', () => {
    const sdk = createOptimizationSdk()
    const destroySpy = rs.spyOn(sdk, 'destroy')
    let capturedOptimization: UseOptimizationResult | undefined = undefined
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

    const optimization = requireOptimizationResult(capturedOptimization)

    expect(optimization.sdk).toBe(sdk)

    act(() => {
      root.unmount()
    })

    expect(destroySpy).not.toHaveBeenCalled()
    container.remove()
  })
})
