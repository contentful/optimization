import { bindNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'
import {
  createNextjsCacheMiddleware,
  type NextjsCacheMiddleware,
} from '@contentful/optimization-nextjs/cache-middleware'
import { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'
import { NextResponse, type NextRequest } from 'next/server'
import { appConfig } from './config'
import { getCustomerSegment, type CustomerSegment } from './customer-segments'
import {
  createPublicSegmentCacheMetadata,
  type PublicSegmentCacheMetadata,
} from './public-cache-metadata'
import { getAppConsent } from './util'

const REQUEST_URL_HEADER = 'x-ctfl-opt-request-url'
const PUBLIC_HANDOFF_PREFIXES = ['/selection-handoff/', '/analytics-only/'] as const

type AppRouterOptimization = ReturnType<typeof bindNextjsAppRouterOptimization>
export type ContentHandoff = NonNullable<
  Parameters<AppRouterOptimization['OptimizationRoot']>[0]['handoff']
>

interface AppRouterRequestHandoffOptions {
  readonly cache: {
    readonly scope: 'private-request'
  }
  readonly hydration: 'preserve-server' | 'client-only-hidden-until-ready'
  readonly pagePayload: ReturnType<typeof createRoutePagePayload>
  readonly request: {
    readonly cookies?: {
      get: (name: string) => { readonly value: string } | undefined
    }
    readonly headers: Headers
    readonly url: string
  }
}

type ServerAppRouterOptimization = AppRouterOptimization & {
  readonly createRequestHandoff: (
    options: AppRouterRequestHandoffOptions,
  ) => Promise<ContentHandoff>
}

const optimization = bindNextjsAppRouterOptimization({
  clientId: appConfig.clientId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  trackEntryInteraction: { views: true, clicks: true, hovers: true },
  consent: {
    server: ({ cookies }) => (getAppConsent(cookies) ? { events: true, persistence: true } : false),
    clientDefaults: { consent: false, persistenceConsent: false },
  },
  app: {
    name: 'Contentful Optimization Next.js SDK App Router',
    version: '0.1.0',
  },
}) as ServerAppRouterOptimization

export const {
  NextAppAutoPageTracker,
  OptimizationAnalyticsRoot,
  OptimizationRoot,
  OptimizedEntry,
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createRequestHandoff,
  resolveEntriesForSelections,
} = optimization
export { getServerTrackingAttributes }

const cacheMiddleware: NextjsCacheMiddleware = createNextjsCacheMiddleware({
  resolveCacheKey: (request) => {
    const segmentSlug = getPublicHandoffSegmentSlug(request.nextUrl.pathname)
    const segment = segmentSlug === undefined ? undefined : getCustomerSegment(segmentSlug)

    return segment === undefined ? undefined : createCustomerSegmentCacheMetadata(segment).key
  },
  rewrite: ({ cacheKey, request }) => {
    const url = new URL(request.url)
    url.searchParams.set('ctfl-cache-key', cacheKey)
    return url
  },
})

export function createCustomerSegmentCacheMetadata(
  segment: CustomerSegment,
): PublicSegmentCacheMetadata {
  return createPublicSegmentCacheMetadata({
    baselineEntryIds: segment.baselineEntryIds,
    cacheVersion: segment.cacheVersion,
    createOptimizationCacheKey,
    locale: segment.locale,
    selectedOptimizations: segment.selectedOptimizations,
    slug: segment.slug,
  })
}

function getPublicHandoffSegmentSlug(pathname: string): string | undefined {
  const prefix = PUBLIC_HANDOFF_PREFIXES.find((candidate) => pathname.startsWith(candidate))
  if (prefix === undefined) return undefined

  const segment = pathname.slice(prefix.length)
  return segment.length > 0 ? segment : undefined
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_URL_HEADER, request.url)

  return cacheMiddleware(
    request,
    NextResponse.next({
      request: { headers: requestHeaders },
    }),
  )
}

export function getForwardedRequestUrl(headers: Headers): string {
  return headers.get(REQUEST_URL_HEADER) ?? 'http://localhost:3002/'
}

export function createRoutePagePayload(
  routeKey: string,
  url: string,
): {
  readonly properties: {
    readonly path: string
    readonly search: string
    readonly url: string
  }
} {
  const [path = '/', search = ''] = routeKey.split('?')

  return {
    properties: {
      path,
      search: search ? `?${search}` : '',
      url,
    },
  }
}

export function toRouteKey(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url || '/'
  }
}
