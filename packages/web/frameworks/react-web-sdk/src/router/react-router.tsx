'use client'

import { useCallback, useMemo, type ReactElement } from 'react'
import { useLocation, useMatches, type Location, type UIMatch } from 'react-router-dom'
import { buildAutoPagePayload } from '../auto-page/pagePayload'
import type { AutoPagePayload, AutoPagePayloadOptions } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'
import type { ContentOptimizationHandoff } from '../handoff'

function toRouteKey(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname}${location.search}${location.hash}`
}

function buildQueryDictionary(searchStr: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchStr))
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

export interface ReactRouterAutoPageTrackerProps extends AutoPagePayloadOptions<ReactRouterAutoPageContext> {
  /** Pass the root's handoff to share paired startup; replay matching uses pathname/search. */
  readonly handoff?: ContentOptimizationHandoff
}

export function ReactRouterAutoPageTracker({
  handoff,
  pagePayload,
  getPagePayload,
}: ReactRouterAutoPageTrackerProps): ReactElement | null {
  const location = useLocation()
  const matches = useMatches()
  const { hash, pathname, search } = location
  const url = toRouteKey(location)
  const routeKey = handoff === undefined ? url : `${pathname}${search}`

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
            url,
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
      url,
    ],
  )

  useAutoPageEmitter({ enabled: true, handoff, routeKey, buildPayload })

  return null
}
