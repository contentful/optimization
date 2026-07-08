import type { Entry } from 'contentful'
import { renderToString } from 'react-dom/server'
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

function createEntry(id: string): Entry {
  return {
    fields: { title: id },
    metadata: { tags: [] },
    sys: {
      contentType: { sys: { id: 'content-type', linkType: 'ContentType', type: 'Link' } },
      createdAt: '2024-01-01T00:00:00.000Z',
      environment: { sys: { id: 'main', linkType: 'Environment', type: 'Link' } },
      id,
      publishedVersion: 1,
      revision: 1,
      space: { sys: { id: 'space-id', linkType: 'Space', type: 'Link' } },
      type: 'Entry',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  }
}

describe('Next.js Pages Router client components', () => {
  it('passes config and render-time server state through the bound root and provider', () => {
    const components = pagesRouter.createNextjsPagesRouterOptimization({
      ...testConfig,
      liveUpdates: true,
    })
    const serverOptimizedEntries = [{ baselineEntry: createEntry('hero'), entryId: 'hero' }]

    const root = components.OptimizationRoot({
      children: 'Root content',
      serverOptimizationState,
      serverOptimizedEntries,
    })
    const provider = components.OptimizationProvider({
      children: 'Provider content',
      serverOptimizationState,
      serverOptimizedEntries,
    })

    expect(root.props).toMatchObject({
      api: testConfig.api,
      children: 'Root content',
      clientId: testConfig.clientId,
      environment: testConfig.environment,
      liveUpdates: true,
      serverOptimizationState,
      serverOptimizedEntries,
    })
    expect(provider?.props).toMatchObject({
      api: testConfig.api,
      clientId: testConfig.clientId,
      environment: testConfig.environment,
      serverOptimizationState,
      serverOptimizedEntries,
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

  it('renders client OptimizedEntry content from Pages Router handoff during SSR', () => {
    const components = pagesRouter.createNextjsPagesRouterOptimization(testConfig)
    const baselineEntry = createEntry('hero')

    const markup = renderToString(
      <components.OptimizationRoot
        serverOptimizationState={serverOptimizationState}
        serverOptimizedEntries={[{ baselineEntry, entryId: 'hero' }]}
      >
        <components.OptimizedEntry entryId="hero" loadingFallback="loading">
          {(entry) => entry.sys.id}
        </components.OptimizedEntry>
      </components.OptimizationRoot>,
    )

    expect(markup).toContain('hero')
    expect(markup).not.toContain('loading')
  })

  it('returns the Pages tracker only', () => {
    const components = pagesRouter.createNextjsPagesRouterOptimization(testConfig)

    expect(components.NextPagesAutoPageTracker).toBe(pagesRouter.NextPagesAutoPageTracker)
    expect(components).not.toHaveProperty('NextAppAutoPageTracker')
  })

  it('keeps the Pages Router entry scoped to the factory and tracker', () => {
    expect(Object.keys(pagesRouter).sort()).toEqual([
      'NextPagesAutoPageTracker',
      'createNextjsPagesRouterOptimization',
    ])
  })
})
