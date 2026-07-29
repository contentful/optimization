import { NextRequest, NextResponse } from 'next/server'
import {
  createNextjsPublicPermutationCacheMiddleware,
  type NextjsPublicPermutationCacheMetadata,
  type NextjsPublicPermutationCacheRewriteContext,
} from './cache-middleware'

const readableCacheKey = 'permutation=segment:a;b=c,d'
const encodedReadableCacheKey = 'permutation%3Dsegment%3Aa%3Bb%3Dc%2Cd'

void afterEach(() => {
  rs.restoreAllMocks()
})

function createCache(key = readableCacheKey): NextjsPublicPermutationCacheMetadata {
  return { key, scope: 'public-permutation' }
}

function createResponseWithRequestOverrides(request: NextRequest): NextResponse {
  const existingRequestHeaders = new Headers(request.headers)
  existingRequestHeaders.set('x-existing-request-handler', 'preserved')
  existingRequestHeaders.set('x-ctfl-opt-extra', 'stale-sdk-context')
  const response = NextResponse.next({ request: { headers: existingRequestHeaders } })

  response.headers.set('x-existing-handler', 'preserved')
  response.headers.set(
    'x-middleware-override-headers',
    Array.from(existingRequestHeaders.keys()).join(','),
  )

  for (const [name, value] of existingRequestHeaders) {
    response.headers.set(`x-middleware-request-${name}`, value)
  }

  return response
}

describe('createNextjsPublicPermutationCacheMiddleware', () => {
  it.each([
    ['default cache key search param', undefined, 'ctfl-opt-cache-key'],
    ['custom cache key search param', 'cacheKey', 'cacheKey'],
  ] as const)('rewrites with the %s', async (_label, cacheKeySearchParam, searchParam) => {
    const rewriteSpy = rs.spyOn(NextResponse, 'rewrite')
    const middleware = createNextjsPublicPermutationCacheMiddleware({
      resolveCache: () => createCache(),
      ...(cacheKeySearchParam === undefined ? {} : { cacheKeySearchParam }),
    })

    const response = await middleware(new NextRequest('https://example.test/products?tab=featured'))

    expect(response).toBeInstanceOf(Response)
    expect(rewriteSpy.mock.calls[0]?.[0].toString()).toBe(
      `https://example.test/products?tab=featured&${searchParam}=${encodedReadableCacheKey}`,
    )
  })

  it('passes encodedCacheKey to custom rewrites for path-style routing', async () => {
    const rewriteResponseSpy = rs.spyOn(NextResponse, 'rewrite')
    const cache = createCache()
    const request = new NextRequest('https://example.test/products')
    const rewrite = rs.fn((context: NextjsPublicPermutationCacheRewriteContext) => {
      const { encodedCacheKey, pathname } = context
      return `/__ctfl-opt/${encodedCacheKey}${pathname}`
    })
    const middleware = createNextjsPublicPermutationCacheMiddleware({
      resolveCache: () => cache,
      rewrite,
    })

    const response = await middleware(request)

    expect(rewrite).toHaveBeenCalledWith({
      cache,
      encodedCacheKey: encodedReadableCacheKey,
      pathname: '/products',
      request,
    })
    expect(response).toBeInstanceOf(Response)
    expect(rewriteResponseSpy.mock.calls[0]?.[0].toString()).toBe(
      `https://example.test/__ctfl-opt/${encodedReadableCacheKey}/products`,
    )
  })

  it.each([
    ['non-public scope', { key: 'segment-a', scope: 'static' }],
    ['missing key', { scope: 'public-permutation' }],
    ['empty key', { key: '', scope: 'public-permutation' }],
    ['whitespace key', { key: '  ', scope: 'public-permutation' }],
    ['non-array tags', { key: 'segment-a', scope: 'public-permutation', tags: 'segment-a' }],
    [
      'too many tags',
      {
        key: 'segment-a',
        scope: 'public-permutation',
        tags: Array.from({ length: 129 }, (_, index) => `tag-${index}`),
      },
    ],
    ['empty tag', { key: 'segment-a', scope: 'public-permutation', tags: [''] }],
    ['whitespace tag', { key: 'segment-a', scope: 'public-permutation', tags: ['  '] }],
    ['long tag', { key: 'segment-a', scope: 'public-permutation', tags: ['a'.repeat(257)] }],
    ['comma tag', { key: 'segment-a', scope: 'public-permutation', tags: ['segment,a'] }],
  ] as const)('throws for %s metadata', async (_label, cache) => {
    const middleware = createNextjsPublicPermutationCacheMiddleware({
      // @ts-expect-error -- testing runtime validation for invalid middleware metadata.
      resolveCache: () => cache,
    })

    await expect(middleware(new NextRequest('https://example.test/products'))).rejects.toThrow(
      TypeError,
    )
  })

  it('allows long readable cache keys with commas as key metadata', async () => {
    const rewriteSpy = rs.spyOn(NextResponse, 'rewrite')
    const key = `permutation=${'segment-a'.repeat(40)}:a;b=c,d`
    const middleware = createNextjsPublicPermutationCacheMiddleware({
      resolveCache: () => createCache(key),
    })

    await middleware(new NextRequest('https://example.test/products'))

    const rewriteUrl = new URL(rewriteSpy.mock.calls[0]?.[0].toString() ?? '')
    expect(key.length).toBeGreaterThan(256)
    expect(rewriteUrl.searchParams.get('ctfl-opt-cache-key')).toBe(key)
  })

  it('returns the existing response or NextResponse.next when no cache is resolved', async () => {
    const middleware = createNextjsPublicPermutationCacheMiddleware({
      resolveCache: () => undefined,
    })
    const request = new NextRequest('https://example.test/products')
    const existingResponse = NextResponse.next()
    existingResponse.headers.set('x-existing-handler', 'preserved')

    const returnedExistingResponse = await middleware(request, existingResponse)
    const newResponse = await middleware(request)

    expect(returnedExistingResponse).toBe(existingResponse)
    expect(returnedExistingResponse.headers.get('x-existing-handler')).toBe('preserved')
    expect(newResponse).toBeInstanceOf(Response)
    expect(newResponse.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it.each(['rewrite', 'redirect'] as const)(
    'preserves an existing %s response without resolving cache metadata',
    async (terminalResponseKind) => {
      const request = new NextRequest('https://example.test/products')
      const terminalResponse =
        terminalResponseKind === 'rewrite'
          ? NextResponse.next()
          : new NextResponse(null, {
              headers: { location: 'https://example.test/login' },
              status: 307,
            })

      if (terminalResponseKind === 'rewrite') {
        terminalResponse.headers.set(
          'x-middleware-rewrite',
          'https://example.test/already-rewritten',
        )
      }

      const resolveCache = rs.fn(() => createCache('segment-a'))
      const middleware = createNextjsPublicPermutationCacheMiddleware({ resolveCache })

      const response = await middleware(request, terminalResponse)

      expect(response).toBe(terminalResponse)
      expect(resolveCache).not.toHaveBeenCalled()
    },
  )

  it('preserves an existing JSON response without resolving cache metadata or mutating request headers', async () => {
    const request = new NextRequest('https://example.test/products', {
      headers: { 'x-ctfl-opt-extra': 'stale-sdk-context' },
    })
    const terminalResponse = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const resolveCache = rs.fn(() => createCache('segment-a'))
    const middleware = createNextjsPublicPermutationCacheMiddleware({ resolveCache })

    const response = await middleware(request, terminalResponse)

    expect(response).toBe(terminalResponse)
    expect(resolveCache).not.toHaveBeenCalled()
    expect(response.headers.get('x-middleware-override-headers')).toBeNull()
    expect(response.headers.get('x-middleware-request-x-ctfl-opt-extra')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('preserves existing middleware request-header overrides when rewriting', async () => {
    const request = new NextRequest('https://example.test/products')
    const existingResponse = createResponseWithRequestOverrides(request)
    const middleware = createNextjsPublicPermutationCacheMiddleware({
      resolveCache: () => createCache('segment-a'),
      rewrite: ({ cache, pathname }) => `/__ctfl-opt/${cache.key}${pathname}`,
    })

    const response = await middleware(request, existingResponse)
    const overrideHeaders = response.headers.get('x-middleware-override-headers')?.split(',')

    expect(response).toBe(existingResponse)
    expect(response.headers.get('x-existing-handler')).toBe('preserved')
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.test/__ctfl-opt/segment-a/products',
    )
    expect(overrideHeaders).toContain('x-existing-request-handler')
    expect(overrideHeaders).not.toContain('x-ctfl-opt-extra')
    expect(response.headers.get('x-middleware-request-x-existing-request-handler')).toBe(
      'preserved',
    )
    expect(response.headers.get('x-middleware-request-x-ctfl-opt-extra')).toBeNull()
  })
})
