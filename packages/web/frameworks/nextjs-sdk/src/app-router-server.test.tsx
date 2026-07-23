import ContentfulOptimizationRuntime from '@contentful/optimization-node'
import type { MergeTagEntry } from '@contentful/optimization-node/api-schemas'
import type { CoreStatelessRequest } from '@contentful/optimization-node/core-sdk'
import { useConsentState, useSelectedOptimizationsState } from '@contentful/optimization-react-web'
import { NextRequest, NextResponse } from 'next/server'
import { PassThrough } from 'node:stream'
import type { ReactElement } from 'react'
import * as React from 'react'
import { renderToPipeableStream, renderToString } from 'react-dom/server'
import type {
  bindNextjsAppRouterOptimization as bindNextjsAppRouterOptimizationFactory,
  createHandoffFromSelections as createHandoffFromSelectionsFactory,
} from './app-router-server'
import type { OptimizationData, ServerTrackingBaselineEntry } from './server'

type CacheableFunction = (...args: never[]) => unknown

let bindNextjsAppRouterOptimization: typeof bindNextjsAppRouterOptimizationFactory
let createStandaloneHandoffFromSelections: typeof createHandoffFromSelectionsFactory
let appRouterServerExports: {
  readonly bindNextjsAppRouterOptimization: typeof bindNextjsAppRouterOptimizationFactory
  readonly createHandoffFromSelections: typeof createHandoffFromSelectionsFactory
}
let reactCacheTestGeneration = 0

void beforeAll(async () => {
  rs.doMock('react', () => ({
    default: React,
    ...React,
    cache<CachedFunction extends CacheableFunction>(fn: CachedFunction): CachedFunction {
      let generation = -1
      let value: unknown

      return new Proxy(fn, {
        apply(target, thisArg, argArray) {
          if (generation !== reactCacheTestGeneration) {
            value = Reflect.apply(target, thisArg, argArray)
            generation = reactCacheTestGeneration
          }

          return value
        },
      })
    },
  }))
  appRouterServerExports = await import('./app-router-server')
  ;({
    bindNextjsAppRouterOptimization,
    createHandoffFromSelections: createStandaloneHandoffFromSelections,
  } = appRouterServerExports)
})

const sdkConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  locale: 'en-US',
}

const baselineEntry = createEntry('baseline-entry')
const variantEntry = createEntry('variant-entry', { title: 'Variant entry' })
const selectedOptimizations: OptimizationData['selectedOptimizations'] = [
  {
    experienceId: 'experience-entry',
    sticky: false,
    variantIndex: 1,
    variants: { [baselineEntry.sys.id]: variantEntry.sys.id },
  },
]
const optimizedEntry = createOptimizedEntry(baselineEntry, variantEntry)
const optimizationData: OptimizationData = {
  changes: [],
  selectedOptimizations,
  profile: {
    id: 'server-profile-id',
    stableId: 'server-profile-id',
    random: 0.5,
    audiences: [],
    traits: {
      continent: 'EU',
    },
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

void afterEach(() => {
  reactCacheTestGeneration += 1
  rs.restoreAllMocks()
})

function createEntry(
  id: string,
  fields: ServerTrackingBaselineEntry['fields'] = {},
  contentTypeId = 'content-type',
): ServerTrackingBaselineEntry {
  return {
    fields,
    metadata: {
      tags: [],
    },
    sys: {
      contentType: {
        sys: {
          id: contentTypeId,
          linkType: 'ContentType',
          type: 'Link',
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      environment: {
        sys: {
          id: 'main',
          linkType: 'Environment',
          type: 'Link',
        },
      },
      id,
      locale: 'en-US',
      publishedVersion: 1,
      revision: 1,
      space: {
        sys: {
          id: 'space-id',
          linkType: 'Space',
          type: 'Link',
        },
      },
      type: 'Entry',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  }
}

function createOptimizedEntry(
  entry: ServerTrackingBaselineEntry,
  selectedVariantEntry: ServerTrackingBaselineEntry,
): ServerTrackingBaselineEntry {
  const optimizationEntry = createEntry(
    'experience-entry',
    {
      nt_config: {
        components: [
          {
            baseline: { id: entry.sys.id },
            type: 'EntryReplacement',
            variants: [{ id: selectedVariantEntry.sys.id }],
          },
        ],
      },
      nt_experience_id: 'experience-entry',
      nt_name: 'Experience entry',
      nt_type: 'nt_personalization',
      nt_variants: [selectedVariantEntry],
    },
    'nt_experience',
  )

  return {
    ...entry,
    fields: {
      ...entry.fields,
      nt_experiences: [optimizationEntry],
    },
  }
}

function createEntryCollection(items: readonly ServerTrackingBaselineEntry[]): {
  readonly items: ServerTrackingBaselineEntry[]
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

function createMergeTagEntry(id: string, selector: string): MergeTagEntry {
  const entry = createEntry(id)
  return {
    ...entry,
    fields: {
      nt_mergetag_id: selector,
      nt_name: selector,
    },
    sys: {
      ...entry.sys,
      contentType: {
        sys: {
          id: 'nt_mergetag',
          linkType: 'ContentType',
          type: 'Link',
        },
      },
    },
  }
}

function mockRequestPage(result: Awaited<ReturnType<CoreStatelessRequest['page']>>): {
  readonly forRequest: ReturnType<typeof rs.spyOn>
  readonly page: ReturnType<typeof rs.fn<CoreStatelessRequest['page']>>
} {
  const originalForRequest = ContentfulOptimizationRuntime.prototype.forRequest
  const page = rs.fn<CoreStatelessRequest['page']>(async () => await Promise.resolve(result))
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

function createRequest(): {
  readonly cookies: { get: (name: string) => { value: string } | undefined }
  readonly headers: Headers
  readonly url: string
} {
  return {
    cookies: { get: (name) => (name === 'ctfl-opt-aid' ? { value: 'incoming-id' } : undefined) },
    headers: new Headers({ 'user-agent': 'app-router-agent' }),
    url: 'https://example.test/products?tab=featured',
  }
}

async function renderToHtml(element: ReactElement): Promise<string> {
  return await new Promise((resolve, reject) => {
    let html = ''
    const stream = new PassThrough()
    stream.setEncoding('utf8')
    stream.on('data', (chunk: string) => {
      html += chunk
    })
    stream.on('end', () => {
      resolve(html)
    })
    stream.on('error', reject)

    const { pipe } = renderToPipeableStream(element, {
      onAllReady() {
        pipe(stream)
      },
      onError(error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    })
  })
}

function normalizeReactText(html: string): string {
  return html.replaceAll('<!-- -->', '')
}

describe('Next.js App Router v2 binding', () => {
  it('exposes handoff, analytics, cache, tracking, and resolution helpers', () => {
    const optimization = bindNextjsAppRouterOptimization(sdkConfig)

    expect(appRouterServerExports.bindNextjsAppRouterOptimization).toBeTypeOf('function')
    expect(appRouterServerExports).not.toHaveProperty('createNextjsAppRouterOptimization')
    expect(optimization.OptimizationRoot).toBeTypeOf('function')
    expect(optimization.OptimizationAnalyticsRoot).toBeTypeOf('function')
    expect(optimization.OptimizedEntry).toBeTypeOf('function')
    expect(optimization.createRequestHandoff).toBeTypeOf('function')
    expect(optimization.createHandoffFromSelections).toBeTypeOf('function')
    expect(optimization.createOptimizationCacheKey).toBeTypeOf('function')
    expect(optimization.createCacheMiddleware).toBeTypeOf('function')
    expect(optimization.getServerTrackingAttributes).toBeTypeOf('function')
    expect(optimization.resolveEntriesForSelections).toBeTypeOf('function')
    expect(optimization).not.toHaveProperty('proxy')
  })

  it('passes browser defaults through consent.clientDefaults and server prefetched entries through handoff.entries', async () => {
    const getEntry = rs.fn(async () => await Promise.resolve(baselineEntry))
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const { OptimizationRoot, createHandoffFromSelections } = bindNextjsAppRouterOptimization({
      ...sdkConfig,
      consent: {
        clientDefaults: { consent: false, persistenceConsent: false },
      },
      contentful: { client: { getEntry, getEntries }, cache: false },
    })
    const handoff = createHandoffFromSelections({
      cache: { scope: 'static' },
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations: [],
    })

    const element = await OptimizationRoot({
      children: 'Server content',
      handoff,
      prefetchManagedEntries: [{ entryId: 'baseline-entry', entryQuery: { locale: 'de-DE' } }],
    })

    expect(getEntry).toHaveBeenCalledWith('baseline-entry', {
      include: 10,
      locale: 'de-DE',
    })
    expect(element.props).toMatchObject({
      children: 'Server content',
      defaults: { consent: false, persistenceConsent: false },
      handoff: {
        entries: [{ baselineEntry, entryId: 'baseline-entry', entryQuery: { locale: 'de-DE' } }],
      },
    })
    expect(element.props).not.toHaveProperty('prefetchedManagedEntries')
    expect(element.props).not.toHaveProperty('serverOptimizationState')
  })

  it('passes hydration and server prefetched entries through the bound provider', async () => {
    const getEntry = rs.fn(async () => await Promise.resolve(baselineEntry))
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const { OptimizationProvider } = bindNextjsAppRouterOptimization({
      ...sdkConfig,
      contentful: { client: { getEntry, getEntries }, cache: false },
    })

    const element = await OptimizationProvider({
      children: 'Provider content',
      hydration: 'client-only-hidden-until-ready',
      prefetchManagedEntries: [{ entryId: 'baseline-entry', entryQuery: { locale: 'de-DE' } }],
    })

    expect(getEntry).toHaveBeenCalledWith('baseline-entry', {
      include: 10,
      locale: 'de-DE',
    })
    expect(element?.props).toMatchObject({
      handoff: {
        entries: [{ baselineEntry, entryId: 'baseline-entry', entryQuery: { locale: 'de-DE' } }],
      },
      hydration: 'client-only-hidden-until-ready',
    })
    expect(element?.props).not.toHaveProperty('prefetchManagedEntries')
  })

  it.each([
    ['accepted with data', { accepted: true, data: optimizationData }, 'skip'],
    ['accepted without data', { accepted: true }, 'skip'],
    ['blocked', { accepted: false }, 'emit'],
    ['pre-consent accepted', { accepted: true, data: optimizationData }, 'skip'],
  ] as const)(
    'creates request handoff with initialPageEvent from page acceptance: %s',
    async (_label, pageResult, expectedInitialPageEvent) => {
      const { forRequest, page } = mockRequestPage(pageResult)
      const serverConsent = _label !== 'pre-consent accepted'
      const { createRequestHandoff } = bindNextjsAppRouterOptimization({
        ...sdkConfig,
        consent: { server: serverConsent },
      })

      const handoff = await createRequestHandoff({
        cache: { scope: 'private-request' },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/products' } },
        request: createRequest(),
      })

      expect(page).toHaveBeenCalledWith({ properties: { route: '/products' } })
      expect(forRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          consent: serverConsent,
          eventContext: expect.objectContaining({
            page: expect.objectContaining({
              path: '/products',
              search: '?tab=featured',
            }),
            userAgent: 'app-router-agent',
          }),
          profile: { id: 'incoming-id' },
        }),
      )
      expect(handoff.initialPageEvent).toBe(expectedInitialPageEvent)
      expect(handoff.cache).toEqual({ scope: 'private-request' })
    },
  )

  it('surfaces request handoff rejection for public profile state', async () => {
    mockRequestPage({ accepted: true, data: optimizationData })
    const { createRequestHandoff } = bindNextjsAppRouterOptimization(sdkConfig)

    await expect(
      createRequestHandoff({
        cache: { scope: 'public-permutation', key: 'segment-a' },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/products' } },
        request: createRequest(),
      }),
    ).rejects.toThrow(
      'Profile state should not be included in public or static optimization caches. Request handoffs with profile state must use private-request cache scope.',
    )
  })

  it('creates analytics-only selection handoffs without mounting content personalization', () => {
    const { OptimizationAnalyticsRoot, createHandoffFromSelections } =
      bindNextjsAppRouterOptimization(sdkConfig)
    const handoff = createHandoffFromSelections({
      cache: { scope: 'public-permutation', key: 'segment-a' },
      hydration: 'analytics-only',
      initialPageEvent: 'emit',
      selectedOptimizations: [],
    })

    const element = OptimizationAnalyticsRoot({
      buildPagePayload: () => ({}),
      children: 'Analytics content',
      handoff,
      routeKey: '/segments/a',
    })

    expect(element.props).toMatchObject({
      children: 'Analytics content',
      handoff,
      routeKey: '/segments/a',
    })
    expect(element.props).not.toHaveProperty('liveUpdates')
  })

  it('clears prior content handoff state when an analytics-only handoff is mounted', async () => {
    const { OptimizedEntry, OptimizationAnalyticsRoot, createHandoffFromSelections } =
      bindNextjsAppRouterOptimization(sdkConfig)

    createHandoffFromSelections({
      cache: { scope: 'public-permutation', key: 'segment-a' },
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations,
    })
    const handoff = createStandaloneHandoffFromSelections({
      cache: { scope: 'public-permutation', key: 'segment-a' },
      hydration: 'analytics-only',
      initialPageEvent: 'emit',
      selectedOptimizations,
    })
    OptimizationAnalyticsRoot({
      buildPagePayload: () => ({}),
      children: null,
      handoff,
      routeKey: '/segments/a',
    })

    const html = await renderToHtml(
      await OptimizedEntry({
        baselineEntry: optimizedEntry,
        children: (entry) => entry.sys.id,
      }),
    )

    expect(html).toContain(`data-ctfl-entry-id="${baselineEntry.sys.id}"`)
    expect(html).toContain(baselineEntry.sys.id)
    expect(html).not.toContain(`data-ctfl-entry-id="${variantEntry.sys.id}"`)
  })

  it('preserves existing middleware chain state when cache middleware rewrites by customer key', async () => {
    const { createCacheMiddleware } = bindNextjsAppRouterOptimization(sdkConfig)
    const request = new NextRequest('https://example.test/products')
    const existingRequestHeaders = new Headers(request.headers)
    existingRequestHeaders.set('x-existing-request-handler', 'preserved')
    const existingResponse = NextResponse.next({ request: { headers: existingRequestHeaders } })
    existingResponse.headers.set('x-existing-handler', 'preserved')
    existingResponse.headers.set(
      'x-middleware-override-headers',
      Array.from(existingRequestHeaders.keys()).join(','),
    )
    for (const [name, value] of existingRequestHeaders) {
      existingResponse.headers.set(`x-middleware-request-${name}`, value)
    }
    const middleware = createCacheMiddleware({
      resolveCacheKey: () => 'segment-a',
      rewrite: ({ cacheKey, pathname }) => `/__ctfl-opt/${cacheKey}${pathname}`,
    })

    const response = await middleware(request, existingResponse)

    expect(response).toBe(existingResponse)
    expect(response.headers.get('x-existing-handler')).toBe('preserved')
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.test/__ctfl-opt/segment-a/products',
    )
    expect(response.headers.get('x-middleware-request-x-existing-request-handler')).toBe(
      'preserved',
    )
  })

  it('renders baseline entry content with server tracking attributes', async () => {
    const { OptimizedEntry } = bindNextjsAppRouterOptimization(sdkConfig)

    const html = await renderToHtml(
      await OptimizedEntry({
        baselineEntry,
        children: (entry) => entry.sys.id,
        'data-testid': 'entry',
        trackViews: true,
      }),
    )

    expect(html).toContain('data-ctfl-baseline-id="baseline-entry"')
    expect(html).toContain('data-ctfl-entry-id="baseline-entry"')
    expect(html).toContain('data-ctfl-track-views="true"')
    expect(html).toContain('data-testid="entry"')
    expect(html).toContain('baseline-entry')
  })

  it('passes explicit merge-tag profile helpers to server render props', async () => {
    const mergeTagEntry = createMergeTagEntry('merge-tag', 'traits.continent')
    const { OptimizedEntry } = bindNextjsAppRouterOptimization(sdkConfig)

    const html = await renderToHtml(
      await OptimizedEntry({
        baselineEntry,
        children: (_entry, { getMergeTagValue }) =>
          getMergeTagValue(mergeTagEntry, optimizationData.profile) ?? 'missing',
      }),
    )

    expect(html).toContain('EU')
  })

  it('resolves server OptimizedEntry from request handoff selections', async () => {
    mockRequestPage({ accepted: true, data: optimizationData })
    const { OptimizationRoot, OptimizedEntry, createRequestHandoff } =
      bindNextjsAppRouterOptimization(sdkConfig)

    async function Page(): Promise<ReactElement> {
      const handoff = await createRequestHandoff({
        cache: { scope: 'private-request' },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/' } },
        request: createRequest(),
      })

      return await OptimizationRoot({
        children: await OptimizedEntry({
          baselineEntry: optimizedEntry,
          children: (entry) => entry.sys.id,
        }),
        handoff,
      })
    }

    const html = await renderToHtml(React.createElement(Page))

    expect(html).toContain(`data-ctfl-baseline-id="${baselineEntry.sys.id}"`)
    expect(html).toContain(`data-ctfl-entry-id="${variantEntry.sys.id}"`)
    expect(html).toContain('data-ctfl-optimization-id="experience-entry"')
    expect(html).toContain('data-ctfl-variant-index="1"')
    expect(html).toContain(variantEntry.sys.id)
  })

  it('defaults server merge-tag helpers to the request handoff profile', async () => {
    mockRequestPage({ accepted: true, data: optimizationData })
    const mergeTagEntry = createMergeTagEntry('merge-tag', 'traits.continent')
    const { OptimizationRoot, OptimizedEntry, createRequestHandoff } =
      bindNextjsAppRouterOptimization(sdkConfig)

    async function Page(): Promise<ReactElement> {
      const handoff = await createRequestHandoff({
        cache: { scope: 'private-request' },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/' } },
        request: createRequest(),
      })

      return await OptimizationRoot({
        children: await OptimizedEntry({
          baselineEntry: optimizedEntry,
          children: (_entry, { getMergeTagValue }) => getMergeTagValue(mergeTagEntry) ?? 'missing',
        }),
        handoff,
      })
    }

    const html = await renderToHtml(React.createElement(Page))

    expect(html).toContain('EU')
  })

  it('resolves server OptimizedEntry from public selection handoff selections', async () => {
    const { OptimizationRoot, OptimizedEntry, createHandoffFromSelections } =
      bindNextjsAppRouterOptimization(sdkConfig)

    async function Page(): Promise<ReactElement> {
      const handoff = createHandoffFromSelections({
        cache: { scope: 'public-permutation', key: 'segment-a' },
        hydration: 'preserve-server',
        initialPageEvent: 'emit',
        selectedOptimizations,
      })

      return await OptimizationRoot({
        children: await OptimizedEntry({
          baselineEntry: optimizedEntry,
          children: (entry) => entry.sys.id,
        }),
        handoff,
      })
    }

    const html = await renderToHtml(React.createElement(Page))

    expect(html).toContain(`data-ctfl-entry-id="${variantEntry.sys.id}"`)
    expect(html).toContain(variantEntry.sys.id)
  })

  it('uses request handoff selections when resolving managed server entries', async () => {
    mockRequestPage({ accepted: true, data: optimizationData })
    const getEntry = rs.fn(async () => await Promise.resolve(optimizedEntry))
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const { OptimizationRoot, OptimizedEntry, createRequestHandoff } =
      bindNextjsAppRouterOptimization({
        ...sdkConfig,
        contentful: { cache: false, client: { getEntry, getEntries } },
      })

    async function Page(): Promise<ReactElement> {
      const handoff = await createRequestHandoff({
        cache: { scope: 'private-request' },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/' } },
        request: createRequest(),
      })

      return await OptimizationRoot({
        children: await OptimizedEntry({
          children: (entry) => entry.sys.id,
          entryId: optimizedEntry.sys.id,
        }),
        handoff,
      })
    }

    const html = await renderToHtml(React.createElement(Page))

    expect(getEntry).toHaveBeenCalledWith(optimizedEntry.sys.id, {
      include: 10,
      locale: sdkConfig.locale,
    })
    expect(html).toContain(`data-ctfl-entry-id="${variantEntry.sys.id}"`)
    expect(html).toContain(variantEntry.sys.id)
  })

  it('makes request handoff consent and selections available during server render', async () => {
    mockRequestPage({ accepted: true, data: optimizationData })
    const { OptimizationRoot, createRequestHandoff } = bindNextjsAppRouterOptimization({
      ...sdkConfig,
      consent: { server: true, clientDefaults: { consent: false, persistenceConsent: false } },
    })
    function StateProbe(): ReactElement {
      const consent = useConsentState()
      const currentSelectedOptimizations = useSelectedOptimizationsState()

      return (
        <span>
          {consent ? 'consented' : 'blocked'}:{currentSelectedOptimizations?.length ?? 0}
        </span>
      )
    }

    async function Page(): Promise<ReactElement> {
      const handoff = await createRequestHandoff({
        cache: { scope: 'private-request' },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/' } },
        request: createRequest(),
      })

      return await OptimizationRoot({ children: <StateProbe />, handoff })
    }

    expect(normalizeReactText(await renderToHtml(React.createElement(Page)))).toContain(
      'consented:1',
    )
  })

  it('hydrates handoff state during server render through the React Web root', async () => {
    const { OptimizationRoot, createHandoffFromSelections } =
      bindNextjsAppRouterOptimization(sdkConfig)
    const handoff = createHandoffFromSelections({
      cache: { scope: 'static' },
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations: [],
    })

    function ContentProbe(): ReactElement {
      return <span>server-root</span>
    }

    const element = await OptimizationRoot({ children: <ContentProbe />, handoff })

    expect(renderToString(element)).toContain('server-root')
  })
})
