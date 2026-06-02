import { useRouter, useRouterState, type AnyRouter, type RouterState } from '@tanstack/react-router'
import { useMemo, type ReactElement } from 'react'
import type { AutoPagePayload, AutoPagePayloadOptions } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'

type TanStackLocation = RouterState<AnyRouter['routeTree']>['location']
type TanStackMatches = RouterState<AnyRouter['routeTree']>['matches']

export interface TanStackRouterAutoPageContext {
  readonly hash: TanStackLocation['hash']
  readonly location: TanStackLocation
  readonly matches: TanStackMatches
  readonly pathname: TanStackLocation['pathname']
  readonly routeKey: string
  readonly router: AnyRouter
  readonly search: TanStackLocation['searchStr']
  readonly url: TanStackLocation['href']
}

export interface TanStackRouterAutoPageTrackerProps extends AutoPagePayloadOptions<TanStackRouterAutoPageContext> {}

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

function normalizeHash(hash: string): string {
  if (hash === '' || hash.startsWith('#')) {
    return hash
  }
  return `#${hash}`
}

interface RouterUrlSnapshot {
  readonly hash: string
  readonly href: string
  readonly pathname: string
  readonly searchStr: string
}

function buildRouterDefaultPayload(snapshot: RouterUrlSnapshot): AutoPagePayload {
  return {
    properties: {
      hash: normalizeHash(snapshot.hash),
      path: snapshot.pathname,
      query: buildQueryDictionary(snapshot.searchStr),
      search: snapshot.searchStr,
      url: resolveAbsoluteUrl(snapshot.href),
    },
  }
}

export function TanStackRouterAutoPageTracker({
  pagePayload,
  getPagePayload,
}: TanStackRouterAutoPageTrackerProps): ReactElement | null {
  const router = useRouter()
  const location = useRouterState<AnyRouter, TanStackLocation>({
    select: (state) => state.location,
  })
  const matches = useRouterState<AnyRouter, TanStackMatches>({ select: (state) => state.matches })
  const { href: routeKey } = location
  // Anchor default-payload memoization on the URL pieces that describe the
  // route, so incidental re-renders that produce a new `location` reference
  // (but the same URL) do not invalidate the memo and re-trigger the
  // emission effect downstream.
  const { hash, pathname, searchStr } = location
  const defaultPayload = useMemo(
    () => buildRouterDefaultPayload({ hash, pathname, searchStr, href: routeKey }),
    [hash, pathname, searchStr, routeKey],
  )

  useAutoPageEmitter({
    enabled: true,
    route: {
      routeKey,
      context: {
        hash: location.hash,
        location,
        matches,
        pathname: location.pathname,
        routeKey,
        router,
        search: location.searchStr,
        url: routeKey,
      },
    },
    defaultPayload,
    pagePayload,
    getPagePayload,
  })

  return null
}
