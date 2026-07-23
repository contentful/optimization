import ContentfulOptimizationRuntime from '@contentful/optimization-node'
import type { Entry } from 'contentful'
import type { GetServerSidePropsContext } from 'next'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import * as pagesRouterServerExports from './pages-router-server'
import {
  configureNextjsServerOptimization,
  type ContentfulOptimization,
  type CoreStatelessRequest,
  type OptimizationData,
} from './server'

const { bindNextjsPagesRouterServerOptimization, createNextjsPagesRouterRequestHandoff } =
  pagesRouterServerExports

const SDK_CONFIG = {
  clientId: 'key_123',
  environment: 'main',
}

const OPTIMIZATION_DATA: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: {
    id: 'profile-from-page',
    stableId: 'profile-from-page',
    random: 1,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: 'session-id',
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

void afterEach(() => {
  rs.restoreAllMocks()
})

interface CreatedSdk {
  readonly forRequest: ReturnType<typeof rs.spyOn>
  readonly page: ReturnType<typeof rs.fn<CoreStatelessRequest['page']>>
  readonly sdk: ContentfulOptimization
}
type NextjsOptimizationConfig = Parameters<typeof configureNextjsServerOptimization>[0]

function createSdk(
  page = rs.fn<CoreStatelessRequest['page']>(
    async () => await Promise.resolve({ accepted: true, data: OPTIMIZATION_DATA }),
  ),
  config: NextjsOptimizationConfig = SDK_CONFIG,
): CreatedSdk {
  const sdk = configureNextjsServerOptimization(config)
  const originalForRequest = sdk.forRequest.bind(sdk)
  const forRequest = rs.spyOn(sdk, 'forRequest')

  forRequest.mockImplementation((options) => {
    const requestOptimization = originalForRequest(options)
    rs.spyOn(requestOptimization, 'page').mockImplementation(page)
    return requestOptimization
  })

  return { forRequest, page, sdk }
}

function mockPrototypeRequestPage(): {
  readonly forRequest: ReturnType<typeof rs.spyOn>
  readonly page: ReturnType<typeof rs.fn<CoreStatelessRequest['page']>>
} {
  const originalForRequest = ContentfulOptimizationRuntime.prototype.forRequest
  const page = rs.fn<CoreStatelessRequest['page']>(
    async () => await Promise.resolve({ accepted: true, data: OPTIMIZATION_DATA }),
  )
  const forRequest = rs.spyOn(ContentfulOptimizationRuntime.prototype, 'forRequest')

  forRequest.mockImplementation(function mockForRequest(
    this: ContentfulOptimizationRuntime,
    options,
  ) {
    const requestOptimization = originalForRequest.call(this, options)
    rs.spyOn(requestOptimization, 'page').mockImplementation(page)
    return requestOptimization
  })

  return { forRequest, page }
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
  it('exports the server binding helper without the removed Pages Router create* name', () => {
    expect(pagesRouterServerExports.bindNextjsPagesRouterServerOptimization).toBeTypeOf('function')
    expect(pagesRouterServerExports).not.toHaveProperty('createNextjsPagesRouterOptimization')
  })

  it('creates a config-bound request handoff helper', async () => {
    const { forRequest } = mockPrototypeRequestPage()
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
    expect(handoff.initialPageEvent).toBe('skip')
    expect(context.res.getHeader('Set-Cookie')).toEqual(
      expect.stringContaining('Domain=example.test'),
    )
  })

  it('builds request context from getServerSideProps context and calls page', async () => {
    const { forRequest, page, sdk } = createSdk()

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

    expect(result.handoff.initialPageEvent).toBe('skip')
    expect(result.handoff.state?.profile?.id).toBe('profile-from-page')
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
    expect(page).toHaveBeenCalledWith({ properties: { route: '/products' } })
  })

  it.each([
    ['accepted without data', { accepted: true }, 'skip'],
    ['blocked', { accepted: false }, 'emit'],
  ] as const)(
    'sets initialPageEvent from page acceptance for %s',
    async (_label, pageResult, expectedInitialPageEvent) => {
      const { sdk } = createSdk(
        rs.fn<CoreStatelessRequest['page']>(async () => await Promise.resolve(pageResult)),
      )

      const result = await createNextjsPagesRouterRequestHandoff(sdk, createContext(), {
        consent: true,
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/products' } },
      })

      expect(result.handoff.initialPageEvent).toBe(expectedInitialPageEvent)
    },
  )

  it('reads anonymous ID from req.cookies before the raw cookie header', async () => {
    const { forRequest, sdk } = createSdk()

    await createNextjsPagesRouterRequestHandoff(
      sdk,
      createContext({
        cookies: { 'ctfl-opt-aid': 'parsed-cookie-id' },
        headers: { cookie: 'ctfl-opt-aid=raw-cookie-id' },
      }),
      {
        consent: { events: true, persistence: true },
        hydration: 'preserve-server',
        pagePayload: {},
      },
    )

    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({ profile: { id: 'parsed-cookie-id' } }),
    )
  })

  it('prefetches declared managed entries into handoff entries after request data loads', async () => {
    const calls: string[] = []
    const baselineEntry = createEntry('hero')
    const getEntry = rs.fn(async () => {
      calls.push('fetch')
      return await Promise.resolve(baselineEntry)
    })
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const page = rs.fn<CoreStatelessRequest['page']>(async () => {
      calls.push('page')
      return await Promise.resolve({ accepted: true, data: OPTIMIZATION_DATA })
    })
    const { sdk } = createSdk(page, {
      ...SDK_CONFIG,
      contentful: { client: { getEntry, getEntries }, cache: false },
    })

    const result = await createNextjsPagesRouterRequestHandoff(sdk, createContext(), {
      consent: true,
      hydration: 'preserve-server',
      pagePayload: {},
      prefetchManagedEntries: [
        { entryId: 'hero', entryQuery: { locale: 'de-DE' } },
        { entryId: 'hero', entryQuery: { locale: 'de-DE' } },
      ],
    })

    expect(calls).toEqual(['page', 'fetch'])
    expect(result.handoff.entries).toEqual([
      {
        baselineEntry,
        entryId: 'hero',
        entryQuery: { locale: 'de-DE' },
      },
      {
        baselineEntry,
        entryId: 'hero',
        entryQuery: { locale: 'de-DE' },
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
      expect.stringContaining('ctfl-opt-aid=profile-from-page'),
    ])
  })
})
