import { configureNextjsEdgeOptimization } from '@contentful/optimization-nextjs/edge'
import { appConfig } from './config'
import type { CustomerSegment } from './customer-segments'
import {
  createPublicSegmentCacheMetadata,
  type PublicSegmentCacheMetadata,
} from './public-cache-metadata'
import { getAppConsent } from './util'

export const {
  createEdgeRequestHandoff,
  createHandoffFromSelections: createEdgeHandoffFromSelections,
  createOptimizationCacheKey: createEdgeOptimizationCacheKey,
} = configureNextjsEdgeOptimization({
  clientId: appConfig.clientId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  consent: {
    server: ({ cookies }) => (getAppConsent(cookies) ? { events: true, persistence: true } : false),
    clientDefaults: { consent: false, persistenceConsent: false },
  },
  app: {
    name: 'Contentful Optimization Next.js SDK App Router Edge',
    version: '0.1.0',
  },
})
export { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'

export function createEdgeCustomerSegmentCacheMetadata(
  segment: CustomerSegment,
): PublicSegmentCacheMetadata {
  return createPublicSegmentCacheMetadata({
    baselineEntryIds: segment.baselineEntryIds,
    cacheVersion: segment.cacheVersion,
    createOptimizationCacheKey: createEdgeOptimizationCacheKey,
    locale: segment.locale,
    selectedOptimizations: segment.selectedOptimizations,
    slug: segment.slug,
  })
}
