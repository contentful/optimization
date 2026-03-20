import type { NextRouter } from 'next/router'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import type { AutoPagePayloadOptions } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'
import { useNextPagesRouter } from './next-pages-runtime'

type NextPagesQuery = Record<string, string | string[] | undefined>

export interface NextPagesAutoPageContext {
  readonly routeKey: string
  readonly pathname: string
  readonly asPath: string
  readonly query: NextPagesQuery
  readonly router: NextRouter
}

export interface NextPagesAutoPageTrackerProps extends AutoPagePayloadOptions<NextPagesAutoPageContext> {}

export function NextPagesAutoPageTracker({
  pagePayload,
  getPagePayload,
}: NextPagesAutoPageTrackerProps): ReactElement | null {
  const router = useNextPagesRouter()

  const route = useMemo(
    () => ({
      routeKey: router.asPath,
      context: {
        routeKey: router.asPath,
        pathname: router.pathname,
        asPath: router.asPath,
        query: router.query,
        router,
      },
    }),
    [router, router.asPath, router.pathname, router.query],
  )

  useAutoPageEmitter({
    enabled: router.isReady,
    route,
    pagePayload,
    getPagePayload,
  })

  return null
}
