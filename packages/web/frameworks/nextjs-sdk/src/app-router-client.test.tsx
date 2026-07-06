import * as appRouter from './app-router-client'
import * as client from './client'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

describe('Next.js App Router client components', () => {
  it('creates bound client components from config props without server-only config', () => {
    const components = appRouter.createNextjsAppRouterOptimization({
      ...testConfig,
      liveUpdates: true,
      server: { enabled: false },
    })

    const element = components.OptimizationRoot({ children: 'Bound content' })
    const provider = components.OptimizationProvider({ children: 'Provider content' })

    expect(components.OptimizedEntry).toBe(appRouter.OptimizedEntry)
    expect(components.NextAppAutoPageTracker).toBe(appRouter.NextAppAutoPageTracker)
    expect(components.proxy).toBeUndefined()
    expect(components).not.toHaveProperty('config')
    expect(components).not.toHaveProperty('NextPagesAutoPageTracker')
    expect(element.props).toMatchObject({
      api: testConfig.api,
      children: 'Bound content',
      clientId: testConfig.clientId,
      environment: testConfig.environment,
      liveUpdates: true,
    })
    expect(element.props).not.toHaveProperty('server')
    expect(provider?.props).toMatchObject({
      api: testConfig.api,
      clientId: testConfig.clientId,
      environment: testConfig.environment,
    })
    expect(provider?.props).not.toHaveProperty('liveUpdates')
    expect(provider).toMatchObject({
      props: {
        children: {
          props: {
            children: 'Provider content',
            globalLiveUpdates: true,
          },
        },
      },
    })
  })

  it('keeps the low-level client entry free of router-specific exports', () => {
    expect(client).not.toHaveProperty('NextAppAutoPageTracker')
    expect(client).not.toHaveProperty('NextPagesAutoPageTracker')
    expect(client).not.toHaveProperty('createNextjsOptimizationComponents')
  })
})
