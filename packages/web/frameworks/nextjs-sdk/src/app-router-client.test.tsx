import * as nextApp from '@contentful/optimization-react-web/router/next-app'
import type { Entry } from 'contentful'
import { renderToString } from 'react-dom/server'
import * as appRouter from './app-router-client'
import * as client from './client'

const testConfig = {
  spaceId: 'test-space-id',
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
    const components = appRouter.bindNextjsAppRouterClientOptimization({
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
      prefetchManagedEntries: ['4ib0hsHWoSOnCVdDkizE8d'],
    })

    expect(components.OptimizedEntry).toBe(client.OptimizedEntry)
    expect(components.NextAppAutoPageTracker).toBe(appRouter.NextAppAutoPageTracker)
    expect(components.createPublicPermutationHandoff).toBeTypeOf('function')
    expect(element.props).toMatchObject({
      api: testConfig.api,
      children: 'Bound content',
      spaceId: testConfig.spaceId,
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
      spaceId: testConfig.spaceId,
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

  it('renders client entryId content from handoff entries during SSR', () => {
    const getEntry = rs.fn(async () => await Promise.resolve(createEntry('client-fetch')))
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const components = appRouter.bindNextjsAppRouterClientOptimization({
      ...testConfig,
      contentful: { client: { getEntry, getEntries } },
    })
    const baselineEntry = createEntry('4ib0hsHWoSOnCVdDkizE8d')
    const handoff = components.createHandoffFromSelections({
      cache: { scope: 'static' },
      entries: [{ baselineEntry, entryId: '4ib0hsHWoSOnCVdDkizE8d' }],
      hydration: 'preserve-server',
      selectedOptimizations: [],
    })

    const markup = renderToString(
      <components.OptimizationRoot handoff={handoff}>
        <components.OptimizedEntry entryId="4ib0hsHWoSOnCVdDkizE8d">
          {(entry) => entry.sys.id}
        </components.OptimizedEntry>
      </components.OptimizationRoot>,
    )

    expect(markup).toContain('4ib0hsHWoSOnCVdDkizE8d')
    expect(getEntry).not.toHaveBeenCalled()
    expect(getEntries).not.toHaveBeenCalled()
  })

  it('forwards the before-initial-page callback only to the bound content root', () => {
    const beforeInitialPage = {
      run: rs.fn(() => undefined),
    }
    const components = appRouter.bindNextjsAppRouterClientOptimization({
      ...testConfig,
      beforeInitialPage,
    })
    const analyticsHandoff = components.createHandoffFromSelections({
      cache: { scope: 'static' },
      hydration: 'analytics-only',
      selectedOptimizations: [],
    })
    const root = components.OptimizationRoot({
      buildPagePayload: () => ({ properties: { route: '/products' } }),
      children: 'Root content',
      routeKey: '/products',
    })
    const provider = components.OptimizationProvider({ children: 'Provider content' })
    const analyticsRoot = components.OptimizationAnalyticsRoot({
      children: 'Analytics content',
      handoff: analyticsHandoff,
      routeKey: '/products',
    })

    expect(root.props).toMatchObject({ beforeInitialPage })
    expect(components.RequestOptimizationRoot).toBeTypeOf('function')
    expect(provider?.props).not.toHaveProperty('beforeInitialPage')
    expect(analyticsRoot.props).not.toHaveProperty('beforeInitialPage')
    expect(components).not.toHaveProperty('beforeInitialPage')
  })

  it('provides the request content root from every binding', () => {
    const withoutBeforeInitialPage = appRouter.bindNextjsAppRouterClientOptimization(testConfig)
    const withBeforeInitialPage = appRouter.bindNextjsAppRouterClientOptimization({
      ...testConfig,
      beforeInitialPage: { run: () => undefined },
    })

    expect(withoutBeforeInitialPage.RequestOptimizationRoot).toBeTypeOf('function')
    expect(withBeforeInitialPage.RequestOptimizationRoot).toBeTypeOf('function')
    expect(withBeforeInitialPage.RequestOptimizationRoot).not.toBe(
      withBeforeInitialPage.OptimizationRoot,
    )
  })

  it('forwards before-initial-page work to the request root without a handoff', () => {
    const beforeInitialPage = { run: rs.fn(() => undefined) }
    const buildPagePayload: NonNullable<client.OptimizationRootProps['buildPagePayload']> = () => ({
      properties: { route: '/products' },
    })
    const inputs = rs.spyOn(nextApp, 'useNextAppAutoPageInputs').mockReturnValue({
      buildPagePayload,
      routeKey: '/products',
    })
    try {
      const components = appRouter.bindNextjsAppRouterClientOptimization({
        ...testConfig,
        beforeInitialPage,
      })
      const root = components.RequestOptimizationRoot({ children: 'Root content' })

      expect(root.props).toMatchObject({
        beforeInitialPage,
        buildPagePayload,
        routeKey: '/products',
      })
    } finally {
      inputs.mockRestore()
    }
  })

  it('rejects server-only request configuration', () => {
    appRouter.bindNextjsAppRouterClientOptimization({
      ...testConfig,
      // @ts-expect-error Request initialization is available only from the server entrypoint.
      request: {},
    })
  })
})
