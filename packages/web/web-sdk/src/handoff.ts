/**
 * Browser-facing optimization handoff helpers.
 *
 * @packageDocumentation
 */

import type { LifecycleInterceptors, OptimizationHandoff } from '@contentful/optimization-core'

/**
 * Browser content hydration policy for already-rendered optimized content.
 *
 * @public
 */
export type ContentOptimizationHydrationMode = 'preserve-server' | 'client-only-hidden-until-ready'

/**
 * Browser hydration policy for content or analytics-only handoffs.
 *
 * @public
 */
export type OptimizationHydrationMode = ContentOptimizationHydrationMode | 'analytics-only'

/**
 * Content-capable browser handoff.
 *
 * @public
 */
export interface ContentOptimizationHandoff extends OptimizationHandoff {
  /** Initial content hydration mode. */
  readonly hydration: ContentOptimizationHydrationMode
}

/**
 * Analytics-only browser handoff.
 *
 * @public
 */
export interface AnalyticsOptimizationHandoff extends OptimizationHandoff {
  /** Analytics-only handoffs never control content presentation. */
  readonly hydration: 'analytics-only'
}

/**
 * Browser-facing handoff accepted by Web-family runtimes.
 *
 * @public
 */
export type BrowserOptimizationHandoff = ContentOptimizationHandoff | AnalyticsOptimizationHandoff

/**
 * @internal
 */
export interface HandoffStateHydrationOptions {
  readonly isCurrent?: () => boolean
  readonly suppressDurableContinuityPersistence?: boolean
}

/** Minimal Web SDK shape required for browser handoff hydration. @public */
export interface OptimizationHandoffHydrationTarget {
  readonly interceptors: Pick<LifecycleInterceptors, 'state'>
}

export {
  hydrateOptimizationHandoff,
  hydrateOptimizationHandoffState,
  shouldPreserveDurableContinuity,
} from './handoff-internal'
