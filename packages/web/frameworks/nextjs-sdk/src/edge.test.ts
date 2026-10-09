/** @rstest-environment node */
import type { ExperienceApiClient } from '@contentful/optimization-react-web/api-client'
import { CoreStateless, type OptimizationData } from '@contentful/optimization-react-web/core-sdk'
import { NextRequest } from 'next/server'
import * as edgeExports from './edge'

const { configureNextjsEdgeOptimization } = edgeExports

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

function mockEdgeRequestPreview(): {
  readonly forRequest: ReturnType<typeof rs.spyOn>
  readonly preview: ReturnType<typeof rs.fn<ExperienceApiClient['upsertProfile']>>
  readonly runtimes: CoreStateless[]
} {
  const originalForRequest = CoreStateless.prototype.forRequest
  const preview = rs.fn<ExperienceApiClient['upsertProfile']>(
    async () => await Promise.resolve(OPTIMIZATION_DATA),
  )
  const forRequest = rs.spyOn(CoreStateless.prototype, 'forRequest')
  const runtimes: CoreStateless[] = []
  forRequest.mockImplementation(function mockForRequest(this: CoreStateless, options) {
    runtimes.push(this)
    rs.spyOn(this.api.experience, 'upsertProfile').mockImplementation(preview)
    return originalForRequest.call(this, options)
  })
  return { forRequest, preview, runtimes }
}

describe('Next.js Edge runtime helpers', () => {
  it('exports Edge configuration and public permutation helpers', () => {
    expect(edgeExports.configureNextjsEdgeOptimization).toBeTypeOf('function')
    expect(edgeExports.createPublicPermutationHandoff).toBeTypeOf('function')
    expect(edgeExports.createPublicPermutationCacheMetadata).toBeTypeOf('function')
  })

  it('uses the build-time package version for Edge event library metadata', async () => {
    const { runtimes } = mockEdgeRequestPreview()
    const { createEdgeRequestHandoff } = configureNextjsEdgeOptimization(SDK_CONFIG)

    await createEdgeRequestHandoff({
      hydration: 'preserve-server',
      pagePayload: {},
      request: new Request('https://example.com/products'),
    })

    expect(runtimes[0]?.eventBuilder.library).toEqual({
      name: '@contentful/optimization-nextjs',
      version: '9.8.7',
    })
  })

  it('builds request handoff from a Web Request, reads cookies, and persists a Response cookie', async () => {
    const { forRequest, preview } = mockEdgeRequestPreview()
    const { createEdgeRequestHandoff } = configureNextjsEdgeOptimization({
      ...SDK_CONFIG,
      consent: { server: { events: true, persistence: true } },
      locale: 'en-US',
    })
    const request = new Request('https://example.com/products?tab=featured', {
      headers: {
        'user-agent': 'test-agent',
      },
    })
    request.headers.set('cookie', 'ctfl-opt-aid=f0837d7dc6344c36a3a0a06c4cde754b')

    const result = await createEdgeRequestHandoff({
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      pagePayload: { properties: { route: '/products' } },
      request,
    })

    expect(result.handoff.replay?.routeKey).toBe('/products?tab=featured')
    expect(result.handoff.state?.profile?.id).toBe('f0837d7dc6344c36a3a0a06c4cde754b')
    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            type: 'page',
            properties: expect.objectContaining({ route: '/products' }),
          }),
        ],
      }),
      expect.objectContaining({ preflight: true, locale: 'en-US' }),
    )
    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: { events: true, persistence: true },
        eventContext: expect.objectContaining({
          locale: 'en-US',
          page: {
            path: '/products',
            query: { tab: 'featured' },
            referrer: '',
            search: '?tab=featured',
            url: 'https://example.com/products?tab=featured',
          },
          userAgent: 'test-agent',
        }),
        locale: 'en-US',
        profile: { id: 'f0837d7dc6344c36a3a0a06c4cde754b' },
      }),
    )

    const response = new Response('<html></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
    result.persist(response)

    expect(response.headers.get('set-cookie')).toContain(
      'ctfl-opt-aid=f0837d7dc6344c36a3a0a06c4cde754b',
    )
    expect(response.headers.get('set-cookie')).toContain('Path=/')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax')
  })

  it('retains a replay and configured browser-readable cookie during preview failure', async () => {
    const { preview } = mockEdgeRequestPreview()
    preview.mockRejectedValue(new Error('Preview unavailable'))
    const { createEdgeRequestHandoff } = configureNextjsEdgeOptimization({
      ...SDK_CONFIG,
      consent: { server: true },
      cookie: {
        domain: 'example.com',
        path: '/products',
        expires: 1,
        secure: true,
        sameSite: 'strict',
      },
    })
    const result = await createEdgeRequestHandoff({
      hydration: 'analytics-only',
      request: new Request('https://example.com/products', {
        headers: { cookie: 'ctfl-opt-aid=known-api-id' },
      }),
    })
    const response = new Response('Server rendered content', {
      headers: { 'set-cookie': 'app-cookie=1; Path=/' },
    })
    result.persist(response)
    expect(result.data).toBeUndefined()
    expect(result.handoff).toMatchObject({
      profileId: 'known-api-id',
      replay: { routeKey: '/products', events: [expect.objectContaining({ type: 'page' })] },
    })
    expect(response.headers.get('set-cookie')).toContain('app-cookie=1')
    expect(response.headers.get('set-cookie')).toContain(
      'ctfl-opt-aid=known-api-id; Max-Age=86400; Domain=example.com; Path=/products; Secure; SameSite=Strict',
    )
    expect(response.headers.get('set-cookie')).not.toContain('HttpOnly')
  })

  it('reads anonymous ID from framework cookie snapshots', async () => {
    const { forRequest } = mockEdgeRequestPreview()
    const { createEdgeRequestHandoff } = configureNextjsEdgeOptimization({
      ...SDK_CONFIG,
      consent: { server: true },
    })
    const request = new NextRequest('https://example.com/products', {
      headers: {
        'user-agent': 'test-agent',
      },
    })
    request.cookies.set('ctfl-opt-aid', 'a19c3f54d2b84e37a93f6d1c0e5b7284')

    await createEdgeRequestHandoff({
      hydration: 'preserve-server',
      pagePayload: {},
      request,
    })

    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({ profile: { id: 'a19c3f54d2b84e37a93f6d1c0e5b7284' } }),
    )
  })

  it.each([{ key: 'segment-a', scope: 'public-permutation' }, { scope: 'static' }] as const)(
    'rejects $scope request handoff cache metadata before request evaluation',
    async (cache) => {
      const { forRequest, preview } = mockEdgeRequestPreview()
      const { createEdgeRequestHandoff } = configureNextjsEdgeOptimization({
        ...SDK_CONFIG,
        consent: { server: true },
      })

      await expect(
        createEdgeRequestHandoff({
          // @ts-expect-error -- testing runtime validation for invalid request cache scope.
          cache,
          hydration: 'preserve-server',
          pagePayload: {},
          request: new Request('https://example.com/products'),
        }),
      ).rejects.toThrow(
        'Request handoffs must use private-request cache scope. Use public permutation handoffs for public cache scopes, or a non-request handoff for static output.',
      )
      expect(forRequest).not.toHaveBeenCalled()
      expect(preview).not.toHaveBeenCalled()
    },
  )

  it('creates public permutation edge handoffs through the shared selection path', () => {
    const {
      createHandoffFromSelections,
      createOptimizationCacheKey,
      createPublicPermutationHandoff,
    } = configureNextjsEdgeOptimization(SDK_CONFIG)

    const handoff = createHandoffFromSelections({
      cache: { scope: 'public-permutation', key: 'segment-a' },
      hydration: 'analytics-only',
      selectedOptimizations: [],
    })
    const permutationHandoff = createPublicPermutationHandoff({
      cacheVersion: 'version 1',
      entryIds: ['4ib0hsHWoSOnCVdDkizE8d'],
      hydration: 'preserve-server',
      locale: 'en-US',
      permutationKey: 'segment a',
      selectedOptimizations: [],
    })
    const key = createOptimizationCacheKey({
      entryIds: ['4ib0hsHWoSOnCVdDkizE8d'],
      locale: 'en-US',
      scope: 'public-permutation',
      selectedOptimizations: [],
    })

    expect(handoff).toEqual({
      cache: { scope: 'public-permutation', key: 'segment-a' },
      hydration: 'analytics-only',
      state: { selectedOptimizations: [] },
    })
    expect(permutationHandoff).toMatchObject({
      cache: {
        key: `permutation=segment%20a:version=version%201:${key}`,
        scope: 'public-permutation',
      },
      hydration: 'preserve-server',
      state: { selectedOptimizations: [] },
    })
    expect(permutationHandoff.cache.tags).toBeUndefined()
    expect(key).toContain('ctfl-opt-cache:v1')
  })
})
