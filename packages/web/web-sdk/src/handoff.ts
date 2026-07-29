/**
 * Browser-facing optimization handoff helpers.
 *
 * @packageDocumentation
 */

import {
  assertOptimizationCacheSafety,
  batch,
  hasOptimizationSelectionStateField,
  mergeOptimizationSelectionState,
  signals,
  type OptimizationHandoff,
  type OptimizationSelectionState,
} from '@contentful/optimization-core'
import {
  preserveProfilelessHandoffDurableContinuity,
  suppressDurableContinuityPersistence,
} from './storage/durableContinuityPersistence'

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

type BrowserOptimizationHandoffState = NonNullable<BrowserOptimizationHandoff['state']>

interface BrowserHandoffStateInterceptorRunner {
  readonly run: (
    state: BrowserOptimizationHandoffState,
    merge?: typeof mergeOptimizationSelectionState,
  ) => Promise<BrowserOptimizationHandoffState>
}

/**
 * @internal
 */
export interface HandoffStateHydrationOptions {
  readonly isCurrent?: () => boolean
  readonly suppressDurableContinuityPersistence?: boolean
}

interface HydratedSignalUpdate {
  readonly hasChanges: boolean
  readonly hasProfile: boolean
  readonly hasSelectedOptimizations: boolean
  readonly options: HandoffStateHydrationOptions
  readonly state: BrowserOptimizationHandoffState
}

const CONTENT_STATE_RESET: OptimizationSelectionState = {
  changes: undefined,
  selectedOptimizations: undefined,
}

/**
 * Minimal Web SDK shape required for browser handoff hydration.
 *
 * @public
 */
export interface OptimizationHandoffHydrationTarget {
  readonly interceptors: {
    readonly state: unknown
  }
}

const CONTENT_HYDRATION_MODES: readonly ContentOptimizationHydrationMode[] = [
  'preserve-server',
  'client-only-hidden-until-ready',
]

let latestHandoffStateHydration = 0

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

function hasBrowserHandoffStateInterceptorRunner(
  value: unknown,
): value is BrowserHandoffStateInterceptorRunner {
  if (value === null || typeof value !== 'object') return false
  if (!('run' in value)) return false

  return typeof value.run === 'function'
}

function shouldContinueHydration(options: HandoffStateHydrationOptions): boolean {
  return options.isCurrent?.() !== false
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

function applyHydratedSignals({
  hasChanges,
  hasProfile,
  hasSelectedOptimizations,
  options,
  state,
}: HydratedSignalUpdate): void {
  const { changes, profile, selectedOptimizations } = state
  const {
    changes: changesSignal,
    experienceRequestState,
    profile: profileSignal,
    selectedOptimizations: selectedOptimizationsSignal,
  } = signals

  const updateSignals = (): void => {
    batch(() => {
      if (hasChanges) changesSignal.value = changes
      if (hasProfile) profileSignal.value = profile
      if (hasSelectedOptimizations) selectedOptimizationsSignal.value = selectedOptimizations

      experienceRequestState.value = { status: 'success' }
    })
  }

  if (options.suppressDurableContinuityPersistence === true) {
    preserveProfilelessHandoffDurableContinuity()
    suppressDurableContinuityPersistence(updateSignals)
    return
  }

  updateSignals()
}

function applySuccessfulEmptyHandoffHydration(options: HandoffStateHydrationOptions): void {
  if (!shouldContinueHydration(options)) return

  applyHydratedSignals({
    hasChanges: true,
    hasProfile: false,
    hasSelectedOptimizations: true,
    options,
    state: CONTENT_STATE_RESET,
  })
}

async function hydrateOptimizationHandoffStateInternal(
  sdk: OptimizationHandoffHydrationTarget,
  state: BrowserOptimizationHandoff['state'],
  options: HandoffStateHydrationOptions = {},
): Promise<void> {
  latestHandoffStateHydration += 1
  const hydration = latestHandoffStateHydration

  if (!state) {
    applySuccessfulEmptyHandoffHydration(options)
    return
  }

  const hasChanges = hasOptimizationSelectionStateField(state, 'changes')
  const hasProfile = hasOptimizationSelectionStateField(state, 'profile')
  const hasSelectedOptimizations = hasOptimizationSelectionStateField(
    state,
    'selectedOptimizations',
  )
  if (!hasChanges && !hasProfile && !hasSelectedOptimizations) {
    applySuccessfulEmptyHandoffHydration(options)
    return
  }

  const inputState = mergeOptimizationSelectionState(CONTENT_STATE_RESET, state)

  const stateInterceptors: unknown = sdk.interceptors.state
  if (!hasBrowserHandoffStateInterceptorRunner(stateInterceptors)) {
    throw new Error('Contentful Optimization SDK instance does not expose state hydration support.')
  }

  const hydratedState = await stateInterceptors
    .run(inputState, mergeOptimizationSelectionState)
    .catch((error: unknown) => {
      if (hydration === latestHandoffStateHydration) throw error
      return undefined
    })

  if (hydratedState === undefined || hydration !== latestHandoffStateHydration) return
  if (!shouldContinueHydration(options)) return

  const mergedState = mergeOptimizationSelectionState(inputState, hydratedState)

  applyHydratedSignals({
    hasChanges: hasOptimizationSelectionStateField(mergedState, 'changes'),
    hasProfile: hasOptimizationSelectionStateField(mergedState, 'profile'),
    hasSelectedOptimizations: hasOptimizationSelectionStateField(
      mergedState,
      'selectedOptimizations',
    ),
    options,
    state: mergedState,
  })
}

/**
 * Hydrate a live Web SDK from public browser handoff state.
 *
 * @param sdk - Live Web SDK instance to hydrate.
 * @param state - Public browser handoff state.
 *
 * @public
 */
export async function hydrateOptimizationHandoffState(
  sdk: OptimizationHandoffHydrationTarget,
  state: BrowserOptimizationHandoff['state'],
  options: HandoffStateHydrationOptions = {},
): Promise<void> {
  await hydrateOptimizationHandoffStateInternal(sdk, state, options)
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
  sdk: OptimizationHandoffHydrationTarget,
  handoff: ContentOptimizationHandoff,
): Promise<void> {
  assertContentHandoff(handoff)
  assertInitialPageEvent(handoff.initialPageEvent)
  assertOptimizationCacheSafety(handoff)
  await hydrateOptimizationHandoffStateInternal(sdk, handoff.state, {
    suppressDurableContinuityPersistence: shouldPreserveDurableContinuity(handoff),
  })
}
