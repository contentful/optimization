/**
 * Browser-facing optimization handoff helpers.
 *
 * @packageDocumentation
 */

import type { OptimizationHandoff } from '@contentful/optimization-core'
import {
  getPreviewPanelBridge,
  type CoreBridgeHost,
} from '@contentful/optimization-core/bridge-support'
import { hydrateOptimizationSelectionState } from './handoff-state'

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
 * Hydrate a live Web SDK from a content-capable browser handoff.
 *
 * @param sdk - Live Web SDK instance to hydrate.
 * @param handoff - Content handoff produced by server, static, or edge rendering.
 *
 * @public
 */
export async function hydrateOptimizationHandoff(
  sdk: CoreBridgeHost,
  handoff: ContentOptimizationHandoff,
): Promise<void> {
  assertContentHandoff(handoff)
  assertInitialPageEvent(handoff.initialPageEvent)
  hydrateOptimizationSelectionState(getPreviewPanelBridge(sdk), handoff)
  await Promise.resolve()
}
