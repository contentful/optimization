import type { ReactElement } from 'react'
import { type Location, type UIMatch, useLocation, useMatches } from 'react-router-dom'
import type { AutoPagePayloadOptions } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'

function toRouteKey(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname}${location.search}${location.hash}`
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
        search: location.search,
        url: routeKey,
      },
    },
    pagePayload,
    getPagePayload,
  })

  return null
}
