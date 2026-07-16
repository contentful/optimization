import {
  createRequestHandoff,
  createRoutePagePayload,
  getForwardedRequestUrl,
  toRouteKey,
} from '@/lib/optimization'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

const HIDDEN_UNTIL_READY_ROUTE = '/hidden-until-ready'

function toRequestHydration(
  routeKey: string,
): 'preserve-server' | 'client-only-hidden-until-ready' {
  return routeKey === HIDDEN_UNTIL_READY_ROUTE
    ? 'client-only-hidden-until-ready'
    : 'preserve-server'
}

export const createCurrentRequestHandoff = cache(async () => {
  const cookieStore = await cookies()
  const requestHeaders = new Headers(await headers())
  const requestUrl = getForwardedRequestUrl(requestHeaders)
  const routeKey = toRouteKey(requestUrl)
  const pagePayload = createRoutePagePayload(routeKey, requestUrl)
  const handoff = await createRequestHandoff({
    cache: { scope: 'private-request' },
    hydration: toRequestHydration(routeKey),
    pagePayload,
    request: {
      cookies: cookieStore,
      headers: requestHeaders,
      url: requestUrl,
    },
  })

  return { handoff, pagePayload, routeKey }
})
