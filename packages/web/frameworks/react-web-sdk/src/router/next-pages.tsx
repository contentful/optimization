'use client'

import { useRouter, type NextRouter } from 'next/router'
import { useCallback, useMemo, type ReactElement } from 'react'
import { buildAutoPagePayload } from '../auto-page/pagePayload'
import type { AutoPagePayload, AutoPagePayloadOptions } from '../auto-page/types'
import { useAutoPageEmitter, type InitialAutoPageEvent } from '../auto-page/useAutoPageEmitter'

function splitAsPath(asPath: string): { path: string; search: string } {
  const queryIndex = asPath.indexOf('?')
  if (queryIndex === -1) {
    return { path: asPath, search: '' }
  }
  return { path: asPath.slice(0, queryIndex), search: asPath.slice(queryIndex) }
}

function flattenQuery(query: NextRouter['query']): Record<string, string> {
  const entries = Object.entries(query).flatMap<[string, string]>(([key, value]) => {
    if (typeof value === 'string') {
      return [[key, value]]
    }
    if (Array.isArray(value) && value.length > 0) {
      return [[key, value.join(',')]]
    }
    return []
  })
  return Object.fromEntries(entries)
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

export interface NextPagesAutoPageContext {
  readonly routeKey: string
  readonly pathname: string
  readonly asPath: string
  readonly query: NextRouter['query']
  readonly router: NextRouter
}

export interface NextPagesAutoPageTrackerProps extends AutoPagePayloadOptions<NextPagesAutoPageContext> {
  readonly initialPageEvent?: InitialAutoPageEvent
}

export function NextPagesAutoPageTracker({
  initialPageEvent,
  pagePayload,
  getPagePayload,
}: NextPagesAutoPageTrackerProps): ReactElement | null {
  const router = useRouter()
  const { asPath, pathname, query, isReady } = router
  const routeKey = asPath

  const routerPayload = useMemo<AutoPagePayload>(() => {
    const { path, search } = splitAsPath(asPath)
    return {
      properties: {
        path,
        query: flattenQuery(query),
        search,
        url: resolveAbsoluteUrl(asPath),
      },
    }
  }, [asPath, query])

  const buildPayload = useCallback(
    ({ isInitialEmission }: { isInitialEmission: boolean }): AutoPagePayload =>
      buildAutoPagePayload(
        routerPayload,
        { pagePayload, getPagePayload },
        {
          isInitialEmission,
          routeKey,
          context: {
            routeKey,
            asPath,
            pathname,
            query,
            router,
          },
        },
      ),
    [asPath, getPagePayload, pagePayload, pathname, query, routeKey, router, routerPayload],
  )

  useAutoPageEmitter({ enabled: isReady, initialPageEvent, routeKey, buildPayload })

  return null
}
