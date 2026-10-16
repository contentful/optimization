/**
 * Analytics-only browser runtime for server/static/edge-rendered optimized markup.
 *
 * @packageDocumentation
 */

import { assertOptimizationCacheSafety } from '@contentful/optimization-core'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import ContentfulOptimization, {
  type OptimizationTrackingApi,
  type OptimizationWebConfig,
  type TrackCurrentPageOptions,
} from './ContentfulOptimization'
import {
  hydrateOptimizationHandoffState,
  shouldPreserveDurableContinuity,
  type AnalyticsOptimizationHandoff,
} from './handoff'

const logger = createScopedLogger('Web:AnalyticsHandoff')

const runtimeSdks = new WeakMap<OptimizationAnalyticsRuntime, ContentfulOptimization>()
let latestAnalyticsHandoffHydration = 0

/**
 * Options used when hydrating an analytics-only handoff.
 *
 * @public
 */
export interface HydrateOptimizationAnalyticsHandoffOptions {
  /** Stable route identity used for current-page deduplication. */
  readonly routeKey: string
  /** Builds the browser page payload when `handoff.initialPageEvent` is `emit`. */
  readonly buildPagePayload: TrackCurrentPageOptions['buildPayload']
  /** Cancels async hydration before state apply or page tracking. */
  readonly isCurrent?: () => boolean
}

/**
 * Browser runtime surface for analytics-only optimized markup.
 *
 * @public
 */
export interface OptimizationAnalyticsRuntime {
  /** Entry interaction tracking controls backed by existing `data-ctfl-*` attributes. */
  readonly tracking: OptimizationTrackingApi
  /** Flush queued analytics work. */
  flush: () => Promise<void>
  /** Track the current route with the same semantics as the full Web SDK. */
  trackCurrentPage: ContentfulOptimization['trackCurrentPage']
  /** Release browser listeners and queued runtime resources. */
  destroy: () => void
}

function getRuntimeSdk(runtime: OptimizationAnalyticsRuntime): ContentfulOptimization {
  const sdk = runtimeSdks.get(runtime)

  if (sdk === undefined) {
    throw new TypeError('Unknown Optimization analytics runtime.')
  }

  return sdk
}

function hasProfileContinuity(sdk: ContentfulOptimization): boolean {
  return sdk.states.persistenceConsent.current === true && sdk.states.profile.current !== undefined
}

function warnSkippedInitialPageWithoutProfileContinuity(
  sdk: ContentfulOptimization,
  handoff: AnalyticsOptimizationHandoff,
): void {
  if (handoff.initialPageEvent !== 'skip') return
  if (handoff.state?.profile !== undefined || hasProfileContinuity(sdk)) return

  logger.warn(
    'Analytics-only handoff skipped the initial page event without handoff profile state or browser profile continuity.',
  )
}

function assertAnalyticsHandoff(handoff: AnalyticsOptimizationHandoff): void {
  const hydration: unknown = handoff.hydration

  if (hydration === 'analytics-only') return

  throw new TypeError(
    'hydrateOptimizationAnalyticsHandoff only accepts analytics-only optimization handoffs.',
  )
}

function assertInitialPageEvent(initialPageEvent: unknown): void {
  if (initialPageEvent === 'emit' || initialPageEvent === 'skip') return

  throw new TypeError('Optimization handoff requires initialPageEvent to be "emit" or "skip".')
}

/**
 * Initialize the analytics-only browser runtime.
 *
 * @param config - Web SDK configuration used for consent, queues, profile continuity, and events.
 * @returns Single analytics runtime surface that does not expose content resolution APIs.
 *
 * @public
 */
export function initializeOptimizationAnalyticsRuntime(
  config: OptimizationWebConfig,
): OptimizationAnalyticsRuntime {
  const sdk = new ContentfulOptimization(config)

  if (typeof window !== 'undefined' && window.contentfulOptimization === sdk) {
    delete window.contentfulOptimization
  }

  const runtime: OptimizationAnalyticsRuntime = {
    destroy: () => {
      sdk.destroy()
    },
    flush: async () => {
      await sdk.flush()
    },
    trackCurrentPage: async (options) => await sdk.trackCurrentPage(options),
    tracking: sdk.tracking,
  }

  runtimeSdks.set(runtime, sdk)

  return runtime
}

/**
 * Hydrate analytics-only browser state and emit or mark the current page event.
 *
 * @param runtime - Analytics runtime returned by {@link initializeOptimizationAnalyticsRuntime}.
 * @param handoff - Analytics-only browser handoff.
 * @param options - Route identity and page payload builder for initial browser page tracking.
 *
 * @public
 */
export async function hydrateOptimizationAnalyticsHandoff(
  runtime: OptimizationAnalyticsRuntime,
  handoff: AnalyticsOptimizationHandoff,
  options: HydrateOptimizationAnalyticsHandoffOptions,
): Promise<void> {
  assertAnalyticsHandoff(handoff)
  assertInitialPageEvent(handoff.initialPageEvent)
  assertOptimizationCacheSafety(handoff)
  const sdk = getRuntimeSdk(runtime)
  latestAnalyticsHandoffHydration += 1
  const hydration = latestAnalyticsHandoffHydration
  const isCurrent = (): boolean =>
    hydration === latestAnalyticsHandoffHydration && options.isCurrent?.() !== false

  await hydrateOptimizationHandoffState(sdk, handoff.state, {
    isCurrent,
    suppressDurableContinuityPersistence: shouldPreserveDurableContinuity(handoff),
  })
  if (!isCurrent()) return

  warnSkippedInitialPageWithoutProfileContinuity(sdk, handoff)

  if (!isCurrent()) return

  await runtime.trackCurrentPage({
    buildPayload: options.buildPagePayload,
    initialPageEvent: handoff.initialPageEvent,
    routeKey: options.routeKey,
  })
}

export type { AnalyticsOptimizationHandoff }
