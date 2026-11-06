import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import {
  createCookieReaderFromHeader,
  DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
  persistNextjsAnonymousId,
} from './cookies'
import {
  applyForwardedRequestHeaders,
  clearForwardedRequestHeaders,
  createForwardedRequestHeaders as createBaseForwardedRequestHeaders,
  NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS,
} from './forwarded-request-headers'
import {
  NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX,
  NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER,
  normalizeNextjsAppRequestUrl,
} from './request-context'
import type {
  ContentfulOptimization,
  CoreStatelessRequest,
  CoreStatelessRequestConsent,
  NextjsAnonymousIdCookieOptions,
  NextjsCookieReader,
  NextjsOptimizationServerConsentResolver,
  PersistNextjsAnonymousIdOptions,
} from './server'

export type MaybePromise<T> = T | Promise<T>

export type NextjsOptimizationRequestHandler = (
  request: NextRequest,
  responseOrEvent?: NextResponse | NextFetchEvent,
) => MaybePromise<NextResponse>

const EMPTY_COOKIE_READER: NextjsCookieReader = {
  get: () => undefined,
}
const NEXTJS_MIDDLEWARE_NEXT_HEADER = 'x-middleware-next'
const NEXTJS_MIDDLEWARE_REWRITE_HEADER = 'x-middleware-rewrite'
const NEXTJS_MIDDLEWARE_REDIRECT_HEADER = 'location'
const REDIRECT_STATUS_MIN = 300
const REDIRECT_STATUS_MAX = 400

export interface NextjsOptimizationContextHandlerOptions extends PersistNextjsAnonymousIdOptions {
  readonly consent: CoreStatelessRequestConsent | NextjsOptimizationServerConsentResolver
  readonly cookieOptions?: NextjsAnonymousIdCookieOptions
  readonly locale?: string
  readonly sdk: ContentfulOptimization
}

export function createNextjsOptimizationContextHandler(
  options?: NextjsOptimizationContextHandlerOptions,
): NextjsOptimizationRequestHandler {
  return async (request, responseOrEvent) => {
    const response = getExistingNextResponse(responseOrEvent)
    if (response && hasExistingTerminalMiddlewareTarget(response)) return response

    const requestHeaders = createSanitizedForwardedRequestHeaders(request, response)
    const requestOptimization =
      options === undefined
        ? undefined
        : await bindRequestIdentity(
            request,
            requestHeaders,
            hasRequestHeaderOverrides(response),
            options,
          )
    const cookieOptions =
      options === undefined
        ? undefined
        : {
            ...options,
            cookieOptions: { ...options.cookieOptions, httpOnly: false },
          }

    if (!response) {
      const nextResponse = NextResponse.next({ request: { headers: requestHeaders } })
      if (cookieOptions !== undefined && requestOptimization !== undefined) {
        persistNextjsAnonymousId(nextResponse, requestOptimization, undefined, cookieOptions)
      }
      return nextResponse
    }

    applyNextjsOptimizationRequestContext(response, requestHeaders)
    if (cookieOptions !== undefined && requestOptimization !== undefined) {
      persistNextjsAnonymousId(response, requestOptimization, undefined, cookieOptions)
    }
    return response
  }
}

async function bindRequestIdentity(
  request: NextRequest,
  headers: Headers,
  requestHeaderOverrides: boolean,
  options: NextjsOptimizationContextHandlerOptions,
): Promise<CoreStatelessRequest> {
  const cookies = createEffectiveRequestCookies(request, headers, requestHeaderOverrides)
  const consent = await resolveServerConsent(options.consent, { cookies, headers })
  const profileId = cookies.get(
    options.anonymousIdCookieName ?? DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
  )?.value
  return options.sdk.forRequest({
    consent,
    profile: profileId ? { id: profileId } : undefined,
    locale: options.locale,
  })
}

function createEffectiveRequestCookies(
  request: NextRequest,
  headers: Headers,
  requestHeaderOverrides: boolean,
): NextjsCookieReader {
  const cookieHeader = headers.get('cookie')

  if (cookieHeader !== null)
    return createCookieReaderFromHeader(cookieHeader) ?? EMPTY_COOKIE_READER
  if (requestHeaderOverrides) return EMPTY_COOKIE_READER

  return request.cookies
}

function resolveServerConsent(
  consent: CoreStatelessRequestConsent | NextjsOptimizationServerConsentResolver,
  context: Parameters<NextjsOptimizationServerConsentResolver>[0],
): CoreStatelessRequestConsent | Promise<CoreStatelessRequestConsent> {
  return typeof consent === 'function' ? consent(context) : consent
}

function getExistingNextResponse(
  responseOrEvent: NextResponse | NextFetchEvent | undefined,
): NextResponse | undefined {
  return responseOrEvent instanceof Response ? responseOrEvent : undefined
}

function hasRequestHeaderOverrides(response: NextResponse | undefined): boolean {
  if (response === undefined) return false

  return response.headers.has(NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS)
}

function hasExistingTerminalMiddlewareTarget(response: NextResponse): boolean {
  const { headers } = response

  if (
    response.status >= REDIRECT_STATUS_MIN &&
    response.status < REDIRECT_STATUS_MAX &&
    headers.has(NEXTJS_MIDDLEWARE_REDIRECT_HEADER)
  ) {
    return true
  }

  return (
    !headers.has(NEXTJS_MIDDLEWARE_NEXT_HEADER) &&
    !headers.has(NEXTJS_MIDDLEWARE_REWRITE_HEADER) &&
    !headers.has(NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS)
  )
}

function applyNextjsOptimizationRequestContext(
  response: NextResponse,
  requestHeaders: Headers,
): void {
  clearForwardedRequestHeaders(response)
  applyForwardedRequestHeaders(response, requestHeaders)
}

function createSanitizedForwardedRequestHeaders(
  request: NextRequest,
  response?: NextResponse,
): Headers {
  const requestHeaders = createBaseForwardedRequestHeaders(request.headers, response)

  sanitizeForwardedRequestHeaders(requestHeaders, request.url)

  return requestHeaders
}

function sanitizeForwardedRequestHeaders(requestHeaders: Headers, requestUrl: string): void {
  for (const name of Array.from(requestHeaders.keys())) {
    if (name.toLowerCase().startsWith(NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX)) {
      requestHeaders.delete(name)
    }
  }

  requestHeaders.set(
    NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER,
    normalizeNextjsAppRequestUrl(requestUrl),
  )
}
