import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
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
  type NextjsOptimizationServerConsentResolver,
  type OptimizationData,
  type PersistNextjsAnonymousIdOptions,
} from './server'

export type MaybePromise<T> = T | Promise<T>

const NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS = 'x-middleware-override-headers'
const NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX = 'x-middleware-request-'

export type NextjsOptimizationRequestHandler = (
  request: NextRequest,
  responseOrEvent?: NextResponse | NextFetchEvent,
) => MaybePromise<NextResponse>

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
    const requestHeaders = createForwardedRequestHeaders(request, response)
    const result =
      options === undefined
        ? undefined
        : await getRequestOptimizationData(request, requestHeaders, options)

    if (result !== undefined) {
      requestHeaders.set(
        NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER,
        serializeNextjsOptimizationRequestContext({
          consent: result.consent,
          data: result.data,
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
  readonly requestOptimization: CoreStatelessRequest
}

async function getRequestOptimizationData(
  request: NextRequest,
  headers: Headers,
  options: NextjsOptimizationContextHandlerOptions,
): Promise<RequestOptimizationData> {
  const consent = await resolveServerConsent(options.consent, {
    cookies: request.cookies,
    headers,
  })
  const { data, requestOptimization } = await getNextjsServerOptimizationData(options.sdk, {
    anonymousIdCookieName: options.anonymousIdCookieName,
    consent,
    headers,
    locale: options.locale,
    request: {
      cookies: request.cookies,
      headers,
      url: request.url,
    },
  })

  return { consent, data, requestOptimization }
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

function applyNextjsOptimizationRequestContext(
  response: NextResponse,
  requestHeaders: Headers,
): void {
  const forwardedHeaderNames = Array.from(requestHeaders.keys())

  clearForwardedRequestHeaders(response)

  for (const [name, value] of requestHeaders) {
    response.headers.set(`${NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX}${name}`, value)
  }

  response.headers.set(NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS, forwardedHeaderNames.join(','))
}

function createForwardedRequestHeaders(request: NextRequest, response?: NextResponse): Headers {
  const requestHeaders =
    createExistingForwardedRequestHeaders(response) ?? new Headers(request.headers)

  sanitizeForwardedRequestHeaders(requestHeaders, request.url)

  return requestHeaders
}

function createExistingForwardedRequestHeaders(
  response: NextResponse | undefined,
): Headers | undefined {
  if (!response) {
    return undefined
  }

  const overrideHeaderNames = response.headers.get(NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS)

  if (overrideHeaderNames === null) {
    return undefined
  }

  const requestHeaders = new Headers()

  for (const name of overrideHeaderNames.split(',')) {
    const requestHeaderName = name.trim()

    if (!requestHeaderName) {
      continue
    }

    const value = response.headers.get(
      `${NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX}${requestHeaderName}`,
    )

    if (value !== null) {
      requestHeaders.set(requestHeaderName, value)
    }
  }

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

function clearForwardedRequestHeaders(response: NextResponse): void {
  for (const name of Array.from(response.headers.keys())) {
    if (
      name === NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS ||
      name.toLowerCase().startsWith(NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX)
    ) {
      response.headers.delete(name)
    }
  }
}
