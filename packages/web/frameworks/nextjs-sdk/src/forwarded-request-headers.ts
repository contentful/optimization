import type { NextResponse } from 'next/server'

export const NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS = 'x-middleware-override-headers'
export const NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX = 'x-middleware-request-'

export function createForwardedRequestHeaders(
  requestHeaders: Headers,
  response: NextResponse | undefined,
): Headers {
  return createExistingForwardedRequestHeaders(response) ?? new Headers(requestHeaders)
}

function createExistingForwardedRequestHeaders(
  response: NextResponse | undefined,
): Headers | undefined {
  if (response === undefined) return undefined

  const overrideHeaderNames = response.headers.get(NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS)
  if (overrideHeaderNames === null) return undefined

  const requestHeaders = new Headers()

  for (const name of overrideHeaderNames.split(',')) {
    const requestHeaderName = name.trim()
    if (!requestHeaderName) continue

    const value = response.headers.get(
      `${NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX}${requestHeaderName}`,
    )
    if (value !== null) requestHeaders.set(requestHeaderName, value)
  }

  return requestHeaders
}

export function applyForwardedRequestHeaders(
  response: NextResponse,
  requestHeaders: Headers,
): void {
  const forwardedHeaderNames = Array.from(requestHeaders.keys())

  for (const [name, value] of requestHeaders) {
    response.headers.set(`${NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX}${name}`, value)
  }

  response.headers.set(NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS, forwardedHeaderNames.join(','))
}

export function clearForwardedRequestHeaders(response: NextResponse): void {
  for (const name of Array.from(response.headers.keys())) {
    if (
      name === NEXTJS_MIDDLEWARE_OVERRIDE_HEADERS ||
      name.toLowerCase().startsWith(NEXTJS_MIDDLEWARE_REQUEST_HEADER_PREFIX)
    ) {
      response.headers.delete(name)
    }
  }
}
