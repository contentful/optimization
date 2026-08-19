'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation.js'
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { buildAutoPagePayload } from '../auto-page/pagePayload'
import type { AutoPagePayload, AutoPagePayloadOptions } from '../auto-page/types'
import { useAutoPageEmitter, type InitialAutoPageEvent } from '../auto-page/useAutoPageEmitter'

function toSearch(searchParams: { readonly toString: () => string }): string {
  const value = searchParams.toString()
  return value.length > 0 ? `?${value}` : ''
}

function toBrowserRouteKey(): string | undefined {
  if (typeof window === 'undefined') return undefined

  const search = toSearch(new URLSearchParams(window.location.search))
  return `${window.location.pathname}${search}`
}

function toQueryDictionary(
  searchParams: ReturnType<typeof useSearchParams>,
): Record<string, string> {
  return Object.fromEntries(searchParams)
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

export interface NextAppAutoPageContext {
  readonly routeKey: string
  readonly pathname: string
  readonly router: ReturnType<typeof useRouter>
  readonly search: string
  readonly searchParams: ReturnType<typeof useSearchParams>
  readonly url: string
}

export interface NextAppAutoPageTrackerProps extends AutoPagePayloadOptions<NextAppAutoPageContext> {
  readonly initialPageEvent?: InitialAutoPageEvent
}

interface NextAppRouteSnapshot {
  readonly pathname: string
  readonly routeKey: string
  readonly search: string
  readonly searchParams: ReturnType<typeof useSearchParams>
}

export function useNextAppAutoPageInputs({
  pagePayload,
  getPagePayload,
}: AutoPagePayloadOptions<NextAppAutoPageContext> = {}): {
  readonly buildPagePayload: (metadata: { readonly isInitialEmission: boolean }) => AutoPagePayload
  readonly routeKey: string
} {
  const routerPathname = usePathname()
  const router = useRouter()
  const routerSearchParams = useSearchParams()

  const routerSearch = useMemo(() => toSearch(routerSearchParams), [routerSearchParams])
  const routerRouteSnapshot = useMemo<NextAppRouteSnapshot>(
    () => ({
      pathname: routerPathname,
      routeKey: `${routerPathname}${routerSearch}`,
      search: routerSearch,
      searchParams: routerSearchParams,
    }),
    [routerPathname, routerSearch, routerSearchParams],
  )
  const browserRouteKey = toBrowserRouteKey()
  const [lastBrowserConfirmedRoute, setLastBrowserConfirmedRoute] = useState<
    NextAppRouteSnapshot | undefined
  >(undefined)

  useEffect(() => {
    const committedBrowserRouteKey = toBrowserRouteKey()
    if (committedBrowserRouteKey !== routerRouteSnapshot.routeKey) return

    setLastBrowserConfirmedRoute((current) =>
      current?.routeKey === routerRouteSnapshot.routeKey ? current : routerRouteSnapshot,
    )
  }, [routerRouteSnapshot])

  // A retained App Router layout can briefly replay an older navigation
  // snapshot during an unrelated state update. Keep the last route confirmed
  // by both the router and the browser until they agree on a genuine next URL.
  // Next can also render the new router snapshot before committing its URL, so
  // the effect above reconciles that snapshot after the browser commit.
  const routeSnapshot =
    browserRouteKey !== routerRouteSnapshot.routeKey &&
    lastBrowserConfirmedRoute !== undefined &&
    lastBrowserConfirmedRoute.routeKey === browserRouteKey
      ? lastBrowserConfirmedRoute
      : routerRouteSnapshot
  const { pathname, routeKey, search, searchParams } = routeSnapshot

  // Hash intentionally omitted: Next.js App Router does not expose it; the
  // SDK's getPageProperties will read window.location.hash, which is not
  // subject to the same staleness as pathname/search.
  const routerPayload = useMemo<AutoPagePayload>(
    () => ({
      properties: {
        path: pathname,
        query: toQueryDictionary(searchParams),
        search,
        url: resolveAbsoluteUrl(routeKey),
      },
    }),
    [pathname, routeKey, search, searchParams],
  )

  const buildPagePayload = useCallback(
    ({ isInitialEmission }: { isInitialEmission: boolean }): AutoPagePayload =>
      buildAutoPagePayload(
        routerPayload,
        { pagePayload, getPagePayload },
        {
          isInitialEmission,
          routeKey,
          context: {
            routeKey,
            pathname,
            router,
            search,
            searchParams,
            url: routeKey,
          },
        },
      ),
    [getPagePayload, pagePayload, pathname, routeKey, router, routerPayload, search, searchParams],
  )

  return { buildPagePayload, routeKey }
}

export function NextAppAutoPageTracker({
  initialPageEvent,
  pagePayload,
  getPagePayload,
}: NextAppAutoPageTrackerProps): ReactElement | null {
  const { buildPagePayload, routeKey } = useNextAppAutoPageInputs({
    getPagePayload,
    pagePayload,
  })

  useAutoPageEmitter({
    buildPayload: buildPagePayload,
    enabled: true,
    initialPageEvent,
    routeKey,
  })

  return null
}
