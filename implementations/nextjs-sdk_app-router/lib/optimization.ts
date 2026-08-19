import {
  bindNextjsAppRouterServerOptimization,
  createPublicPermutationCacheMetadata,
} from '@contentful/optimization-nextjs/app-router/server'
import {
  createNextjsPublicPermutationCacheMiddleware,
  type NextjsPublicPermutationCacheMiddleware,
} from '@contentful/optimization-nextjs/cache-middleware'
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'
import { type NextjsOptimizationServerConsentResolver } from '@contentful/optimization-nextjs/server'
import { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'
import type { NextRequest, NextResponse } from 'next/server'
import { appConfig } from './config'
import { client } from './contentful'
import { getCustomerSegment, type CustomerSegment } from './customer-segments'
import { ClientRequestOptimizationRoot } from './optimization-client'
import { getAppConsent } from './util'

const HIDDEN_UNTIL_READY_ROUTE = '/hidden-until-ready'
const PUBLIC_HANDOFF_PREFIXES = ['/selection-handoff/', '/analytics-only/'] as const

type AppRouterOptimization = ReturnType<typeof bindNextjsAppRouterServerOptimization>
export type ContentHandoff = NonNullable<
  Parameters<AppRouterOptimization['OptimizationRoot']>[0]['handoff']
>

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

const optimization = bindNextjsAppRouterServerOptimization(
  {
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
    },
  },
  {
    request: {
      OptimizationRoot: ClientRequestOptimizationRoot,
    },
  },
)

export const {
  OptimizationAnalyticsRoot,
  OptimizationRoot: ExplicitOptimizationRoot,
  OptimizedEntry: ExplicitOptimizedEntry,
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationHandoff,
  resolveEntriesForSelections,
} = optimization
export const { OptimizationRoot: RequestOptimizationRoot, OptimizedEntry: RequestOptimizedEntry } =
  optimization.request
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

const forwardOptimizationContext = createNextjsOptimizationContextHandler()

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
  if (isPublicHandoffPath(request.nextUrl.pathname)) {
    return cacheMiddleware(request)
  }

  return forwardOptimizationContext(request)
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
