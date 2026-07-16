import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { createCookieReaderFromHeader } from './cookies'
import {
  applyForwardedRequestHeaders,
  clearForwardedRequestHeaders,
  createForwardedRequestHeaders as createBaseForwardedRequestHeaders,
  NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS,
} from './forwarded-request-headers'
import {
  NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX,
  NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER,
  NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER,
  serializeNextjsOptimizationRequestContext,
} from './request-context'
import {
  getNextjsServerOptimizationData,
  persistNextjsAnonymousId,
  type ContentfulOptimization,
  type CoreStatelessRequest,
  type CoreStatelessRequestConsent,
  type NextjsAnonymousIdCookieOptions,
  type NextjsCookieReader,
  type NextjsOptimizationServerConsentResolver,
  type OptimizationData,
  type PersistNextjsAnonymousIdOptions,
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
    const result =
      options === undefined
        ? undefined
        : await getRequestOptimizationData(
            request,
            requestHeaders,
            hasRequestHeaderOverrides(response),
            options,
          )

    if (result !== undefined) {
      requestHeaders.set(
        NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER,
        serializeNextjsOptimizationRequestContext({
          consent: result.consent,
          pageAccepted: result.pageAccepted,
          profileId: result.profileId,
        }),
      )
    }

    if (!response) {
      const nextResponse = NextResponse.next({ request: { headers: requestHeaders } })
      if (options !== undefined && result !== undefined) {
        persistNextjsAnonymousId(nextResponse, result.requestOptimization, result.data, options)
      }
      return nextResponse
    }

    applyNextjsOptimizationRequestContext(response, requestHeaders)
    if (options !== undefined && result !== undefined) {
      persistNextjsAnonymousId(response, result.requestOptimization, result.data, options)
    }
    return response
  }
}

interface RequestOptimizationData {
  readonly consent: CoreStatelessRequestConsent
  readonly data: OptimizationData | undefined
  readonly pageAccepted: boolean
  readonly profileId: string | undefined
  readonly requestOptimization: CoreStatelessRequest
}

async function getRequestOptimizationData(
  request: NextRequest,
  headers: Headers,
  requestHeaderOverrides: boolean,
  options: NextjsOptimizationContextHandlerOptions,
): Promise<RequestOptimizationData> {
  const cookies = createEffectiveRequestCookies(request, headers, requestHeaderOverrides)
  const consent = await resolveServerConsent(options.consent, {
    cookies,
    headers,
  })
  const { data, pageResult, requestOptimization } = await getNextjsServerOptimizationData(
    options.sdk,
    {
      anonymousIdCookieName: options.anonymousIdCookieName,
      consent,
      locale: options.locale,
      request: {
        cookies,
        headers,
        url: request.url,
      },
    },
  )

  return {
    consent,
    data,
    pageAccepted: pageResult.accepted,
    profileId: data?.profile.id ?? requestOptimization.profile?.id,
    requestOptimization,
  }
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

  requestHeaders.set(NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER, requestUrl)
}
