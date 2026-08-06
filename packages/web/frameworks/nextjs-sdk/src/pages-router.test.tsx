import type { Entry } from 'contentful'
import { renderToString } from 'react-dom/server'
import * as pagesRouter from './pages-router'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
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

function createEntryCollection(items: readonly Entry[]): {
  readonly items: Entry[]
  readonly limit: number
  readonly skip: number
  readonly total: number
} {
  return {
    items: [...items],
    limit: items.length,
    skip: 0,
    total: items.length,
  }
}

describe('Next.js Pages Router client components', () => {
  it('passes config and handoff through the bound root and provider', () => {
    const contentful = {
      client: {
        getEntry: async () => await Promise.resolve(createEntry('unused')),
        getEntries: async () => await Promise.resolve(createEntryCollection([])),
      },
    }
    const components = pagesRouter.bindNextjsPagesRouterOptimization({
      ...testConfig,
      consent: { clientDefaults: { consent: false, persistenceConsent: false } },
      contentful,
      liveUpdates: true,
    })
    const handoff = components.createHandoffFromSelections({
      cache: { scope: 'static' },
      entries: [
        { baselineEntry: createEntry('4ib0hsHWoSOnCVdDkizE8d'), entryId: '4ib0hsHWoSOnCVdDkizE8d' },
      ],
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations: [],
    })

    const root = components.OptimizationRoot({
      children: 'Root content',
      handoff,
      initialPagePayload: { properties: { route: '/products' } },
      routeKey: '/products',
    })
    const provider = components.OptimizationProvider({
      children: 'Provider content',
      handoff,
      hydration: 'client-only-hidden-until-ready',
      prefetchManagedEntries: ['4ib0hsHWoSOnCVdDkizE8d'],
    })

    expect(root.props).toMatchObject({
      api: testConfig.api,
      children: 'Root content',
      clientId: testConfig.clientId,
      defaults: { consent: false, persistenceConsent: false },
      environment: testConfig.environment,
      liveUpdates: true,
      handoff,
      initialPagePayload: { properties: { route: '/products' } },
      routeKey: '/products',
      contentful,
    })
    expect(provider?.props).toMatchObject({
      api: testConfig.api,
      clientId: testConfig.clientId,
      defaults: { consent: false, persistenceConsent: false },
      environment: testConfig.environment,
      handoff,
      hydration: 'client-only-hidden-until-ready',
      prefetchManagedEntries: ['4ib0hsHWoSOnCVdDkizE8d'],
      contentful,
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

  it('prefers request handoff defaults over static consent client defaults', () => {
    const components = pagesRouter.bindNextjsPagesRouterOptimization({
      ...testConfig,
      consent: { clientDefaults: { consent: false, persistenceConsent: false } },
    })
    const handoff = {
      ...components.createHandoffFromSelections({
        cache: { scope: 'private-request' },
        hydration: 'preserve-server',
        initialPageEvent: 'skip',
        selectedOptimizations: [],
      }),
      defaults: { consent: true },
    }
    const analyticsHandoff = {
      ...components.createHandoffFromSelections({
        cache: { scope: 'private-request' },
        hydration: 'analytics-only',
        initialPageEvent: 'skip',
        selectedOptimizations: [],
      }),
      defaults: { consent: true },
    }

    const root = components.OptimizationRoot({
      children: 'Root content',
      handoff,
    })
    const provider = components.OptimizationProvider({
      children: 'Provider content',
      handoff,
      hydration: 'preserve-server',
    })
    const analyticsRoot = components.OptimizationAnalyticsRoot({
      children: 'Analytics content',
      handoff: analyticsHandoff,
      routeKey: '/products',
    })

    expect(root.props).toMatchObject({
      defaults: { consent: true, persistenceConsent: false },
    })
    expect(provider?.props).toMatchObject({
      defaults: { consent: true, persistenceConsent: false },
    })
    expect(analyticsRoot.props).toMatchObject({
      defaults: { consent: true, persistenceConsent: false },
    })
  })

  it('renders client OptimizedEntry content from Pages Router handoff during SSR', () => {
    const getEntry = rs.fn(async () => await Promise.resolve(createEntry('client-fetch')))
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const components = pagesRouter.bindNextjsPagesRouterOptimization({
      ...testConfig,
      contentful: { client: { getEntry, getEntries } },
    })
    const baselineEntry = createEntry('4ib0hsHWoSOnCVdDkizE8d')
    const handoff = components.createHandoffFromSelections({
      cache: { scope: 'static' },
      entries: [
        {
          baselineEntry,
          entryId: baselineEntry.sys.id,
          managedEntry: {
            contentType: 'page',
            entryQuery: { locale: 'de-DE' },
            slug: '/products',
            slugField: 'path',
          },
        },
      ],
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations: [],
    })

    const markup = renderToString(
      <components.OptimizationRoot handoff={handoff}>
        <components.OptimizedEntry
          loadingFallback="loading"
          managedEntry={{
            contentType: 'page',
            entryQuery: { locale: 'de-DE' },
            slug: '/products',
            slugField: 'path',
          }}
        >
          {(entry) => entry.sys.id}
        </components.OptimizedEntry>
      </components.OptimizationRoot>,
    )

    expect(markup).toContain('data-ctfl-baseline-id="4ib0hsHWoSOnCVdDkizE8d"')
    expect(markup).toContain('data-ctfl-entry-id="4ib0hsHWoSOnCVdDkizE8d"')
    expect(markup).not.toContain('loading')
    expect(getEntry).not.toHaveBeenCalled()
    expect(getEntries).not.toHaveBeenCalled()
  })

  it('returns Pages Router v2 helpers only', () => {
    const components = pagesRouter.bindNextjsPagesRouterOptimization(testConfig)

    expect(components.NextPagesAutoPageTracker).toBe(pagesRouter.NextPagesAutoPageTracker)
    expect(components.OptimizationAnalyticsRoot).toBeTypeOf('function')
    expect(components.createHandoffFromSelections).toBeTypeOf('function')
    expect(components.createOptimizationCacheKey).toBeTypeOf('function')
    expect(components.createPublicPermutationHandoff).toBeTypeOf('function')
    expect(components.resolveEntriesForSelections).toBeTypeOf('function')
    expect(components).not.toHaveProperty('NextAppAutoPageTracker')
  })

  it('keeps the Pages Router entry scoped to the client binding and pass-through helpers', () => {
    expect(Object.keys(pagesRouter).sort()).toEqual([
      'NextPagesAutoPageTracker',
      'bindNextjsPagesRouterOptimization',
      'createHandoffFromSelections',
      'createOptimizationCacheKey',
      'createPublicPermutationCacheMetadata',
      'createPublicPermutationHandoff',
      'resolveEntriesForSelections',
    ])
  })
})
