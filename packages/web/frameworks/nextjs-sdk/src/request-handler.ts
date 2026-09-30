import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import {
  applyForwardedRequestHeaders,
  clearForwardedRequestHeaders,
  createForwardedRequestHeaders as createBaseForwardedRequestHeaders,
  NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS,
} from './forwarded-request-headers'
import {
  NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX,
  NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER,
} from './request-context'
import type {
  ContentfulOptimization,
  CoreStatelessRequestConsent,
  NextjsAnonymousIdCookieOptions,
  NextjsOptimizationServerConsentResolver,
  PersistNextjsAnonymousIdOptions,
} from './server'

export type MaybePromise<T> = T | Promise<T>

export type NextjsOptimizationRequestHandler = (
  request: NextRequest,
  responseOrEvent?: NextResponse | NextFetchEvent,
) => MaybePromise<NextResponse>

const NEXTJS_MIDDLEWARE_NEXT_HEADER = 'x-middleware-next'
const NEXTJS_MIDDLEWARE_REWRITE_HEADER = 'x-middleware-rewrite'
const NEXTJS_MIDDLEWARE_REDIRECT_HEADER = 'location'
const REDIRECT_STATUS_MIN = 300
const REDIRECT_STATUS_MAX = 400

/** @deprecated Request personalization now runs in the App Router server request resource. */
export interface NextjsOptimizationContextHandlerOptions extends PersistNextjsAnonymousIdOptions {
  /** @deprecated Inert compatibility input. */
  readonly consent?: CoreStatelessRequestConsent | NextjsOptimizationServerConsentResolver
  /** @deprecated Inert compatibility input. */
  readonly cookieOptions?: NextjsAnonymousIdCookieOptions
  /** @deprecated Inert compatibility input. */
  readonly locale?: string
  /** @deprecated Inert compatibility input. */
  readonly sdk?: ContentfulOptimization
}

/** Forward trusted, sanitized Next request context without SDK work. */
export function createNextjsOptimizationContextHandler(
  _options?: NextjsOptimizationContextHandlerOptions,
): NextjsOptimizationRequestHandler {
  return (request, responseOrEvent) => {
    const response = getExistingNextResponse(responseOrEvent)
    if (response && hasExistingTerminalMiddlewareTarget(response)) return response

    const requestHeaders = createSanitizedForwardedRequestHeaders(request, response)
    if (response === undefined) return NextResponse.next({ request: { headers: requestHeaders } })

    clearForwardedRequestHeaders(response)
    applyForwardedRequestHeaders(response, requestHeaders)
    return response
  }
}

function getExistingNextResponse(
  responseOrEvent: NextResponse | NextFetchEvent | undefined,
): NextResponse | undefined {
  return responseOrEvent instanceof Response ? responseOrEvent : undefined
}

function hasExistingTerminalMiddlewareTarget(response: NextResponse): boolean {
  const { headers } = response
  return (
    (response.status >= REDIRECT_STATUS_MIN &&
      response.status < REDIRECT_STATUS_MAX &&
      headers.has(NEXTJS_MIDDLEWARE_REDIRECT_HEADER)) ||
    (!headers.has(NEXTJS_MIDDLEWARE_NEXT_HEADER) &&
      !headers.has(NEXTJS_MIDDLEWARE_REWRITE_HEADER) &&
      !headers.has(NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS))
  )
}

function createSanitizedForwardedRequestHeaders(
  request: NextRequest,
  response?: NextResponse,
): Headers {
  const requestHeaders = createBaseForwardedRequestHeaders(request.headers, response)
  for (const name of Array.from(requestHeaders.keys())) {
    if (name.toLowerCase().startsWith(NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX)) {
      requestHeaders.delete(name)
    }
  }
  requestHeaders.set(NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER, request.url)
  return requestHeaders
}
