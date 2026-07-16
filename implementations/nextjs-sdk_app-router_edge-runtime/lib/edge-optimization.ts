import { configureNextjsEdgeOptimization } from '@contentful/optimization-nextjs/edge'
import { appConfig } from './config'
import type { CustomerSegment } from './customer-segments'
import { getAppConsent } from './util'

export const { createEdgeRequestHandoff, createPublicPermutationHandoff } =
  configureNextjsEdgeOptimization({
    clientId: appConfig.clientId,
    environment: appConfig.environment,
    locale: appConfig.locale,
    logLevel: 'debug',
    api: appConfig.api,
    consent: {
      server: ({ cookies }) =>
        getAppConsent(cookies) ? { events: true, persistence: true } : false,
      clientDefaults: { consent: false, persistenceConsent: false },
    },
    app: {
      name: 'Contentful Optimization Next.js SDK Edge runtime',
      version: '0.1.0',
    },
  })

export function createEdgeCustomerSegmentHandoff(segment: CustomerSegment) {
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

function createCustomerSegmentCacheTags(segment: CustomerSegment): readonly string[] {
  return [`ctfl-opt-segment:${segment.slug}:v${segment.cacheVersion}`]
}
