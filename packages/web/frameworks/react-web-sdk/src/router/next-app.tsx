'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, type ReactElement } from 'react'
import { buildAutoPagePayload } from '../auto-page/pagePayload'
import type { AutoPagePayload, AutoPagePayloadOptions } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'

function toSearch(searchParams: ReturnType<typeof useSearchParams>): string {
  const value = searchParams.toString()
  return value.length > 0 ? `?${value}` : ''
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

export interface NextAppAutoPageTrackerProps extends AutoPagePayloadOptions<NextAppAutoPageContext> {}

export function NextAppAutoPageTracker({
  pagePayload,
  getPagePayload,
}: NextAppAutoPageTrackerProps): ReactElement | null {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const search = useMemo(() => toSearch(searchParams), [searchParams])
  const routeKey = `${pathname}${search}`

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

  useAutoPageEmitter({ enabled: true, routeKey, buildPayload })

  return null
}
