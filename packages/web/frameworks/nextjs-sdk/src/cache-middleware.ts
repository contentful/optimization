import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import {
  applyForwardedRequestHeaders,
  createForwardedRequestHeaders,
} from './forwarded-request-headers'

export type MaybePromise<T> = T | Promise<T>

const NEXTJS_MIDDLEWARE_REWRITE_HEADER = 'x-middleware-rewrite'
const NEXTJS_MIDDLEWARE_REDIRECT_HEADER = 'location'
const REDIRECT_STATUS_MIN = 300
const REDIRECT_STATUS_MAX = 400

export interface NextjsCacheMiddlewareRewriteContext {
  readonly cacheKey: string
  readonly pathname: string
  readonly request: NextRequest
}

export interface NextjsCacheMiddlewareOptions {
  readonly resolveCacheKey: (request: NextRequest) => MaybePromise<string | undefined>
  readonly rewrite: (context: NextjsCacheMiddlewareRewriteContext) => string | URL
}

export type NextjsCacheMiddleware = (
  request: NextRequest,
  responseOrEvent?: NextResponse | NextFetchEvent,
) => MaybePromise<NextResponse>

export function createNextjsCacheMiddleware(
  options: NextjsCacheMiddlewareOptions,
): NextjsCacheMiddleware {
  return async (request, responseOrEvent) => {
    const response = getExistingNextResponse(responseOrEvent)
    const cacheKey = await options.resolveCacheKey(request)

    if (cacheKey === undefined || hasExistingTerminalMiddlewareTarget(response)) {
      return response ?? NextResponse.next()
    }

    const rewriteUrl = new URL(
      options.rewrite({
        cacheKey,
        pathname: request.nextUrl.pathname,
        request,
      }),
      request.url,
    )
    const forwardedRequestHeaders = createForwardedRequestHeaders(request.headers, response)

    if (response === undefined) {
      return NextResponse.rewrite(rewriteUrl, {
        request: { headers: forwardedRequestHeaders },
      })
    }

    response.headers.set(NEXTJS_MIDDLEWARE_REWRITE_HEADER, rewriteUrl.toString())
    applyForwardedRequestHeaders(response, forwardedRequestHeaders)
    return response
  }
}

function getExistingNextResponse(
  responseOrEvent: NextResponse | NextFetchEvent | undefined,
): NextResponse | undefined {
  return responseOrEvent instanceof Response ? responseOrEvent : undefined
}

function hasExistingTerminalMiddlewareTarget(response: NextResponse | undefined): boolean {
  if (response === undefined) return false

  return (
    response.headers.has(NEXTJS_MIDDLEWARE_REWRITE_HEADER) ||
    (response.status >= REDIRECT_STATUS_MIN &&
      response.status < REDIRECT_STATUS_MAX &&
      response.headers.has(NEXTJS_MIDDLEWARE_REDIRECT_HEADER))
  )
}
