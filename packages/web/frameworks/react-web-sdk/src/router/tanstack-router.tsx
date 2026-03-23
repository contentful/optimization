import { type AnyRouter, type RouterState, useRouter, useRouterState } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import type { AutoPagePayloadOptions } from '../auto-page/types'
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
    pagePayload,
    getPagePayload,
  })

  return null
}
