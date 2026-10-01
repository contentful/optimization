import { EventBuilder } from '@contentful/optimization-node/core-sdk'
import type { Entry } from 'contentful'
import type { GetServerSidePropsContext } from 'next'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import {
  bindNextjsPagesRouterServerOptimization,
  createNextjsPagesRouterRequestHandoff,
} from './pages-router-server'
import {
  configureNextjsServerOptimization,
  type ContentfulOptimization,
  type CoreStatelessRequest,
  type OptimizationData,
} from './server'
const replayEventBuilder = new EventBuilder({
  channel: 'server',
  library: { name: 'test-server', version: '1.0.0' },
})

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
  readonly previewInitialExperience: ReturnType<
    typeof rs.fn<CoreStatelessRequest['previewInitialExperience']>
  >
  readonly sdk: ContentfulOptimization
}
type NextjsOptimizationConfig = Parameters<typeof configureNextjsServerOptimization>[0]

function createSdk(
  previewInitialExperience = rs.fn<CoreStatelessRequest['previewInitialExperience']>(
    async () =>
      await Promise.resolve({
        accepted: true,
        data: OPTIMIZATION_DATA,
        experience: [replayEventBuilder.buildPageView({})],
        insights: [],
      }),
  ),
  config: NextjsOptimizationConfig = SDK_CONFIG,
): CreatedSdk {
  const sdk = configureNextjsServerOptimization(config)
  const originalForRequest = sdk.forRequest.bind(sdk)
  const forRequest = rs.spyOn(sdk, 'forRequest')

  forRequest.mockImplementation((options) => {
    const requestOptimization = originalForRequest(options)
    rs.spyOn(requestOptimization, 'previewInitialExperience').mockImplementation(
      previewInitialExperience,
    )
    return requestOptimization
  })

  return { forRequest, previewInitialExperience, sdk }
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
  it('falls back to a profileless handoff when the consent resolver rejects', async () => {
    const consentError = new Error('Consent service unavailable')
    const { createRequestHandoff } = bindNextjsPagesRouterServerOptimization({
      ...SDK_CONFIG,
      consent: { server: async () => await Promise.reject(consentError) },
    })

    const handoff = await createRequestHandoff(createContext(), {
      entries: [{ baselineEntry: createEntry('baseline-entry'), entryId: 'baseline-entry' }],
      hydration: 'preserve-server',
      pagePayload: {},
    })

    expect(handoff).toMatchObject({
      cache: { scope: 'private-request' },
      defaults: { consent: false, persistenceConsent: false },
      entries: [{ entryId: 'baseline-entry' }],
      hydration: 'preserve-server',
    })
    expect(handoff).not.toHaveProperty('state')
    expect(handoff).not.toHaveProperty('replay')
  })

  it('maps getServerSideProps URL and context into the request preview', async () => {
    const { forRequest, previewInitialExperience, sdk } = createSdk()

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
    expect(previewInitialExperience).toHaveBeenCalledWith({
      page: { properties: { route: '/products' } },
    })
  })

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

  it('prefetches declared managed entries into handoff entries after request data loads', async () => {
    const calls: string[] = []
    const baselineEntry = createEntry('4ib0hsHWoSOnCVdDkizE8d')
    const existingEntry = createEntry('4k6ZyFQnR2POY5IJLLlJRb')
    const getEntry = rs.fn(async () => await Promise.resolve(createEntry('unused')))
    const getEntries = rs.fn(async () => {
      calls.push('fetch')
      return await Promise.resolve(createEntryCollection([baselineEntry]))
    })
    const previewInitialExperience = rs.fn<CoreStatelessRequest['previewInitialExperience']>(
      async () => {
        calls.push('preview')
        return await Promise.resolve({
          accepted: true,
          data: OPTIMIZATION_DATA,
          experience: [replayEventBuilder.buildPageView({})],
          insights: [],
        })
      },
    )
    const { sdk } = createSdk(previewInitialExperience, {
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

    expect(calls).toEqual(['preview', 'fetch'])
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

  it('leaves existing response cookies untouched when preview identity is not persisted', async () => {
    const { sdk } = createSdk()
    const context = createContext({ setCookie: ['app-cookie=1; Path=/'] })

    await createNextjsPagesRouterRequestHandoff(sdk, context, {
      consent: { events: true, persistence: true },
      hydration: 'preserve-server',
      pagePayload: {},
    })

    expect(context.res.getHeader('Set-Cookie')).toEqual(['app-cookie=1; Path=/'])
  })
})
