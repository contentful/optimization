import {
  bindNextjsAppRouterOptimization,
  createPublicPermutationCacheMetadata,
} from '@contentful/optimization-nextjs/app-router'
import {
  createNextjsPublicPermutationCacheMiddleware,
  type NextjsPublicPermutationCacheMiddleware,
} from '@contentful/optimization-nextjs/cache-middleware'
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'
import {
  configureNextjsServerOptimization,
  type NextjsOptimizationServerConsentResolver,
} from '@contentful/optimization-nextjs/server'
import { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'
import { NextResponse, type NextRequest } from 'next/server'
import { appConfig } from './config'
import { getCustomerSegment, type CustomerSegment } from './customer-segments'
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
  readonly trustedRequestHandoff?: true
}

type ServerAppRouterOptimization = AppRouterOptimization & {
  readonly createRequestHandoff: (
    options: AppRouterRequestHandoffOptions,
  ) => Promise<ContentHandoff>
}

const serverOptimizationConfig = {
  clientId: appConfig.clientId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  app: {
    name: 'Contentful Optimization Next.js SDK App Router',
    version: '0.1.0',
  },
} as const

const serverConsent: NextjsOptimizationServerConsentResolver = ({ cookies }) =>
  getAppConsent(cookies) ? { events: true, persistence: true } : false

const optimization = bindNextjsAppRouterOptimization({
  ...serverOptimizationConfig,
  trackEntryInteraction: { views: true, clicks: true, hovers: true },
  consent: {
    server: serverConsent,
    clientDefaults: { consent: false, persistenceConsent: false },
  },
}) as ServerAppRouterOptimization

export const {
  NextAppAutoPageTracker,
  OptimizationAnalyticsRoot,
  OptimizationRoot,
  OptimizedEntry,
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationHandoff,
  createRequestHandoff,
  resolveEntriesForSelections,
} = optimization
export { getServerTrackingAttributes }

const cacheMiddleware: NextjsPublicPermutationCacheMiddleware =
  createNextjsPublicPermutationCacheMiddleware({
    resolveCache: (request) => {
      const segmentSlug = getPublicHandoffSegmentSlug(request.nextUrl.pathname)
      const segment = segmentSlug === undefined ? undefined : getCustomerSegment(segmentSlug)

      return segment === undefined
        ? undefined
        : createPublicPermutationCacheMetadata({
            cacheVersion: segment.cacheVersion,
            entryIds: segment.baselineEntryIds,
            locale: segment.locale,
            permutationKey: segment.slug,
            selectedOptimizations: segment.selectedOptimizations,
            tags: createCustomerSegmentCacheTags(segment),
          })
    },
  })

const forwardOptimizationContext = createNextjsOptimizationContextHandler({
  consent: serverConsent,
  locale: appConfig.locale,
  sdk: configureNextjsServerOptimization(serverOptimizationConfig),
})

export function createCustomerSegmentHandoff(segment: CustomerSegment): ContentHandoff {
  return createPublicPermutationHandoff({
    cacheVersion: segment.cacheVersion,
    entryIds: segment.baselineEntryIds,
    hydration: 'preserve-server',
    initialPageEvent: 'emit',
    locale: segment.locale,
    permutationKey: segment.slug,
    selectedOptimizations: segment.selectedOptimizations,
    tags: createCustomerSegmentCacheTags(segment),
  })
}

export function createCustomerSegmentAnalyticsHandoff(segment: CustomerSegment) {
  return createPublicPermutationHandoff({
    cacheVersion: segment.cacheVersion,
    entryIds: segment.baselineEntryIds,
    hydration: 'analytics-only',
    initialPageEvent: 'emit',
    locale: segment.locale,
    permutationKey: segment.slug,
    selectedOptimizations: segment.selectedOptimizations,
    tags: createCustomerSegmentCacheTags(segment),
  })
}

function createCustomerSegmentCacheTags(segment: CustomerSegment): readonly string[] {
  return [`ctfl-opt-segment:${segment.slug}:v${segment.cacheVersion}`]
}

function getPublicHandoffSegmentSlug(pathname: string): string | undefined {
  const prefix = PUBLIC_HANDOFF_PREFIXES.find((candidate) => pathname.startsWith(candidate))
  if (prefix === undefined) return undefined

  const segment = pathname.slice(prefix.length)
  return segment.length > 0 ? segment : undefined
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = createRequestUrlResponse(request)

  if (isPublicHandoffPath(request.nextUrl.pathname)) {
    return cacheMiddleware(request, response)
  }

  return forwardOptimizationContext(request, response)
}

function createRequestUrlResponse(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_URL_HEADER, request.url)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

function isPublicHandoffPath(pathname: string): boolean {
  return PUBLIC_HANDOFF_PREFIXES.some((prefix) => pathname.startsWith(prefix))
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
