import { useCallback, useMemo, type ReactElement } from 'react'
import { useLocation, useMatches, type Location, type UIMatch } from 'react-router-dom'
import { buildAutoPagePayload } from '../auto-page/pagePayload'
import type { AutoPagePayload, AutoPagePayloadOptions } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'

function toRouteKey(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname}${location.search}${location.hash}`
}

function buildQueryDictionary(searchStr: string): Record<string, string> {
  const params = new URLSearchParams(searchStr)
  const query: Record<string, string> = {}
  for (const [key, value] of params) {
    query[key] = value
  }
  return query
}

function resolveAbsoluteUrl(href: string): string {
  if (typeof window === 'undefined') {
    return href
  }
  try {
    return new URL(href, window.location.origin).toString()
  } catch {
    return href
  }
}

function buildRouterPayload(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
): AutoPagePayload {
  const href = `${location.pathname}${location.search}${location.hash}`
  return {
    properties: {
      hash: location.hash,
      path: location.pathname,
      query: buildQueryDictionary(location.search),
      search: location.search,
      url: resolveAbsoluteUrl(href),
    },
  }
}

export interface ReactRouterAutoPageContext {
  readonly hash: string
  readonly location: Location
  readonly matches: readonly UIMatch[]
  readonly pathname: string
  readonly routeKey: string
  readonly search: string
  readonly url: string
}

export interface ReactRouterAutoPageTrackerProps extends AutoPagePayloadOptions<ReactRouterAutoPageContext> {}

export function ReactRouterAutoPageTracker({
  pagePayload,
  getPagePayload,
}: ReactRouterAutoPageTrackerProps): ReactElement | null {
  const location = useLocation()
  const matches = useMatches()
  const routeKey = toRouteKey(location)
  const { hash, pathname, search } = location

  const routerPayload = useMemo(
    () => buildRouterPayload({ hash, pathname, search }),
    [hash, pathname, search],
  )

  const buildPayload = useCallback(
    ({ isInitialEmission }: { isInitialEmission: boolean }): AutoPagePayload =>
      buildAutoPagePayload(
        routerPayload,
        { pagePayload, getPagePayload },
        {
          isInitialEmission,
          routeKey,
          context: {
            hash,
            location,
            matches,
            pathname,
            routeKey,
            search,
            url: routeKey,
          },
        },
      ),
    [
      getPagePayload,
      hash,
      location,
      matches,
      pagePayload,
      pathname,
      routeKey,
      routerPayload,
      search,
    ],
  )

  useAutoPageEmitter({ enabled: true, routeKey, buildPayload })

  return null
}
