import ContentfulOptimizationRuntime from '@contentful/optimization-node'
import type { ExperienceApiClient } from '@contentful/optimization-node/api-client'
import type { Entry } from 'contentful'
import type { GetServerSidePropsContext } from 'next'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import * as pagesRouterServerExports from './pages-router-server'
import {
  configureNextjsServerOptimization,
  type ContentfulOptimization,
  type OptimizationData,
} from './server'

const { bindNextjsPagesRouterServerOptimization, createNextjsPagesRouterRequestHandoff } =
  pagesRouterServerExports

const SDK_CONFIG = {
  spaceId: 'key_123',
  environment: 'main',
}

const OPTIMIZATION_DATA: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: {
    id: 'f0837d7dc6344c36a3a0a06c4cde754b',
    stableId: 'f0837d7dc6344c36a3a0a06c4cde754b',
    random: 1,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: 'e77eab64-93ca-4f6e-8492-037c1ff67caa',
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

afterEach(() => {
  rs.restoreAllMocks()
})

interface CreatedSdk {
  readonly forRequest: ReturnType<typeof rs.spyOn>
  readonly preview: ReturnType<typeof rs.fn<ExperienceApiClient['upsertProfile']>>
  readonly sdk: ContentfulOptimization
}
type NextjsOptimizationConfig = Parameters<typeof configureNextjsServerOptimization>[0]

function createSdk(
  preview = rs.fn<ExperienceApiClient['upsertProfile']>(
    async () => await Promise.resolve(OPTIMIZATION_DATA),
  ),
  config: NextjsOptimizationConfig = SDK_CONFIG,
): CreatedSdk {
  const sdk = configureNextjsServerOptimization(config)
  const originalForRequest = sdk.forRequest.bind(sdk)
  const forRequest = rs.spyOn(sdk, 'forRequest')

  forRequest.mockImplementation((options) => {
    const requestOptimization = originalForRequest(options)
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockImplementation(preview)
    return requestOptimization
  })

  return { forRequest, preview, sdk }
}

function mockPrototypeRequestPreview(): {
  readonly forRequest: ReturnType<typeof rs.spyOn>
  readonly preview: ReturnType<typeof rs.fn<ExperienceApiClient['upsertProfile']>>
} {
  const originalForRequest = ContentfulOptimizationRuntime.prototype.forRequest
  const preview = rs.fn<ExperienceApiClient['upsertProfile']>(
    async () => await Promise.resolve(OPTIMIZATION_DATA),
  )
  const forRequest = rs.spyOn(ContentfulOptimizationRuntime.prototype, 'forRequest')

  forRequest.mockImplementation(function mockForRequest(
    this: ContentfulOptimizationRuntime,
    options,
  ) {
    const requestOptimization = originalForRequest.call(this, options)
    rs.spyOn(this.api.experience, 'upsertProfile').mockImplementation(preview)
    return requestOptimization
  })

  return { forRequest, preview }
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

function createContext({
  cookies = {},
  headers = {},
  locale = 'en-US',
  resolvedUrl = '/products?tab=featured',
  setCookie,
  url = '/fallback',
}: {
  readonly cookies?: Record<string, string>
  readonly headers?: Record<string, string | string[] | undefined>
  readonly locale?: string
  readonly resolvedUrl?: string
  readonly setCookie?: string | string[]
  readonly url?: string
} = {}): GetServerSidePropsContext {
  const req = Object.assign(new IncomingMessage(new Socket()), {
    cookies,
    headers: {
      host: 'example.test',
      ...headers,
    },
    url,
  })
  const res = new ServerResponse(req)
  if (setCookie !== undefined) res.setHeader('Set-Cookie', setCookie)

  return {
    locale,
    query: {},
    req,
    resolvedUrl,
    res,
  }
}

describe('Next.js Pages Router server handoff helpers', () => {
  it('exports server binding and public permutation helpers', () => {
    expect(pagesRouterServerExports.bindNextjsPagesRouterServerOptimization).toBeTypeOf('function')
    expect(pagesRouterServerExports.createPublicPermutationCacheMetadata).toBeTypeOf('function')
    expect(pagesRouterServerExports.createPublicPermutationHandoff).toBeTypeOf('function')
    expect(pagesRouterServerExports.resolveEntriesForSelections).toBeTypeOf('function')
  })

  it('creates a config-bound request handoff helper', async () => {
    const { forRequest } = mockPrototypeRequestPreview()
    const resolveConsent = rs.fn(
      (context: { readonly cookies: { get: (name: string) => unknown } }) =>
        context.cookies.get('consent') ? { events: true, persistence: true } : false,
    )
    const { createRequestHandoff } = bindNextjsPagesRouterServerOptimization({
      ...SDK_CONFIG,
      consent: { server: resolveConsent },
      cookie: { domain: 'example.test', expires: 1 },
      locale: 'de-DE',
    })
    const context = createContext({ cookies: { consent: 'yes' } })

    const handoff = await createRequestHandoff(context, {
      hydration: 'preserve-server',
      pagePayload: { properties: { route: '/products' } },
    })

    expect(resolveConsent).toHaveBeenCalled()
    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: { events: true, persistence: true },
        locale: 'de-DE',
      }),
    )
    expect(handoff).toMatchObject({
      defaults: { consent: true, persistenceConsent: true },
    })
    expect(context.res.getHeader('Set-Cookie')).toEqual(
      expect.stringContaining('Domain=example.test'),
    )
  })

  it('builds request context from getServerSideProps context and previews the page', async () => {
    const { forRequest, preview, sdk } = createSdk()

    const result = await createNextjsPagesRouterRequestHandoff(
      sdk,
      createContext({
        headers: {
          referer: 'https://example.com/from',
          'user-agent': 'pages-agent',
          'x-forwarded-host': 'example.com',
          'x-forwarded-proto': 'https',
        },
        locale: 'de-DE',
      }),
      {
        consent: { events: true, persistence: true },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/products' } },
      },
    )

    expect(result.handoff.replay?.routeKey).toBe('/products?tab=featured')
    expect(result.handoff.state?.profile?.id).toBe('f0837d7dc6344c36a3a0a06c4cde754b')
    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: { events: true, persistence: true },
        eventContext: expect.objectContaining({
          locale: 'de-DE',
          page: {
            path: '/products',
            query: { tab: 'featured' },
            referrer: 'https://example.com/from',
            search: '?tab=featured',
            url: 'https://example.com/products?tab=featured',
          },
          userAgent: 'pages-agent',
        }),
        locale: 'de-DE',
      }),
    )
    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            type: 'page',
            properties: expect.objectContaining({ route: '/products' }),
          }),
        ],
      }),
      expect.objectContaining({ preflight: true, locale: 'de-DE' }),
    )
  })

  it.each([undefined, 'known-api-id'])(
    'retains replay and known identity on preview failure (%s)',
    async (knownId) => {
      const { sdk, preview } = createSdk()
      preview.mockRejectedValue(new Error('Preview unavailable'))
      const context = createContext({ cookies: knownId ? { 'ctfl-opt-aid': knownId } : {} })
      const result = await createNextjsPagesRouterRequestHandoff(sdk, context, {
        consent: true,
        hydration: 'preserve-server',
      })
      expect(result.data).toBeUndefined()
      expect(result.handoff.profileId).toBe(knownId)
      expect(result.handoff.replay).toMatchObject({
        routeKey: '/products?tab=featured',
        events: [expect.objectContaining({ type: 'page' })],
      })
      if (knownId) expect(context.res.getHeader('Set-Cookie')).toContain(`ctfl-opt-aid=${knownId}`)
      else expect(context.res.getHeader('Set-Cookie')).toBeUndefined()
    },
  )

  it('defaults missing object persistence consent to false', async () => {
    const { sdk } = createSdk()

    const result = await createNextjsPagesRouterRequestHandoff(sdk, createContext(), {
      consent: { events: true },
      hydration: 'preserve-server',
      pagePayload: { properties: { route: '/products' } },
    })

    expect(result.handoff).toMatchObject({
      defaults: { consent: true, persistenceConsent: false },
    })
  })

  it('reads anonymous ID from req.cookies before the raw cookie header', async () => {
    const { forRequest, sdk } = createSdk()

    await createNextjsPagesRouterRequestHandoff(
      sdk,
      createContext({
        cookies: { 'ctfl-opt-aid': 'f0837d7dc6344c36a3a0a06c4cde754b' },
        headers: { cookie: 'ctfl-opt-aid=raw-cookie-id' },
      }),
      {
        consent: { events: true, persistence: true },
        hydration: 'preserve-server',
        pagePayload: {},
      },
    )

    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({ profile: { id: 'f0837d7dc6344c36a3a0a06c4cde754b' } }),
    )
  })

  it('prefetches declared managed entries into handoff entries alongside preview', async () => {
    const calls: string[] = []
    const baselineEntry = createEntry('4ib0hsHWoSOnCVdDkizE8d')
    const existingEntry = createEntry('4k6ZyFQnR2POY5IJLLlJRb')
    const getEntry = rs.fn(async () => await Promise.resolve(createEntry('unused')))
    const getEntries = rs.fn(async () => {
      calls.push('fetch')
      return await Promise.resolve(createEntryCollection([baselineEntry]))
    })
    const preview = rs.fn<ExperienceApiClient['upsertProfile']>(async () => {
      calls.push('preview')
      return await Promise.resolve(OPTIMIZATION_DATA)
    })
    const { sdk } = createSdk(preview, {
      ...SDK_CONFIG,
      contentful: { client: { getEntry, getEntries }, cache: false },
    })

    const result = await createNextjsPagesRouterRequestHandoff(sdk, createContext(), {
      consent: true,
      entries: [{ baselineEntry: existingEntry, entryId: existingEntry.sys.id }],
      hydration: 'preserve-server',
      pagePayload: {},
      prefetchManagedEntries: [
        {
          contentType: 'page',
          entryQuery: { locale: 'de-DE' },
          slug: '/products',
          slugField: 'path',
        },
        {
          contentType: 'page',
          entryQuery: { locale: 'de-DE' },
          slug: '/products',
          slugField: 'path',
        },
      ],
    })

    expect(calls).toEqual(['fetch', 'preview'])
    expect(getEntry).not.toHaveBeenCalled()
    expect(getEntries).toHaveBeenCalledTimes(1)
    expect(getEntries).toHaveBeenCalledWith({
      content_type: 'page',
      'fields.path': '/products',
      include: 10,
      limit: 2,
      locale: 'de-DE',
    })
    expect(result.handoff.entries).toEqual([
      {
        baselineEntry: existingEntry,
        entryId: existingEntry.sys.id,
      },
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
    ])
  })

  it('appends Set-Cookie without clobbering existing response cookies', async () => {
    const { sdk } = createSdk()
    const context = createContext({ setCookie: ['app-cookie=1; Path=/'] })

    await createNextjsPagesRouterRequestHandoff(sdk, context, {
      consent: { events: true, persistence: true },
      hydration: 'preserve-server',
      pagePayload: {},
    })

    expect(context.res.getHeader('Set-Cookie')).toEqual([
      'app-cookie=1; Path=/',
      expect.stringContaining('ctfl-opt-aid=f0837d7dc6344c36a3a0a06c4cde754b'),
    ])
  })
})
