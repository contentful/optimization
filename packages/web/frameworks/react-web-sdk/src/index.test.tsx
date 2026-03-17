import ContentfulOptimization from '@contentful/optimization-web'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import {
  LiveUpdatesProvider,
  OptimizationContext,
  OptimizationProvider,
  OptimizationRoot,
  OptimizedEntry,
  useAnalytics,
  useLiveUpdates,
  useOptimization,
  usePersonalization,
} from './index'

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
    let capturedInstance: ContentfulOptimization | null = null

    function Probe(): null {
      capturedInstance = useOptimization()
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
    let capturedInstance: ContentfulOptimization | null = null
    let capturedGlobalLiveUpdates: boolean | null = null

    function Probe(): null {
      capturedInstance = useOptimization()
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

  it('keeps non-core hooks inert placeholders for now', async () => {
    const personalization = usePersonalization()
    const analytics = useAnalytics()

    expect(personalization.resolveEntry({ id: 'entry-1' })).toEqual({ id: 'entry-1' })
    await expect(analytics.identify('user-1')).resolves.toBeUndefined()
    await expect(analytics.track({ event: 'view' })).resolves.toBeUndefined()
    await expect(analytics.reset()).resolves.toBeUndefined()
  })
})
