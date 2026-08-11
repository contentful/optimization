/**
 * Browser-facing optimization handoff helpers.
 *
 * @packageDocumentation
 */

import {
  assertOptimizationCacheSafety,
  type OptimizationHandoff,
  type OptimizationSelectionState,
} from '@contentful/optimization-core'
import { hydrateOptimizationHandoffStateInternal } from './handoff-internal'

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
 * @remarks
 * Framework route integrations use object identity as the handoff occurrence. Supply a fresh
 * handoff object for each new route occurrence.
 *
 * @public
 */
export interface ContentOptimizationHandoff extends OptimizationHandoff {
  /** Initial content hydration mode. */
  readonly hydration: ContentOptimizationHydrationMode
  /** Whether the browser owns the initial page event for this route. */
  readonly initialPageEvent: 'emit' | 'skip'
}

/**
 * Analytics-only browser handoff.
 *
 * @public
 */
export interface AnalyticsOptimizationHandoff extends OptimizationHandoff {
  /** Analytics-only handoffs never control content presentation. */
  readonly hydration: 'analytics-only'
  /** Whether the browser owns the initial page event for this route. */
  readonly initialPageEvent: 'emit' | 'skip'
}

/**
 * Browser-facing handoff accepted by Web-family runtimes.
 *
 * @public
 */
export type BrowserOptimizationHandoff = ContentOptimizationHandoff | AnalyticsOptimizationHandoff

/**
 * Controls whether browser handoff hydration may still update the active runtime.
 *
 * @public
 */
export interface OptimizationHandoffHydrationOptions {
  /**
   * Returns whether the calling adapter still owns this hydration operation.
   */
  readonly isCurrent?: () => boolean
}

/**
 * Minimal structural view required for browser handoff hydration.
 *
 * @remarks
 * This public integration contract primarily serves downstream SDKs and exceptional custom
 * integrations, including frameworks without a first-party adapter. Normal application code should
 * prefer its platform or framework handoff helper.
 *
 * @public
 */
export interface OptimizationHandoffHydrationTarget {
  /**
   * Purpose-specific Core operation used after browser interception and currentness checks settle.
   * It preserves Core request authority without exposing writable signal handles.
   */
  readonly applyOptimizationHandoffState?: (state: OptimizationSelectionState) => void
  readonly interceptors: {
    readonly state: unknown
  }
}

const CONTENT_HYDRATION_MODES: readonly ContentOptimizationHydrationMode[] = [
  'preserve-server',
  'client-only-hidden-until-ready',
]

function assertInitialPageEvent(
  initialPageEvent: unknown,
): asserts initialPageEvent is 'emit' | 'skip' {
  if (initialPageEvent === 'emit' || initialPageEvent === 'skip') return

  throw new TypeError('Optimization handoff requires initialPageEvent to be "emit" or "skip".')
}

function assertContentHandoff(
  handoff: ContentOptimizationHandoff,
): asserts handoff is ContentOptimizationHandoff {
  if (CONTENT_HYDRATION_MODES.includes(handoff.hydration)) return

  throw new TypeError('hydrateOptimizationHandoff only accepts content optimization handoffs.')
}

/**
 * @internal
 */
export function shouldPreserveDurableContinuity(handoff: BrowserOptimizationHandoff): boolean {
  return (
    (handoff.cache.scope === 'public-permutation' || handoff.cache.scope === 'static') &&
    handoff.state?.profile === undefined
  )
}

/**
 * Hydrate a live Web SDK from public browser handoff state.
 *
 * @param sdk - Compatible Web hydration target exposing state interception.
 * @param state - Public browser handoff state.
 * @param options - Lifecycle currentness guard for adapter-owned hydration work.
 *
 * @public
 */
export async function hydrateOptimizationHandoffState(
  sdk: OptimizationHandoffHydrationTarget,
  state: BrowserOptimizationHandoff['state'],
  options: OptimizationHandoffHydrationOptions = {},
): Promise<void> {
  await hydrateOptimizationHandoffStateInternal(sdk, state, {
    ...options,
    authoritativeStateHydration: true,
  })
}

/**
 * Hydrate a live Web SDK from a content-capable browser handoff.
 *
 * @param sdk - Compatible Web hydration target exposing state interception.
 * @param handoff - Content handoff produced by server, static, or edge rendering.
 * @param options - Lifecycle currentness guard for adapter-owned hydration work.
 *
 * @public
 */
export async function hydrateOptimizationHandoff(
  sdk: OptimizationHandoffHydrationTarget,
  handoff: ContentOptimizationHandoff,
  options: OptimizationHandoffHydrationOptions = {},
): Promise<void> {
  assertContentHandoff(handoff)
  assertInitialPageEvent(handoff.initialPageEvent)
  assertOptimizationCacheSafety(handoff)
  await hydrateOptimizationHandoffStateInternal(sdk, handoff.state, {
    ...options,
    authoritativeStateHydration: true,
    suppressDurableContinuityPersistence: shouldPreserveDurableContinuity(handoff),
  })
}
