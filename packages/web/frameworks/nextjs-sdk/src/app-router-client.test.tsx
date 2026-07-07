import type { Entry } from 'contentful'
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

describe('Next.js App Router client components', () => {
  it('creates bound client components from config props without server-only config', () => {
    const contentful = {
      client: { getEntry: async () => await Promise.resolve(createEntry('unused')) },
    }
    const serverOptimizedEntries = [
      {
        baselineEntry: createEntry('hero'),
        entryId: 'hero',
      },
    ]
    const components = appRouter.createNextjsAppRouterOptimization({
      ...testConfig,
      contentful,
      liveUpdates: true,
      server: { enabled: false },
    })

    const element = components.OptimizationRoot({
      children: 'Bound content',
      serverOptimizedEntries,
    })
    const provider = components.OptimizationProvider({
      children: 'Provider content',
      serverOptimizedEntries,
    })

    expect(components.OptimizedEntry).toBe(client.OptimizedEntry)
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
      serverOptimizedEntries,
    })
    expect(element.props).not.toHaveProperty('contentful')
    expect(element.props).not.toHaveProperty('server')
    expect(provider?.props).toMatchObject({
      api: testConfig.api,
      clientId: testConfig.clientId,
      environment: testConfig.environment,
      serverOptimizedEntries,
    })
    expect(provider?.props).not.toHaveProperty('contentful')
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
    expect(Object.keys(client).sort()).toEqual(Object.keys(reactWeb).sort())
    expect(client).not.toHaveProperty('NextAppAutoPageTracker')
    expect(client).not.toHaveProperty('NextPagesAutoPageTracker')
    expect(client).not.toHaveProperty('createNextjsOptimizationComponents')
  })

  it('keeps the App Router entry scoped to the factory and tracker', () => {
    expect(Object.keys(appRouter).sort()).toEqual([
      'NextAppAutoPageTracker',
      'createNextjsAppRouterOptimization',
    ])
  })
})
