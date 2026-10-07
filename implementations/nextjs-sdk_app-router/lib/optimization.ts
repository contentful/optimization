import {
  bindNextjsAppRouterServerOptimization,
  createPublicPermutationCacheMetadata,
} from '@contentful/optimization-nextjs/app-router/server'
import {
  createNextjsPublicPermutationCacheMiddleware,
  type NextjsPublicPermutationCacheMiddleware,
} from '@contentful/optimization-nextjs/cache-middleware'
import { type NextjsOptimizationServerConsentResolver } from '@contentful/optimization-nextjs/server'
import { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'
import type { NextRequest, NextResponse } from 'next/server'
import { appConfig } from './config'
import { client } from './contentful'
import { getCustomerSegment, type CustomerSegment } from './customer-segments'
import { getAppConsent } from './util'

const HIDDEN_UNTIL_READY_ROUTE = '/hidden-until-ready'
const INITIAL_IDENTIFY_QUERY_VALUE = 'readiness'
const PUBLIC_HANDOFF_PREFIXES = ['/selection-handoff/', '/analytics-only/'] as const

type AppRouterOptimization = ReturnType<typeof bindNextjsAppRouterServerOptimization>
export type ContentHandoff = NonNullable<
  Parameters<AppRouterOptimization['OptimizationRoot']>[0]['handoff']
>

const serverOptimizationConfig = {
  spaceId: appConfig.spaceId,
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

const optimization = bindNextjsAppRouterServerOptimization({
  ...serverOptimizationConfig,
  contentful: { client },
  trackEntryInteraction: { views: true, clicks: true, hovers: true },
  consent: {
    server: serverConsent,
    clientDefaults: { consent: false, persistenceConsent: false },
  },
  request: {
    hydration: ({ routeKey }) =>
      routeKey.split('?')[0] === HIDDEN_UNTIL_READY_ROUTE
        ? 'client-only-hidden-until-ready'
        : 'preserve-server',
    initialEvents: ({ requestUrl }) =>
      new URL(requestUrl).searchParams.get('beforeInitialPage') === INITIAL_IDENTIFY_QUERY_VALUE
        ? [{ type: 'identify', userId: 'charles', traits: { identified: true } }]
        : [],
  },
})

export const {
  OptimizationAnalyticsRoot,
  OptimizationRoot: ExplicitOptimizationRoot,
  OptimizedEntry: ExplicitOptimizedEntry,
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationHandoff,
  resolveEntriesForSelections,
} = optimization
export const {
  NextAppAutoPageTracker: RequestPageTracker,
  OptimizationProvider: RequestOptimizationProvider,
  OptimizationRoot: RequestOptimizationRoot,
  OptimizedEntry: RequestOptimizedEntry,
} = optimization.request
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

export function createCustomerSegmentHandoff(segment: CustomerSegment): ContentHandoff {
  return createPublicPermutationHandoff({
    cacheVersion: segment.cacheVersion,
    entryIds: segment.baselineEntryIds,
    hydration: 'preserve-server',
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
  if (isPublicHandoffPath(request.nextUrl.pathname)) {
    return cacheMiddleware(request)
  }

  return optimization.requestHandler(request)
}

function isPublicHandoffPath(pathname: string): boolean {
  return PUBLIC_HANDOFF_PREFIXES.some((prefix) => pathname.startsWith(prefix))
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
