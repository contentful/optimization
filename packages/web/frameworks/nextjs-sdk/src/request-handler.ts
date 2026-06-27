import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import {
  NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX,
  NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER,
} from './request-context'

export type MaybePromise<T> = T | Promise<T>

const NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS = 'x-middleware-override-headers'
const NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX = 'x-middleware-request-'

export type NextjsOptimizationRequestHandler = (
  request: NextRequest,
  responseOrEvent?: NextResponse | NextFetchEvent,
) => MaybePromise<NextResponse>

export function createNextjsOptimizationContextHandler(): NextjsOptimizationRequestHandler {
  return (request, responseOrEvent) => {
    const response = getExistingNextResponse(responseOrEvent)
    const requestHeaders = createForwardedRequestHeaders(request, response)

    if (!response) {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    applyNextjsOptimizationRequestContext(response, requestHeaders)
    return response
  }
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
