import * as pagesRouter from './pages-router'
import type { OptimizationData } from './server'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

const serverOptimizationState: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: {
    id: 'server-profile-id',
    stableId: 'server-profile-id',
    random: 0.5,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: 'server-session-id',
      isReturningVisitor: false,
      landingPage: {
        path: '/',
        query: {},
        referrer: '',
        search: '',
        title: '',
        url: 'https://example.test/',
      },
      count: 1,
      activeSessionLength: 0,
      averageSessionLength: 0,
    },
  },
}

describe('Next.js Pages Router client components', () => {
  it('passes config and render-time server state through the bound root and provider', () => {
    const components = pagesRouter.createNextjsPagesRouterOptimization({
      ...testConfig,
      liveUpdates: true,
    })

    const root = components.OptimizationRoot({
      children: 'Root content',
      serverOptimizationState,
    })
    const provider = components.OptimizationProvider({
      children: 'Provider content',
      serverOptimizationState,
    })

    expect(root.props).toMatchObject({
      api: testConfig.api,
      children: 'Root content',
      clientId: testConfig.clientId,
      environment: testConfig.environment,
      liveUpdates: true,
      serverOptimizationState,
    })
    expect(provider?.props).toMatchObject({
      api: testConfig.api,
      clientId: testConfig.clientId,
      environment: testConfig.environment,
      serverOptimizationState,
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

  it('merges request-specific client defaults through the bound root and provider', () => {
    const components = pagesRouter.createNextjsPagesRouterOptimization({
      ...testConfig,
      defaults: { consent: false, persistenceConsent: false },
    })

    const root = components.OptimizationRoot({
      children: 'Root content',
      clientDefaults: { consent: true, persistenceConsent: true },
    })
    const provider = components.OptimizationProvider({
      children: 'Provider content',
      clientDefaults: { consent: true, persistenceConsent: true },
    })

    expect(root.props).toMatchObject({
      defaults: { consent: true, persistenceConsent: true },
    })
    expect(provider?.props).toMatchObject({
      defaults: { consent: true, persistenceConsent: true },
    })
  })

  it('returns the Pages tracker only', () => {
    const components = pagesRouter.createNextjsPagesRouterOptimization(testConfig)

    expect(components.NextPagesAutoPageTracker).toBe(pagesRouter.NextPagesAutoPageTracker)
    expect(components).not.toHaveProperty('NextAppAutoPageTracker')
  })
})
