import ContentfulOptimizationRuntime from '@contentful/optimization-node'
import type { GetServerSidePropsContext } from 'next'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import {
  createNextjsPagesRouterOptimization,
  getNextjsPagesRouterOptimizationProps,
} from './pages-router-server'
import {
  createNextjsOptimization,
  type ContentfulOptimization,
  type CoreStatelessRequest,
  type OptimizationData,
} from './server'

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

function createSdk(
  page = rs.fn<CoreStatelessRequest['page']>(
    async () => await Promise.resolve({ accepted: true, data: OPTIMIZATION_DATA }),
  ),
): CreatedSdk {
  const sdk = createNextjsOptimization(SDK_CONFIG)
  const originalForRequest = sdk.forRequest.bind(sdk)
  const forRequest = rs.spyOn(sdk, 'forRequest')

  forRequest.mockImplementation((options) => {
    const requestOptimization = originalForRequest(options)
    rs.spyOn(requestOptimization, 'page').mockImplementation(page)
    return requestOptimization
  })

  return { forRequest, page, sdk }
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

describe('Next.js Pages Router server helpers', () => {
  it('creates a config-bound getServerSideProps helper', async () => {
    const requestOptimization = new ContentfulOptimizationRuntime(SDK_CONFIG).forRequest({
      consent: { events: true, persistence: true },
    })
    const forRequest = rs
      .spyOn(ContentfulOptimizationRuntime.prototype, 'forRequest')
      .mockReturnValue(requestOptimization)
    rs.spyOn(requestOptimization, 'page').mockResolvedValue({
      accepted: true,
      data: OPTIMIZATION_DATA,
    })
    const resolveConsent = rs.fn((context: GetServerSidePropsContext) =>
      context.req.cookies.consent === 'yes' ? { events: true, persistence: true } : false,
    )
    const { getServerSideOptimizationProps } = createNextjsPagesRouterOptimization({
      ...SDK_CONFIG,
      cookie: { domain: 'example.test', expires: 1 },
      locale: 'de-DE',
      server: { consent: resolveConsent },
    })
    const context = createContext({ cookies: { consent: 'yes' } })

    await getServerSideOptimizationProps(context)

    expect(resolveConsent).toHaveBeenCalledWith(context)
    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: { events: true, persistence: true },
        locale: 'de-DE',
      }),
    )
    expect(context.res.getHeader('Set-Cookie')).toEqual(
      expect.stringContaining('Domain=example.test'),
    )
  })

  it('builds request context from getServerSideProps context and calls page', async () => {
    const { forRequest, page, sdk } = createSdk()

    await getNextjsPagesRouterOptimizationProps(
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
        pagePayload: { properties: { route: '/products' } },
      },
    )

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

  it('reads anonymous ID from req.cookies before the raw cookie header', async () => {
    const { forRequest, sdk } = createSdk()

    await getNextjsPagesRouterOptimizationProps(
      sdk,
      createContext({
        cookies: { 'ctfl-opt-aid': 'parsed-cookie-id' },
        headers: { cookie: 'ctfl-opt-aid=raw-cookie-id' },
      }),
      { consent: { events: true, persistence: true } },
    )

    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({ profile: { id: 'parsed-cookie-id' } }),
    )
  })

  it('falls back to the raw cookie header', async () => {
    const { forRequest, sdk } = createSdk()

    await getNextjsPagesRouterOptimizationProps(
      sdk,
      createContext({
        cookies: {},
        headers: { cookie: 'ctfl-opt-aid=raw-cookie-id' },
      }),
      { consent: { events: true, persistence: true } },
    )

    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({ profile: { id: 'raw-cookie-id' } }),
    )
  })

  it('returns serializable props and skips the initial page event after consented server tracking', async () => {
    const { sdk } = createSdk()

    const result = await getNextjsPagesRouterOptimizationProps(sdk, createContext(), {
      consent: true,
    })

    expect(result.data).toBe(OPTIMIZATION_DATA)
    expect(result.props).toEqual({
      contentfulOptimization: {
        clientDefaults: { consent: true, persistenceConsent: true },
        initialPageEvent: 'skip',
        serverOptimizationState: OPTIMIZATION_DATA,
      },
    })
    expect(JSON.parse(JSON.stringify(result.props))).toEqual(result.props)
  })

  it('emits the initial browser page event when server data came from pre-consent tracking', async () => {
    const { sdk } = createSdk()

    const result = await getNextjsPagesRouterOptimizationProps(sdk, createContext(), {
      consent: false,
    })

    expect(result.props).toEqual({
      contentfulOptimization: {
        clientDefaults: { consent: false, persistenceConsent: false },
        initialPageEvent: 'emit',
        serverOptimizationState: OPTIMIZATION_DATA,
      },
    })
  })

  it('defaults the initial page event to emit when no server data exists', async () => {
    const { sdk } = createSdk(
      rs.fn<CoreStatelessRequest['page']>(
        async () => await Promise.resolve({ accepted: false, data: undefined }),
      ),
    )

    const result = await getNextjsPagesRouterOptimizationProps(sdk, createContext(), {
      consent: true,
    })

    expect(result.props).toEqual({
      contentfulOptimization: {
        clientDefaults: { consent: true, persistenceConsent: true },
        initialPageEvent: 'emit',
      },
    })
  })

  it('preserves separate event and persistence consent defaults', async () => {
    const { sdk } = createSdk()

    const result = await getNextjsPagesRouterOptimizationProps(sdk, createContext(), {
      consent: { events: true, persistence: false },
    })

    expect(result.props.contentfulOptimization).toMatchObject({
      clientDefaults: { consent: true, persistenceConsent: false },
      initialPageEvent: 'skip',
    })
  })

  it('honors an explicit initial page event override', async () => {
    const { sdk } = createSdk()

    const result = await getNextjsPagesRouterOptimizationProps(sdk, createContext(), {
      consent: true,
      initialPageEvent: 'emit',
    })

    expect(result.props.contentfulOptimization.initialPageEvent).toBe('emit')
  })

  it('appends Set-Cookie without clobbering existing response cookies', async () => {
    const { sdk } = createSdk()
    const context = createContext({ setCookie: ['app-cookie=1; Path=/'] })

    await getNextjsPagesRouterOptimizationProps(sdk, context, {
      consent: { events: true, persistence: true },
    })

    expect(context.res.getHeader('Set-Cookie')).toEqual([
      'app-cookie=1; Path=/',
      expect.stringContaining('ctfl-opt-aid=profile-from-page'),
    ])
  })

  it('clears Set-Cookie without clobbering existing response cookies when persistence is not allowed', async () => {
    const { sdk } = createSdk()
    const context = createContext({ setCookie: 'app-cookie=1; Path=/' })

    await getNextjsPagesRouterOptimizationProps(sdk, context, {
      consent: { events: true, persistence: false },
    })

    expect(context.res.getHeader('Set-Cookie')).toEqual([
      'app-cookie=1; Path=/',
      expect.stringContaining('ctfl-opt-aid='),
    ])
    expect(context.res.getHeader('Set-Cookie')).toEqual([
      'app-cookie=1; Path=/',
      expect.stringContaining('Max-Age=0'),
    ])
  })

  it('honors explicit locale over context locale', async () => {
    const { forRequest, sdk } = createSdk()

    await getNextjsPagesRouterOptimizationProps(sdk, createContext({ locale: 'en-US' }), {
      consent: true,
      locale: 'fr-FR',
    })

    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        eventContext: expect.objectContaining({ locale: 'fr-FR' }),
        locale: 'fr-FR',
      }),
    )
  })
})
