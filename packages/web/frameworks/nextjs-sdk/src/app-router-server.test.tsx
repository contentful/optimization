import ContentfulOptimizationRuntime from '@contentful/optimization-node'
import type { MergeTagEntry } from '@contentful/optimization-node/api-schemas'
import type { CoreStatelessRequest } from '@contentful/optimization-node/core-sdk'
import { useConsentState, useSelectedOptimizationsState } from '@contentful/optimization-react-web'
import { PassThrough } from 'node:stream'
import type { ReactElement } from 'react'
import * as React from 'react'
import { renderToPipeableStream, renderToString } from 'react-dom/server'
import type {
  bindNextjsAppRouterServerOptimization as bindNextjsAppRouterServerOptimizationFactory,
  createHandoffFromSelections as createHandoffFromSelectionsFactory,
  createPublicPermutationCacheMetadata as createPublicPermutationCacheMetadataFactory,
  createPublicPermutationHandoff as createPublicPermutationHandoffFactory,
} from './app-router-server'
import {
  NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER,
  NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER,
  serializeNextjsOptimizationRequestContext,
} from './request-context'
import type { OptimizationData, ServerTrackingBaselineEntry } from './server'

type CacheableFunction = (...args: never[]) => unknown
type FetchMethod = (input: string | Request, init?: RequestInit) => Promise<Response>

let bindNextjsAppRouterServerOptimization: typeof bindNextjsAppRouterServerOptimizationFactory
let createStandaloneHandoffFromSelections: typeof createHandoffFromSelectionsFactory
let createStandalonePublicPermutationHandoff: typeof createPublicPermutationHandoffFactory
let appRouterServerExports: {
  readonly bindNextjsAppRouterServerOptimization: typeof bindNextjsAppRouterServerOptimizationFactory
  readonly createHandoffFromSelections: typeof createHandoffFromSelectionsFactory
  readonly createPublicPermutationCacheMetadata: typeof createPublicPermutationCacheMetadataFactory
  readonly createPublicPermutationHandoff: typeof createPublicPermutationHandoffFactory
}
let reactCacheTestGeneration = 0
let currentNextRequest = createRequest()
const readNextCookies = rs.fn(async () => await Promise.resolve(currentNextRequest.cookies))
const readNextHeaders = rs.fn(async () => await Promise.resolve(currentNextRequest.headers))

void beforeAll(async () => {
  rs.doMock('next/headers', () => ({ cookies: readNextCookies, headers: readNextHeaders }))
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
    bindNextjsAppRouterServerOptimization,
    createHandoffFromSelections: createStandaloneHandoffFromSelections,
    createPublicPermutationHandoff: createStandalonePublicPermutationHandoff,
  } = appRouterServerExports)
})

const sdkConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  locale: 'en-US',
}

const baselineEntry = createEntry('4ib0hsHWoSOnCVdDkizE8d')
const variantEntry = createEntry('4k6ZyFQnR2POY5IJLLlJRb', { title: 'Variant entry' })
const selectedOptimizations: OptimizationData['selectedOptimizations'] = [
  {
    experienceId: '6IueRX1pS3iMJncbhUQTba',
    sticky: false,
    variantIndex: 1,
    variants: { [baselineEntry.sys.id]: variantEntry.sys.id },
  },
]
const emptyVariantSelectedOptimizations: OptimizationData['selectedOptimizations'] = [
  {
    experienceId: '6IueRX1pS3iMJncbhUQTba',
    sticky: false,
    variantIndex: 1,
    variants: { [baselineEntry.sys.id]: '' },
  },
]
const optimizedEntry = createOptimizedEntry(baselineEntry, variantEntry)
const emptyVariantOptimizedEntry = createOptimizedEntry(baselineEntry)
const optimizationData: OptimizationData = {
  changes: [],
  selectedOptimizations,
  profile: {
    id: 'f0837d7dc6344c36a3a0a06c4cde754b',
    stableId: 'f0837d7dc6344c36a3a0a06c4cde754b',
    random: 0.5,
    audiences: [],
    traits: {
      continent: 'EU',
    },
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

function setForwardedServerData(headers: Headers, value: unknown): void {
  headers.set(
    NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER,
    serializeNextjsOptimizationRequestContext(value),
  )
}

void afterEach(() => {
  reactCacheTestGeneration += 1
  rs.restoreAllMocks()
  readNextCookies.mockClear()
  readNextHeaders.mockClear()
  currentNextRequest = createRequest()
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
  selectedVariantEntry?: ServerTrackingBaselineEntry,
): ServerTrackingBaselineEntry {
  const optimizationEntry = createEntry(
    '6IueRX1pS3iMJncbhUQTba',
    {
      nt_config: {
        components: [
          {
            baseline: { id: entry.sys.id },
            type: 'EntryReplacement',
            variants: [{ id: selectedVariantEntry?.sys.id ?? '' }],
          },
        ],
      },
      nt_experience_id: '6IueRX1pS3iMJncbhUQTba',
      nt_name: 'Experience entry',
      nt_type: 'nt_personalization',
      nt_variants: selectedVariantEntry === undefined ? [] : [selectedVariantEntry],
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

function setCurrentNextRequest(
  url = 'https://example.test/products?tab=featured',
): ReturnType<typeof createRequest> {
  const request = createRequest()
  request.headers.set(NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER, url)
  currentNextRequest = { ...request, url }

  return currentNextRequest
}

function mockProfileFetch(
  data: OptimizationData = optimizationData,
): ReturnType<typeof rs.fn<FetchMethod>> {
  return rs.fn<FetchMethod>(
    async () =>
      await Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              changes: data.changes,
              experiences: data.selectedOptimizations,
              profile: data.profile,
            },
            error: false,
            message: 'ok',
          }),
        ),
      ),
  )
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

function getElementProps(element: ReactElement): Record<string, unknown> {
  if (typeof element.props !== 'object' || element.props === null) {
    throw new Error('Expected React element props.')
  }

  return Object.fromEntries(Object.entries(element.props))
}

describe('Next.js App Router v2 binding', () => {
  it('exposes handoff, analytics, tracking, and resolution helpers', () => {
    const optimization = bindNextjsAppRouterServerOptimization(sdkConfig)

    expect(appRouterServerExports.bindNextjsAppRouterServerOptimization).toBeTypeOf('function')
    expect(appRouterServerExports).not.toHaveProperty('createNextjsAppRouterOptimization')
    expect(optimization.OptimizationRoot).toBeTypeOf('function')
    expect(optimization.OptimizationAnalyticsRoot).toBeTypeOf('function')
    expect(optimization.OptimizedEntry).toBeTypeOf('function')
    expect(optimization.request.OptimizationRoot).toBeTypeOf('function')
    expect(optimization.request.OptimizationProvider).toBeTypeOf('function')
    expect(optimization.request.OptimizedEntry).toBeTypeOf('function')
    expect(optimization.request.NextAppAutoPageTracker).toBeTypeOf('function')
    expect(optimization.createRequestHandoff).toBeTypeOf('function')
    expect(optimization.createHandoffFromSelections).toBeTypeOf('function')
    expect(optimization.createOptimizationCacheKey).toBeTypeOf('function')
    expect(optimization.createPublicPermutationHandoff).toBeTypeOf('function')
    expect(appRouterServerExports.createPublicPermutationCacheMetadata).toBeTypeOf('function')
    expect(appRouterServerExports.createPublicPermutationHandoff).toBeTypeOf('function')
    expect(optimization).not.toHaveProperty('getServerTrackingAttributes')
    expect(optimization.resolveEntriesForSelections).toBeTypeOf('function')
    expect(optimization).not.toHaveProperty('createCacheMiddleware')
    expect(optimization).not.toHaveProperty('proxy')
  })

  it('waits for the shared request handoff when OptimizedEntry starts before the root', async () => {
    setCurrentNextRequest()
    const { page } = mockRequestPage({ accepted: true, data: optimizationData })
    let resolvePage: ((result: { accepted: true; data: OptimizationData }) => void) | undefined
    const delayedPage = new Promise<{ accepted: true; data: OptimizationData }>((resolve) => {
      resolvePage = resolve
    })
    page.mockImplementationOnce(async () => await delayedPage)
    const { request } = bindNextjsAppRouterServerOptimization(sdkConfig)

    const entryPromise = request.OptimizedEntry({
      baselineEntry: optimizedEntry,
      children: (entry) => entry.sys.id,
    })
    const rootPromise = request.OptimizationRoot({ children: 'Request root' })

    await Promise.resolve()
    await Promise.resolve()
    resolvePage?.({ accepted: true, data: optimizationData })

    const [entry, root] = await Promise.all([entryPromise, rootPromise])
    const html = await renderToHtml(entry)

    expect(page).toHaveBeenCalledTimes(1)
    expect(getElementProps(root).handoff).toBeDefined()
    expect(html).toContain(`data-ctfl-entry-id="${variantEntry.sys.id}"`)
    expect(html).toContain(variantEntry.sys.id)
  })

  it('keeps selected content behind request initialization after managed fetching finishes', async () => {
    setCurrentNextRequest()
    const experienceStarted = Promise.withResolvers<undefined>()
    const cdaStarted = Promise.withResolvers<undefined>()
    const cdaFinished = Promise.withResolvers<undefined>()
    const experienceRelease = Promise.withResolvers<{
      accepted: true
      data: OptimizationData
    }>()
    const cdaRelease = Promise.withResolvers<ServerTrackingBaselineEntry>()
    const { page } = mockRequestPage({ accepted: true, data: optimizationData })
    page.mockImplementationOnce(async () => {
      experienceStarted.resolve(undefined)
      return await experienceRelease.promise
    })
    const getEntry = rs.fn(async () => {
      cdaStarted.resolve(undefined)
      const entry = await cdaRelease.promise
      cdaFinished.resolve(undefined)
      return entry
    })
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const resolveOptimizedEntry = rs.spyOn(
      ContentfulOptimizationRuntime.prototype,
      'resolveOptimizedEntry',
    )
    const { request } = bindNextjsAppRouterServerOptimization({
      ...sdkConfig,
      contentful: { cache: false, client: { getEntry, getEntries } },
    })
    const settled = rs.fn()

    const entryPromise = request.OptimizedEntry({
      children: (entry) => entry.sys.id,
      entryId: optimizedEntry.sys.id,
    })
    void entryPromise.then(settled)

    await Promise.all([experienceStarted.promise, cdaStarted.promise])
    expect(page).toHaveBeenCalledTimes(1)
    expect(getEntry).toHaveBeenCalledTimes(1)

    cdaRelease.resolve(optimizedEntry)
    await cdaFinished.promise

    expect(resolveOptimizedEntry).not.toHaveBeenCalled()
    expect(settled).not.toHaveBeenCalled()

    experienceRelease.resolve({ accepted: true, data: optimizationData })
    const html = await renderToHtml(await entryPromise)

    expect(resolveOptimizedEntry).toHaveBeenCalledTimes(1)
    expect(html).toContain(`data-ctfl-entry-id="${variantEntry.sys.id}"`)
  })

  it.each(['OptimizationRoot', 'OptimizationProvider'] as const)(
    'keeps request %s pending until managed prefetch joins its handoff',
    async (component) => {
      setCurrentNextRequest()
      const experienceStarted = Promise.withResolvers<undefined>()
      const experienceFinished = Promise.withResolvers<undefined>()
      const cdaStarted = Promise.withResolvers<undefined>()
      const experienceRelease = Promise.withResolvers<{
        accepted: true
        data: OptimizationData
      }>()
      const cdaRelease = Promise.withResolvers<ServerTrackingBaselineEntry>()
      const { page } = mockRequestPage({ accepted: true, data: optimizationData })
      page.mockImplementationOnce(async () => {
        experienceStarted.resolve(undefined)
        const result = await experienceRelease.promise
        experienceFinished.resolve(undefined)
        return result
      })
      const getEntry = rs.fn(async () => {
        cdaStarted.resolve(undefined)
        return await cdaRelease.promise
      })
      const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
      const { request } = bindNextjsAppRouterServerOptimization({
        ...sdkConfig,
        contentful: { cache: false, client: { getEntry, getEntries } },
        request: { hydration: 'client-only-hidden-until-ready' },
      })
      const settled = rs.fn()

      const componentPromise = request[component]({
        children: 'Root content',
        prefetchManagedEntries: [baselineEntry.sys.id],
      })
      void componentPromise.then(settled)

      await Promise.all([experienceStarted.promise, cdaStarted.promise])
      expect(page).toHaveBeenCalledTimes(1)
      expect(getEntry).toHaveBeenCalledTimes(1)

      experienceRelease.resolve({ accepted: true, data: optimizationData })
      await experienceFinished.promise
      expect(settled).not.toHaveBeenCalled()

      cdaRelease.resolve(baselineEntry)
      const element = await componentPromise
      if (element === null) throw new Error(`Expected request ${component} element.`)
      const props = getElementProps(element)

      expect(props).toMatchObject({
        handoff: {
          entries: [{ baselineEntry, entryId: baselineEntry.sys.id }],
          state: { selectedOptimizations },
        },
        hydration: 'client-only-hidden-until-ready',
      })
      expect(props).not.toHaveProperty('prefetchManagedEntries')
    },
  )

  it.each(['managed prefetch', 'OptimizedEntry'] as const)(
    'surfaces request initialization failure before %s CDA failure',
    async (component) => {
      setCurrentNextRequest()
      const requestError = new Error('Request initialization failed')
      const cdaStarted = Promise.withResolvers<undefined>()
      const requestRelease = Promise.withResolvers<{
        accepted: true
        data: OptimizationData
      }>()
      const { page } = mockRequestPage({ accepted: true, data: optimizationData })
      page.mockImplementationOnce(async () => await requestRelease.promise)
      const getEntry = rs.fn(async () => {
        cdaStarted.resolve(undefined)
        return await Promise.reject(new Error('CDA failed'))
      })
      const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
      const { request } = bindNextjsAppRouterServerOptimization({
        ...sdkConfig,
        contentful: { cache: false, client: { getEntry, getEntries } },
      })
      const settled = rs.fn()
      const result = (
        component === 'managed prefetch'
          ? request.OptimizationRoot({
              children: null,
              prefetchManagedEntries: [baselineEntry.sys.id],
            })
          : request.OptimizedEntry({ children: null, entryId: baselineEntry.sys.id })
      ).catch((error: unknown) => error)
      void result.then(settled)

      await cdaStarted.promise
      await Promise.resolve()
      expect(settled).not.toHaveBeenCalled()

      requestRelease.reject(requestError)
      expect(await result).toBe(requestError)
    },
  )

  it.each(['managed prefetch', 'OptimizedEntry'] as const)(
    'surfaces %s CDA failure after successful request initialization',
    async (component) => {
      setCurrentNextRequest()
      const cdaError = new Error('CDA failed')
      mockRequestPage({ accepted: true, data: optimizationData })
      const getEntry = rs.fn(async () => await Promise.reject(cdaError))
      const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
      const { request } = bindNextjsAppRouterServerOptimization({
        ...sdkConfig,
        contentful: { cache: false, client: { getEntry, getEntries } },
      })

      const result =
        component === 'managed prefetch'
          ? request.OptimizationRoot({
              children: null,
              prefetchManagedEntries: [baselineEntry.sys.id],
            })
          : request.OptimizedEntry({ children: null, entryId: baselineEntry.sys.id })

      await expect(result).rejects.toBe(cdaError)
    },
  )

  it('initializes all request wrappers from one cached resource', async () => {
    setCurrentNextRequest()
    const { forRequest, page } = mockRequestPage({ accepted: true, data: optimizationData })
    const { request } = bindNextjsAppRouterServerOptimization(sdkConfig)

    const [root, provider, entry, tracker] = await Promise.all([
      request.OptimizationRoot({ children: 'Root' }),
      request.OptimizationProvider({ children: 'Provider' }),
      request.OptimizedEntry({
        baselineEntry: optimizedEntry,
        children: (resolvedEntry) => resolvedEntry.sys.id,
      }),
      request.NextAppAutoPageTracker({}),
    ])

    expect(forRequest).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledTimes(1)
    expect(getElementProps(root).handoff).toBe(
      provider === null ? undefined : getElementProps(provider).handoff,
    )
    expect(getElementProps(tracker).initialPageEvent).toBe('skip')
    expect(await renderToHtml(entry)).toContain(variantEntry.sys.id)
    expect(readNextCookies).toHaveBeenCalledTimes(1)
    expect(readNextHeaders).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['default', undefined, 'preserve-server'],
    ['fixed', 'client-only-hidden-until-ready', 'client-only-hidden-until-ready'],
    [
      'resolved',
      ({ requestUrl, routeKey }: { requestUrl: string; routeKey: string }) =>
        requestUrl.endsWith(routeKey) ? 'client-only-hidden-until-ready' : 'preserve-server',
      'client-only-hidden-until-ready',
    ],
  ] as const)('uses %s request hydration', async (_label, hydration, expectedHydration) => {
    const url = 'https://example.test/products?tab=featured'
    setCurrentNextRequest(url)
    mockRequestPage({ accepted: true })
    const { request } = bindNextjsAppRouterServerOptimization({
      ...sdkConfig,
      request: hydration === undefined ? undefined : { hydration },
    })

    const root = await request.OptimizationRoot({ children: 'Root' })

    expect(getElementProps(root)).toMatchObject({
      hydration: expectedHydration,
      initialPagePayload: {
        properties: { path: '/products', search: '?tab=featured', url },
      },
      routeKey: '/products?tab=featured',
    })
  })

  it('fails with request-handler setup guidance when the forwarded URL is missing', async () => {
    const { request } = bindNextjsAppRouterServerOptimization(sdkConfig)

    await expect(request.OptimizationRoot({ children: null })).rejects.toThrow(
      'Missing x-ctfl-opt-request-url. Configure the Contentful Optimization request handler in your Next.js proxy before using request components.',
    )
  })

  it('uses trusted forwarded handoff state and preserves page-event ownership only when opted in', async () => {
    const forwardedRequest = setCurrentNextRequest()
    setForwardedServerData(forwardedRequest.headers, {
      consent: true,
      pageAccepted: true,
    })
    const { forRequest, page } = mockRequestPage({ accepted: false })
    const { request } = bindNextjsAppRouterServerOptimization({
      ...sdkConfig,
      request: { trustedRequestHandoff: true },
    })

    const tracker = await request.NextAppAutoPageTracker({})

    expect(forRequest).not.toHaveBeenCalled()
    expect(page).not.toHaveBeenCalled()
    expect(getElementProps(tracker).initialPageEvent).toBe('skip')
  })

  it('isolates request URL, profile, handoff, and selected-entry state across RSC requests', async () => {
    const secondProfile = {
      ...optimizationData.profile,
      id: 'second-profile-id',
      stableId: 'second-profile-id',
    }
    const secondData: OptimizationData = {
      ...optimizationData,
      profile: secondProfile,
      selectedOptimizations: [],
    }
    const { forRequest, page } = mockRequestPage({ accepted: true, data: optimizationData })
    page.mockResolvedValueOnce({ accepted: true, data: optimizationData })
    page.mockResolvedValueOnce({ accepted: true, data: secondData })
    const hydration = rs.fn(() => 'preserve-server' as const)
    const { request } = bindNextjsAppRouterServerOptimization({
      ...sdkConfig,
      request: { hydration },
    })

    setCurrentNextRequest('https://example.test/first?segment=a')
    const firstRoot = await request.OptimizationRoot({ children: null })
    const firstEntry = await request.OptimizedEntry({
      baselineEntry: optimizedEntry,
      children: (entry) => entry.sys.id,
    })

    reactCacheTestGeneration += 1
    setCurrentNextRequest('https://example.test/second?segment=b')
    const secondRoot = await request.OptimizationRoot({ children: null })
    const secondEntry = await request.OptimizedEntry({
      baselineEntry: optimizedEntry,
      children: (entry) => entry.sys.id,
    })

    expect(forRequest).toHaveBeenCalledTimes(2)
    expect(page).toHaveBeenCalledTimes(2)
    expect(hydration.mock.calls).toEqual([
      [{ requestUrl: 'https://example.test/first?segment=a', routeKey: '/first?segment=a' }],
      [{ requestUrl: 'https://example.test/second?segment=b', routeKey: '/second?segment=b' }],
    ])
    expect(getElementProps(firstRoot).handoff).not.toBe(getElementProps(secondRoot).handoff)
    expect(getElementProps(firstRoot)).toMatchObject({
      handoff: { state: { profile: { id: optimizationData.profile.id } } },
    })
    expect(getElementProps(secondRoot)).toMatchObject({
      handoff: { state: { profile: { id: secondProfile.id } } },
    })
    expect(await renderToHtml(firstEntry)).toContain(variantEntry.sys.id)
    expect(await renderToHtml(secondEntry)).toContain(baselineEntry.sys.id)
    expect(await renderToHtml(secondEntry)).not.toContain(variantEntry.sys.id)
  })

  it('keeps top-level static, public, analytics, and manual paths free of Next.js request reads', async () => {
    const { page } = mockRequestPage({ accepted: true })
    const {
      OptimizationAnalyticsRoot,
      OptimizationRoot,
      createHandoffFromSelections,
      createPublicPermutationHandoff,
      createRequestHandoff,
    } = bindNextjsAppRouterServerOptimization(sdkConfig)
    const staticHandoff = createHandoffFromSelections({
      cache: { scope: 'static' },
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations: [],
    })
    createPublicPermutationHandoff({
      hydration: 'analytics-only',
      initialPageEvent: 'emit',
      permutationKey: 'segment-a',
      selectedOptimizations: [],
    })
    const publicHandoff = createStandalonePublicPermutationHandoff({
      hydration: 'analytics-only',
      initialPageEvent: 'emit',
      permutationKey: 'segment-a',
      selectedOptimizations: [],
    })

    await OptimizationRoot({ children: null, handoff: staticHandoff })
    OptimizationAnalyticsRoot({ children: null, handoff: publicHandoff, routeKey: '/segment-a' })
    await createRequestHandoff({
      hydration: 'preserve-server',
      pagePayload: {},
      request: createRequest(),
    })

    expect(page).toHaveBeenCalledTimes(1)
    expect(readNextCookies).not.toHaveBeenCalled()
    expect(readNextHeaders).not.toHaveBeenCalled()
  })

  it('passes browser defaults through consent.clientDefaults and server prefetched entries through handoff.entries', async () => {
    const getEntry = rs.fn(async () => await Promise.resolve(createEntry('unused')))
    const getEntries = rs.fn(
      async () => await Promise.resolve(createEntryCollection([baselineEntry])),
    )
    const { OptimizationRoot, createHandoffFromSelections } = bindNextjsAppRouterServerOptimization(
      {
        ...sdkConfig,
        consent: {
          clientDefaults: { consent: false, persistenceConsent: false },
        },
        contentful: { client: { getEntry, getEntries }, cache: false },
      },
    )
    const handoff = createHandoffFromSelections({
      cache: { scope: 'static' },
      entries: [{ baselineEntry: variantEntry, entryId: variantEntry.sys.id }],
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations: [],
    })

    const element = await OptimizationRoot({
      children: 'Server content',
      handoff,
      prefetchManagedEntries: [
        {
          entryQuery: { locale: 'de-DE' },
          contentType: 'page',
          slug: '/products',
          slugField: 'path',
        },
      ],
    })

    expect(getEntry).not.toHaveBeenCalled()
    expect(getEntries).toHaveBeenCalledWith({
      content_type: 'page',
      'fields.path': '/products',
      include: 10,
      limit: 2,
      locale: 'de-DE',
    })
    expect(element.props).toMatchObject({
      children: 'Server content',
      defaults: { consent: false, persistenceConsent: false },
      handoff: {
        entries: [
          { baselineEntry: variantEntry, entryId: variantEntry.sys.id },
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
      },
    })
    expect(element.props).not.toHaveProperty('contentful')
    expect(element.props).not.toHaveProperty('prefetchedManagedEntries')
    expect(element.props).not.toHaveProperty('serverOptimizationState')
  })

  it('passes hydration and server prefetched entries through the bound provider', async () => {
    const getEntry = rs.fn(async () => await Promise.resolve(baselineEntry))
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const { OptimizationProvider } = bindNextjsAppRouterServerOptimization({
      ...sdkConfig,
      contentful: { client: { getEntry, getEntries }, cache: false },
    })

    const element = await OptimizationProvider({
      children: 'Provider content',
      hydration: 'client-only-hidden-until-ready',
      prefetchManagedEntries: [
        { entryId: '4ib0hsHWoSOnCVdDkizE8d', entryQuery: { locale: 'de-DE' } },
      ],
    })

    expect(getEntry).toHaveBeenCalledWith('4ib0hsHWoSOnCVdDkizE8d', {
      include: 10,
      locale: 'de-DE',
    })
    expect(element?.props).toMatchObject({
      handoff: {
        entries: [
          { baselineEntry, entryId: '4ib0hsHWoSOnCVdDkizE8d', entryQuery: { locale: 'de-DE' } },
        ],
      },
      hydration: 'client-only-hidden-until-ready',
    })
    expect(element?.props).not.toHaveProperty('contentful')
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
      const { createRequestHandoff } = bindNextjsAppRouterServerOptimization({
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

  it.each([
    ['accepted with data', true],
    ['not accepted with data', false],
  ] as const)(
    'creates request handoff from trusted forwarded server data while browser owns page payload: %s',
    async (_label, pageAccepted) => {
      const { forRequest, page } = mockRequestPage({ accepted: true, data: optimizationData })
      const request = createRequest()
      const getProfile = mockProfileFetch()
      const { OptimizationRoot, createRequestHandoff } = bindNextjsAppRouterServerOptimization({
        ...sdkConfig,
        fetchOptions: { fetchMethod: getProfile },
      })

      setForwardedServerData(request.headers, {
        consent: { events: true, persistence: false },
        pageAccepted,
        profileId: 'f0837d7dc6344c36a3a0a06c4cde754b',
      })

      const handoff = await createRequestHandoff({
        cache: { scope: 'private-request' },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/products' } },
        request,
        trustedRequestHandoff: true,
      })
      const element = await OptimizationRoot({ children: 'Server content', handoff })

      expect(forRequest).not.toHaveBeenCalled()
      expect(page).not.toHaveBeenCalled()
      expect(getProfile).toHaveBeenCalledTimes(1)
      const profileUrl = getProfile.mock.calls[0]?.[0]
      if (typeof profileUrl !== 'string') throw new Error('Expected getProfile URL string.')
      expect(profileUrl).toContain('/profiles/f0837d7dc6344c36a3a0a06c4cde754b')
      expect(profileUrl).toContain('locale=en-US')
      expect(handoff.initialPageEvent).toBe(pageAccepted ? 'skip' : 'emit')
      expect(handoff.cache).toEqual({ scope: 'private-request' })
      expect(handoff.state).toEqual({
        changes: optimizationData.changes,
        profile: optimizationData.profile,
        selectedOptimizations: optimizationData.selectedOptimizations,
      })
      expect(element.props).toMatchObject({
        defaults: { consent: true, persistenceConsent: false },
      })
    },
  )

  it.each([
    [
      'accepted without persistence consent',
      {
        consent: { events: true },
        defaults: { consent: true, persistenceConsent: false },
        pageAccepted: true,
      },
    ],
    [
      'accepted without data',
      {
        consent: { events: true, persistence: false },
        defaults: { consent: true, persistenceConsent: false },
        pageAccepted: true,
      },
    ],
    [
      'blocked without data',
      {
        consent: false,
        defaults: { consent: false, persistenceConsent: false },
        pageAccepted: false,
      },
    ],
  ] as const)(
    'creates request handoff from trusted forwarded no-data server result while browser owns page payload: %s',
    async (_label, { consent, defaults, pageAccepted }) => {
      const { forRequest, page } = mockRequestPage({ accepted: true, data: optimizationData })
      const request = createRequest()
      const getProfile = mockProfileFetch()
      const { OptimizationRoot, createRequestHandoff } = bindNextjsAppRouterServerOptimization({
        ...sdkConfig,
        fetchOptions: { fetchMethod: getProfile },
      })

      setForwardedServerData(request.headers, {
        consent,
        pageAccepted,
      })

      const handoff = await createRequestHandoff({
        cache: { scope: 'private-request' },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/products' } },
        request,
        trustedRequestHandoff: true,
      })
      const element = await OptimizationRoot({ children: 'Server content', handoff })

      expect(forRequest).not.toHaveBeenCalled()
      expect(page).not.toHaveBeenCalled()
      expect(getProfile).not.toHaveBeenCalled()
      expect(handoff.initialPageEvent).toBe(pageAccepted ? 'skip' : 'emit')
      expect(handoff.cache).toEqual({ scope: 'private-request' })
      expect(handoff.state).toBeUndefined()
      expect(element.props).toMatchObject({ defaults })
    },
  )

  it('ignores raw forwarded server data without trusted opt-in', async () => {
    const { forRequest, page } = mockRequestPage({ accepted: true, data: optimizationData })
    const request = createRequest()
    const { createRequestHandoff } = bindNextjsAppRouterServerOptimization({
      ...sdkConfig,
      consent: { server: true },
    })

    request.headers.set(
      NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER,
      serializeNextjsOptimizationRequestContext({
        consent: false,
        pageAccepted: false,
        profileId: 'a19c3f54d2b84e37a93f6d1c0e5b7284',
      }),
    )

    const handoff = await createRequestHandoff({
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      pagePayload: { properties: { route: '/products' } },
      request,
    })

    expect(forRequest).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledTimes(1)
    expect(handoff.initialPageEvent).toBe('skip')
  })

  it('ignores forwarded server data without a pageAccepted signal', async () => {
    const { forRequest, page } = mockRequestPage({ accepted: true, data: optimizationData })
    const request = createRequest()
    const { createRequestHandoff } = bindNextjsAppRouterServerOptimization({
      ...sdkConfig,
      consent: { server: true },
    })

    setForwardedServerData(request.headers, {
      consent: false,
      pageAccepted: undefined,
      profileId: 'f0837d7dc6344c36a3a0a06c4cde754b',
    })

    const handoff = await createRequestHandoff({
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      pagePayload: { properties: { route: '/products' } },
      request,
      trustedRequestHandoff: true,
    })

    expect(forRequest).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledTimes(1)
    expect(handoff.initialPageEvent).toBe('skip')
  })

  it('rejects public request handoff cache metadata before request evaluation', async () => {
    const { forRequest, page } = mockRequestPage({ accepted: true, data: optimizationData })
    const { createRequestHandoff } = bindNextjsAppRouterServerOptimization(sdkConfig)

    await expect(
      createRequestHandoff({
        // @ts-expect-error -- testing runtime validation for invalid request cache scope.
        cache: { scope: 'public-permutation', key: 'segment-a' },
        hydration: 'preserve-server',
        pagePayload: { properties: { route: '/products' } },
        request: createRequest(),
      }),
    ).rejects.toThrow(
      'Request handoffs must use private-request cache scope. Use public permutation handoffs for public cache scopes, or a non-request handoff for static output.',
    )
    expect(forRequest).not.toHaveBeenCalled()
    expect(page).not.toHaveBeenCalled()
  })

  it('creates analytics-only public permutation handoffs without mounting content personalization', () => {
    const { OptimizationAnalyticsRoot } = bindNextjsAppRouterServerOptimization(sdkConfig)
    const handoff = createStandalonePublicPermutationHandoff({
      hydration: 'analytics-only',
      initialPageEvent: 'emit',
      permutationKey: 'segment-a',
      selectedOptimizations: [],
    })

    expect(handoff.cache.key).toContain('permutation=segment-a:')
    expect(handoff.cache.tags).toBeUndefined()

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

  it('preserves caller-owned public permutation tags', () => {
    const handoff = createStandalonePublicPermutationHandoff({
      hydration: 'analytics-only',
      initialPageEvent: 'emit',
      permutationKey: 'segment-a',
      selectedOptimizations: [],
      tags: ['segment-a', 'products'],
    })

    expect(handoff.cache.tags).toEqual(['segment-a', 'products'])
  })

  it('rejects invalid public permutation tags in generic handoff metadata', () => {
    expect(() =>
      createStandaloneHandoffFromSelections({
        cache: { key: 'segment-a', scope: 'public-permutation', tags: ['segment,a'] },
        hydration: 'analytics-only',
        initialPageEvent: 'emit',
        selectedOptimizations: [],
      }),
    ).toThrow(TypeError)
  })

  it.each([
    ['too many tags', Array.from({ length: 129 }, (_, index) => `tag-${index}`)],
    ['empty tag', ['']],
    ['whitespace tag', ['  ']],
    ['long tag', ['a'.repeat(257)]],
    ['comma tag', ['segment,a']],
  ] as const)('rejects public permutation handoff %s', (_label, tags) => {
    expect(() =>
      createStandalonePublicPermutationHandoff({
        hydration: 'analytics-only',
        initialPageEvent: 'emit',
        permutationKey: 'segment-a',
        selectedOptimizations: [],
        tags,
      }),
    ).toThrow(TypeError)
  })

  it('clears prior content handoff state when an analytics-only handoff is mounted', async () => {
    const { OptimizedEntry, OptimizationAnalyticsRoot, createHandoffFromSelections } =
      bindNextjsAppRouterServerOptimization(sdkConfig)

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

  it('renders baseline entry content with server tracking attributes', async () => {
    const { OptimizedEntry } = bindNextjsAppRouterServerOptimization(sdkConfig)

    const html = await renderToHtml(
      await OptimizedEntry({
        baselineEntry,
        children: (entry) => entry.sys.id,
        'data-testid': 'entry',
        trackViews: true,
      }),
    )

    expect(html).toContain('data-ctfl-baseline-id="4ib0hsHWoSOnCVdDkizE8d"')
    expect(html).toContain('data-ctfl-entry-id="4ib0hsHWoSOnCVdDkizE8d"')
    expect(html).toContain('data-ctfl-track-views="true"')
    expect(html).toContain('data-testid="entry"')
    expect(html).toContain('4ib0hsHWoSOnCVdDkizE8d')
  })

  it('keeps the server host without invoking the render prop for an empty variant', async () => {
    const { OptimizedEntry, createHandoffFromSelections } =
      bindNextjsAppRouterServerOptimization(sdkConfig)
    const renderEntry = rs.fn(() => 'Rendered content')

    createHandoffFromSelections({
      cache: { scope: 'public-permutation', key: 'empty-variant' },
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations: emptyVariantSelectedOptimizations,
    })
    const html = await renderToHtml(
      await OptimizedEntry({ baselineEntry: emptyVariantOptimizedEntry, children: renderEntry }),
    )

    expect(renderEntry).not.toHaveBeenCalled()
    expect(html).toContain(`data-ctfl-baseline-id="${baselineEntry.sys.id}"`)
    expect(html).toContain('data-ctfl-empty-variant="true"')
    expect(html).toContain('data-ctfl-optimization-id="6IueRX1pS3iMJncbhUQTba"')
    expect(html).not.toContain('Rendered content')
  })

  it('passes explicit merge-tag profile helpers to server render props', async () => {
    const mergeTagEntry = createMergeTagEntry('merge-tag', 'traits.continent')
    const { OptimizedEntry } = bindNextjsAppRouterServerOptimization(sdkConfig)

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
      bindNextjsAppRouterServerOptimization(sdkConfig)

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
    expect(html).toContain('data-ctfl-optimization-id="6IueRX1pS3iMJncbhUQTba"')
    expect(html).toContain('data-ctfl-variant-index="1"')
    expect(html).toContain(variantEntry.sys.id)
  })

  it('defaults server merge-tag helpers to the request handoff profile', async () => {
    mockRequestPage({ accepted: true, data: optimizationData })
    const mergeTagEntry = createMergeTagEntry('merge-tag', 'traits.continent')
    const { OptimizationRoot, OptimizedEntry, createRequestHandoff } =
      bindNextjsAppRouterServerOptimization(sdkConfig)

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

  it('resolves server OptimizedEntry from public permutation handoff selections', async () => {
    const { OptimizationRoot, OptimizedEntry, createHandoffFromSelections } =
      bindNextjsAppRouterServerOptimization(sdkConfig)

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

  it('snapshots top-level handoff state before managed entry loading', async () => {
    const cdaStarted = Promise.withResolvers<undefined>()
    const cdaRelease = Promise.withResolvers<ServerTrackingBaselineEntry>()
    const getEntry = rs.fn(async () => {
      cdaStarted.resolve(undefined)
      return await cdaRelease.promise
    })
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const { OptimizedEntry, createHandoffFromSelections } = bindNextjsAppRouterServerOptimization({
      ...sdkConfig,
      contentful: { cache: false, client: { getEntry, getEntries } },
    })

    const entryPromise = OptimizedEntry({
      children: (entry) => entry.sys.id,
      entryId: optimizedEntry.sys.id,
    })
    await cdaStarted.promise
    createHandoffFromSelections({
      cache: { scope: 'public-permutation', key: 'segment-a' },
      hydration: 'preserve-server',
      initialPageEvent: 'emit',
      selectedOptimizations,
    })
    cdaRelease.resolve(optimizedEntry)

    const html = await renderToHtml(await entryPromise)

    expect(getEntry).toHaveBeenCalledTimes(1)
    expect(html).toContain(`data-ctfl-entry-id="${baselineEntry.sys.id}"`)
    expect(html).not.toContain(`data-ctfl-entry-id="${variantEntry.sys.id}"`)
  })

  it('uses request handoff selections when resolving managed server entries', async () => {
    mockRequestPage({ accepted: true, data: optimizationData })
    const getEntry = rs.fn(async () => await Promise.resolve(optimizedEntry))
    const getEntries = rs.fn(async () => await Promise.resolve(createEntryCollection([])))
    const { OptimizationRoot, OptimizedEntry, createRequestHandoff } =
      bindNextjsAppRouterServerOptimization({
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

  it('resolves slug-managed server entries with request selections and tracking IDs', async () => {
    mockRequestPage({ accepted: true, data: optimizationData })
    const getEntry = rs.fn(async () => await Promise.resolve(createEntry('unused')))
    const getEntries = rs.fn(
      async () => await Promise.resolve(createEntryCollection([optimizedEntry])),
    )
    const { OptimizationRoot, OptimizedEntry, createRequestHandoff } =
      bindNextjsAppRouterServerOptimization({
        ...sdkConfig,
        contentful: { cache: false, client: { getEntry, getEntries } },
      })

    const handoff = await createRequestHandoff({
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      pagePayload: { properties: { route: '/products' } },
      request: createRequest(),
    })
    const element = await OptimizationRoot({
      children: await OptimizedEntry({
        children: (entry) => entry.sys.id,
        managedEntry: {
          contentType: 'page',
          entryQuery: { locale: 'de-DE' },
          slug: '/products',
          slugField: 'path',
        },
      }),
      handoff,
    })
    const html = await renderToHtml(element)

    expect(getEntry).not.toHaveBeenCalled()
    expect(getEntries).toHaveBeenCalledWith({
      content_type: 'page',
      'fields.path': '/products',
      include: 10,
      limit: 2,
      locale: 'de-DE',
    })
    expect(html).toContain(`data-ctfl-baseline-id="${baselineEntry.sys.id}"`)
    expect(html).toContain(`data-ctfl-entry-id="${variantEntry.sys.id}"`)
    expect(html).toContain('data-ctfl-optimization-id="6IueRX1pS3iMJncbhUQTba"')
    expect(html).toContain('data-ctfl-variant-index="1"')
    expect(html).toContain(variantEntry.sys.id)
  })

  it('rejects ambiguous managed server entry sources when runtime props bypass types', async () => {
    const { OptimizedEntry } = bindNextjsAppRouterServerOptimization(sdkConfig)

    await expect(
      // @ts-expect-error Exercise runtime validation for mutually exclusive managed sources.
      OptimizedEntry({
        children: () => baselineEntry.sys.id,
        entryId: baselineEntry.sys.id,
        managedEntry: { contentType: 'page', slug: '/products' },
      }),
    ).rejects.toThrow(
      'Bound Next.js OptimizedEntry requires exactly one source: baselineEntry, entryId, or managedEntry.',
    )
  })

  it('makes request handoff consent and selections available during server render', async () => {
    mockRequestPage({ accepted: true, data: optimizationData })
    const { OptimizationRoot, createRequestHandoff } = bindNextjsAppRouterServerOptimization({
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
      bindNextjsAppRouterServerOptimization(sdkConfig)
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
