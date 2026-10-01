import {
  createRequestHandoffFromData,
  type ManagedEntryHandoff,
} from '@contentful/optimization-react-web/core-sdk'
import { createScopedLogger } from '@contentful/optimization-react-web/logger'
import type {
  AnalyticsOptimizationHandoff,
  BrowserOptimizationHandoff,
  ContentOptimizationHandoff,
  ContentOptimizationHydrationMode,
  OptimizationHydrationMode,
} from './handoff'
import { addBrowserHandoffMetadata } from './handoff'

const logger = createScopedLogger('Next.js:RequestPreview')

export interface RequestPreviewFallbackResult<T> {
  readonly degraded: boolean
  readonly value: T
}

export async function resolveRequestPreview<T>(
  attempt: () => Promise<T>,
  fallback: () => T,
): Promise<RequestPreviewFallbackResult<T>> {
  try {
    return { degraded: false, value: await attempt() }
  } catch (error) {
    logger.warn(
      'Request personalization failed; continuing without server personalization so the browser can track the page.',
      String(error),
    )
    return { degraded: true, value: fallback() }
  }
}

export function createPrivateRequestPreviewFallbackHandoff(input: {
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly hydration: 'analytics-only'
}): AnalyticsOptimizationHandoff
export function createPrivateRequestPreviewFallbackHandoff(input: {
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly hydration: ContentOptimizationHydrationMode
}): ContentOptimizationHandoff
export function createPrivateRequestPreviewFallbackHandoff(input: {
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly hydration: OptimizationHydrationMode
}): BrowserOptimizationHandoff
export function createPrivateRequestPreviewFallbackHandoff({
  entries,
  hydration,
}: {
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly hydration: OptimizationHydrationMode
}): BrowserOptimizationHandoff {
  return addBrowserHandoffMetadata(
    createRequestHandoffFromData({
      cache: { scope: 'private-request' },
      ...(entries === undefined ? {} : { entries }),
    }),
    { hydration },
  )
}

export function reportRequestPreviewFallback(error: unknown): void {
  logger.warn(
    'Request personalization could not start; continuing without server personalization so the browser can track the page.',
    String(error),
  )
}
