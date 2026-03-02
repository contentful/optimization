import {
  LiveUpdatesProvider,
  OptimizationContext,
  OptimizationProvider,
  OptimizationRoot,
  useAnalytics,
  useLiveUpdates,
  useOptimization,
  usePersonalization,
} from './index'
import { renderToString } from 'react-dom/server'
import type { OptimizationWebSdk } from './types'

const optimizationInstance = { sdk: 'test-instance' } as unknown as OptimizationWebSdk

describe('@contentful/optimization-react-web core providers', () => {
  it('exports core API symbols', () => {
    expect(OptimizationContext).toBeDefined()
    expect(LiveUpdatesProvider).toBeTypeOf('function')
    expect(OptimizationProvider).toBeTypeOf('function')
    expect(OptimizationRoot).toBeTypeOf('function')
    expect(useOptimization).toBeTypeOf('function')
    expect(useLiveUpdates).toBeTypeOf('function')
    expect(usePersonalization).toBeTypeOf('function')
    expect(useAnalytics).toBeTypeOf('function')
  })

  it('provides optimization instance via OptimizationProvider', () => {
    let capturedInstance: OptimizationWebSdk | null = null

    function Probe(): null {
      capturedInstance = useOptimization()
      return null
    }

    renderToString(
      <OptimizationProvider instance={optimizationInstance}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(capturedInstance).toBe(optimizationInstance)
  })

  it('throws actionable error when useOptimization is called outside provider', () => {
    function BrokenProbe(): null {
      useOptimization()
      return null
    }

    expect(() => renderToString(<BrokenProbe />)).toThrow(
      'useOptimization must be used within an OptimizationProvider',
    )
    expect(() => renderToString(<BrokenProbe />)).toThrow(
      '<OptimizationProvider instance={optimizationInstance}>',
    )
  })

  it('defaults liveUpdates to false in OptimizationRoot', () => {
    let capturedGlobalLiveUpdates: boolean | null = null

    function Probe(): null {
      capturedGlobalLiveUpdates = useLiveUpdates()?.globalLiveUpdates ?? false
      return null
    }

    renderToString(
      <OptimizationRoot instance={optimizationInstance}>
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedGlobalLiveUpdates).toBe(false)
  })

  it('passes global live updates through context from OptimizationRoot', () => {
    let capturedGlobalLiveUpdates: boolean | null = null

    function Probe(): null {
      capturedGlobalLiveUpdates = useLiveUpdates()?.globalLiveUpdates ?? null
      return null
    }

    renderToString(
      <OptimizationRoot instance={optimizationInstance} liveUpdates={true}>
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedGlobalLiveUpdates).toBe(true)
  })

  it('returns null from useLiveUpdates outside provider', () => {
    let capturedContext: ReturnType<typeof useLiveUpdates> = undefined as never

    function Probe(): null {
      capturedContext = useLiveUpdates()
      return null
    }

    renderToString(<Probe />)

    expect(capturedContext).toBeNull()
  })

  it('provides both optimization instance and live updates via OptimizationRoot', () => {
    let capturedInstance: OptimizationWebSdk | null = null
    let capturedGlobalLiveUpdates: boolean | null = null

    function Probe(): null {
      capturedInstance = useOptimization()
      capturedGlobalLiveUpdates = useLiveUpdates()?.globalLiveUpdates ?? null
      return null
    }

    renderToString(
      <OptimizationRoot instance={optimizationInstance} liveUpdates={true}>
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedInstance).toBe(optimizationInstance)
    expect(capturedGlobalLiveUpdates).toBe(true)
  })

  it('supports live updates fallback semantics for dependent components', () => {
    const results: boolean[] = []

    function Probe({ liveUpdates }: { liveUpdates?: boolean }): null {
      const context = useLiveUpdates()
      const isLive = liveUpdates ?? context?.globalLiveUpdates ?? false
      results.push(isLive)
      return null
    }

    renderToString(
      <OptimizationRoot instance={optimizationInstance} liveUpdates={true}>
        <Probe />
        <Probe liveUpdates={false} />
      </OptimizationRoot>,
    )

    renderToString(
      <OptimizationRoot instance={optimizationInstance} liveUpdates={false}>
        <Probe liveUpdates={true} />
      </OptimizationRoot>,
    )

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
