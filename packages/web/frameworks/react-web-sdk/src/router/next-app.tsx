'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import type { AutoPagePayloadOptions } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'

function toSearch(searchParams: ReturnType<typeof useSearchParams>): string {
  const value = searchParams.toString()
  return value.length > 0 ? `?${value}` : ''
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

  const route = useMemo(() => {
    const search = toSearch(searchParams)

    return {
      routeKey: `${pathname}${search}`,
      context: {
        routeKey: `${pathname}${search}`,
        pathname,
        router,
        search,
        searchParams,
        url: `${pathname}${search}`,
      },
    }
  }, [pathname, router, searchParams])

  useAutoPageEmitter({
    enabled: true,
    route,
    pagePayload,
    getPagePayload,
  })

  return null
}
