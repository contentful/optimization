import * as reactWeb from '@contentful/optimization-react-web'
import type { Entry } from 'contentful'
import { renderToString } from 'react-dom/server'
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

function createEntry(id: string): Entry {
  return {
    fields: {},
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

describe('Next.js App Router client components', () => {
  it('creates bound client components from v2 config props', () => {
    const contentful = {
      client: {
        getEntry: async () => await Promise.resolve(createEntry('unused')),
        getEntries: async () => await Promise.resolve(createEntryCollection([])),
      },
    }
    const components = appRouter.bindNextjsAppRouterOptimization({
      ...testConfig,
      consent: { clientDefaults: { consent: false, persistenceConsent: false } },
      contentful,
      liveUpdates: true,
    })
    const handoff = components.createHandoffFromSelections({
      cache: { scope: 'static' },
      entries: [{ baselineEntry: createEntry('hero'), entryId: 'hero' }],
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations: [],
    })

    const element = components.OptimizationRoot({
      children: 'Bound content',
      handoff,
      initialPagePayload: { properties: { route: '/products' } },
      routeKey: '/products',
    })
    const provider = components.OptimizationProvider({
      children: 'Provider content',
      handoff,
      hydration: 'client-only-hidden-until-ready',
      prefetchManagedEntries: ['hero'],
    })

    expect(components.OptimizedEntry).toBe(client.OptimizedEntry)
    expect(components.NextAppAutoPageTracker).toBe(appRouter.NextAppAutoPageTracker)
    expect(components).not.toHaveProperty('createCacheMiddleware')
    expect(components).not.toHaveProperty('proxy')
    expect(components).not.toHaveProperty('config')
    expect(components).not.toHaveProperty('NextPagesAutoPageTracker')
    expect(element.props).toMatchObject({
      api: testConfig.api,
      children: 'Bound content',
      clientId: testConfig.clientId,
      defaults: { consent: false, persistenceConsent: false },
      environment: testConfig.environment,
      handoff,
      initialPagePayload: { properties: { route: '/products' } },
      liveUpdates: true,
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
      prefetchManagedEntries: ['hero'],
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

  it('renders client entryId content from handoff entries during SSR', () => {
    const getEntry = rs.fn(async () => await Promise.resolve(createEntry('client-fetch')))
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const components = appRouter.bindNextjsAppRouterOptimization({
      ...testConfig,
      contentful: { client: { getEntry, getEntries } },
    })
    const baselineEntry = createEntry('hero')
    const handoff = components.createHandoffFromSelections({
      cache: { scope: 'static' },
      entries: [{ baselineEntry, entryId: 'hero' }],
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations: [],
    })

    const markup = renderToString(
      <components.OptimizationRoot handoff={handoff}>
        <components.OptimizedEntry entryId="hero">
          {(entry) => entry.sys.id}
        </components.OptimizedEntry>
      </components.OptimizationRoot>,
    )

    expect(markup).toContain('hero')
    expect(getEntry).not.toHaveBeenCalled()
    expect(getEntries).not.toHaveBeenCalled()
  })

  it('keeps the low-level client entry free of router-specific exports', () => {
    expect(Object.keys(client).sort()).toEqual(Object.keys(reactWeb).sort())
    expect(client).not.toHaveProperty('NextAppAutoPageTracker')
    expect(client).not.toHaveProperty('NextPagesAutoPageTracker')
    expect(client).not.toHaveProperty('createNextjsOptimizationComponents')
  })

  it('keeps the App Router client entry scoped to client-safe binding helpers', () => {
    expect(Object.keys(appRouter).sort()).toEqual([
      'NextAppAutoPageTracker',
      'bindNextjsAppRouterOptimization',
      'createHandoffFromSelections',
      'createOptimizationCacheKey',
      'resolveEntriesForSelections',
    ])
  })
})
