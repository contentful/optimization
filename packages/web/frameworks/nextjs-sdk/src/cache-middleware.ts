import type { PublicPermutationOptimizationCacheMetadata } from '@contentful/optimization-react-web/core-sdk'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { validateNextjsPublicPermutationCacheTags } from './cache-tags'
import {
  applyForwardedRequestHeaders,
  createForwardedRequestHeaders,
  NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS,
} from './forwarded-request-headers'

export type MaybePromise<T> = T | Promise<T>

const DEFAULT_CACHE_KEY_SEARCH_PARAM = 'ctfl-opt-cache-key'
const NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX = 'x-ctfl-opt-'
const NEXTJS_MIDDLEWARE_NEXT_HEADER = 'x-middleware-next'
const NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX = 'x-middleware-request-'
const NEXTJS_MIDDLEWARE_REWRITE_HEADER = 'x-middleware-rewrite'
const NEXTJS_MIDDLEWARE_REDIRECT_HEADER = 'location'
const REDIRECT_STATUS_MIN = 300
const REDIRECT_STATUS_MAX = 400

export type NextjsPublicPermutationCacheMetadata = PublicPermutationOptimizationCacheMetadata

export interface NextjsPublicPermutationCacheRewriteContext {
  readonly cache: NextjsPublicPermutationCacheMetadata
  readonly encodedCacheKey: string
  readonly pathname: string
  readonly request: NextRequest
}

export interface NextjsPublicPermutationCacheMiddlewareOptions {
  readonly resolveCache: (
    request: NextRequest,
  ) => MaybePromise<NextjsPublicPermutationCacheMetadata | undefined>
  readonly rewrite?: (context: NextjsPublicPermutationCacheRewriteContext) => string | URL
  readonly cacheKeySearchParam?: string
}

export type NextjsPublicPermutationCacheMiddleware = (
  request: NextRequest,
  responseOrEvent?: NextResponse | NextFetchEvent,
) => MaybePromise<NextResponse>

export function createNextjsPublicPermutationCacheMiddleware(
  options: NextjsPublicPermutationCacheMiddlewareOptions,
): NextjsPublicPermutationCacheMiddleware {
  return async (request, responseOrEvent) => {
    const response = getExistingNextResponse(responseOrEvent)

    if (response && hasExistingTerminalMiddlewareTarget(response)) {
      return response
    }

    const cache = await options.resolveCache(request)

    if (cache === undefined) {
      return response ?? NextResponse.next()
    }

    assertPublicPermutationCacheMetadata(cache)

    const rewriteUrl = new URL(resolveRewrite(options, cache, request), request.url)
    const forwardedRequestHeaders = createForwardedRequestHeaders(request.headers, response)
    for (const name of Array.from(forwardedRequestHeaders.keys())) {
      if (!name.startsWith(NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX)) continue

      forwardedRequestHeaders.delete(name)
      response?.headers.delete(`${NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX}${name}`)
    }

    if (!response) {
      return NextResponse.rewrite(rewriteUrl, {
        request: { headers: forwardedRequestHeaders },
      })
    }

    response.headers.set(NEXTJS_MIDDLEWARE_REWRITE_HEADER, rewriteUrl.toString())
    applyForwardedRequestHeaders(response, forwardedRequestHeaders)
    return response
  }
}

function resolveRewrite(
  options: NextjsPublicPermutationCacheMiddlewareOptions,
  cache: NextjsPublicPermutationCacheMetadata,
  request: NextRequest,
): string | URL {
  if (options.rewrite !== undefined) {
    return options.rewrite({
      cache,
      encodedCacheKey: encodeURIComponent(cache.key),
      pathname: request.nextUrl.pathname,
      request,
    })
  }

  const url = new URL(request.url)
  url.searchParams.set(options.cacheKeySearchParam ?? DEFAULT_CACHE_KEY_SEARCH_PARAM, cache.key)
  return url
}

function assertPublicPermutationCacheMetadata(
  cache: unknown,
): asserts cache is NextjsPublicPermutationCacheMetadata {
  if (!isObjectRecord(cache) || cache.scope !== 'public-permutation') {
    throw new TypeError(
      'Next.js public permutation cache middleware requires cache.scope to be "public-permutation".',
    )
  }

  if (typeof cache.key !== 'string' || cache.key.trim() === '') {
    throw new TypeError(
      'Next.js public permutation cache middleware requires cache.key to be a non-empty string.',
    )
  }

  validateNextjsPublicPermutationCacheTags(cache.tags)
}

function getExistingNextResponse(
  responseOrEvent: NextResponse | NextFetchEvent | undefined,
): NextResponse | undefined {
  return responseOrEvent instanceof Response ? responseOrEvent : undefined
}

function hasExistingTerminalMiddlewareTarget(response: NextResponse): boolean {
  const { headers } = response

  return (
    headers.has(NEXTJS_MIDDLEWARE_REWRITE_HEADER) ||
    (response.status >= REDIRECT_STATUS_MIN &&
      response.status < REDIRECT_STATUS_MAX &&
      headers.has(NEXTJS_MIDDLEWARE_REDIRECT_HEADER)) ||
    (!headers.has(NEXTJS_MIDDLEWARE_NEXT_HEADER) &&
      !headers.has(NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS))
  )
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
