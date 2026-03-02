import {
  OptimizationProvider,
  OptimizationRoot,
  useAnalytics,
  useOptimization,
  usePersonalization,
} from './index'

describe('@contentful/optimization-react-web scaffold', () => {
  it('exports scaffold API symbols', () => {
    expect(OptimizationProvider).toBeTypeOf('function')
    expect(OptimizationRoot).toBeTypeOf('function')
    expect(useOptimization).toBeTypeOf('function')
    expect(usePersonalization).toBeTypeOf('function')
    expect(useAnalytics).toBeTypeOf('function')
  })

  it('returns inert placeholder values', async () => {
    const optimization = useOptimization()
    const personalization = usePersonalization()
    const analytics = useAnalytics()

    expect(optimization.isReady).toBe(false)
    expect(optimization.optimization).toBeNull()
    expect(personalization.resolveEntry({ id: 'entry-1' })).toEqual({ id: 'entry-1' })

    await expect(analytics.identify('user-1')).resolves.toBeUndefined()
    await expect(analytics.track({ event: 'view' })).resolves.toBeUndefined()
    await expect(analytics.reset()).resolves.toBeUndefined()
  })
})
