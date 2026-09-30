import {
  bindNextjsAppRouterServerOptimization,
  type NextjsAppRouterServerOptimizationConfig,
} from '@contentful/optimization-nextjs/app-router/server'
import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'
import { type NextjsOptimizationServerConsentResolver } from '@contentful/optimization-nextjs/server'
import { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'
import type { NextRequest, NextResponse } from 'next/server'
import { appConfig } from './config'
import { client } from './contentful'
import type { CustomerSegment } from './customer-segments'
import { ClientRequestOptimizationRoot } from './optimization-client'
import { getAppConsent } from './util'

const HIDDEN_UNTIL_READY_ROUTE = '/hidden-until-ready'
const BEFORE_INITIAL_PAGE_QUERY_VALUE = 'readiness'

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
} satisfies NextjsAppRouterServerOptimizationConfig

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
      initialExperienceEvents: ({ requestUrl }) =>
        new URL(requestUrl).searchParams.get('beforeInitialPage') ===
        BEFORE_INITIAL_PAGE_QUERY_VALUE
          ? [{ type: 'identify', userId: 'charles', traits: { identified: true } }]
          : [],
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

const forwardOptimizationContext = createNextjsOptimizationContextHandler()

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

export async function proxy(request: NextRequest): Promise<NextResponse> {
  return forwardOptimizationContext(request)
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
