import {
  assertOptimizationCacheSafety,
  batch,
  hasOptimizationSelectionStateField,
  mergeOptimizationSelectionState,
  signals,
  type EventEmissionResult,
  type OptimizationHandoff,
  type OptimizationSelectionState,
} from '@contentful/optimization-core'
import type { HandoffStateHydrationOptions, OptimizationHandoffHydrationTarget } from './handoff'
import {
  preserveProfilelessHandoffDurableContinuity,
  suppressDurableContinuityPersistence,
} from './storage/durableContinuityPersistence'

const CONTENT_STATE_RESET: OptimizationSelectionState = {
  changes: undefined,
  selectedOptimizations: undefined,
}

let latestHandoffStateHydration = 0

/** The current initialization only; admitted batches remain owned by Core's queue. @internal */
export interface HandoffInitialization {
  readonly key: string | OptimizationHandoff
  readonly routeKey: string
  readonly isCurrent: () => boolean
  hydration?: Promise<void>
  delivery?: Promise<EventEmissionResult>
}

let currentHandoffInitialization: HandoffInitialization | undefined = undefined

/** Join current work before seeding state, including state-only framework initialization. @internal */
export function getHandoffInitialization(
  handoff: OptimizationHandoff,
  routeKey: string,
): HandoffInitialization {
  const key = handoff.replay?.events.at(-1)?.messageId ?? handoff
  const current = currentHandoffInitialization
  if (current?.routeKey === routeKey && current.key === key) return current

  const initialization: HandoffInitialization = {
    key,
    routeKey,
    isCurrent: () => currentHandoffInitialization === initialization,
  }
  currentHandoffInitialization = initialization
  return initialization
}

/** Invalidate unfinished hydration when the SDK resets, is cleared or is destroyed. @internal */
export function clearHandoffInitialization(routeKey?: string): boolean {
  if (routeKey !== undefined && currentHandoffInitialization?.routeKey === routeKey) return false
  const hadInitialization = currentHandoffInitialization !== undefined
  currentHandoffInitialization = undefined
  latestHandoffStateHydration += 1
  return hadInitialization
}

function shouldContinueHydration(options: HandoffStateHydrationOptions): boolean {
  return options.isCurrent?.() !== false
}

/**
 * @internal
 */
export function shouldPreserveDurableContinuity(handoff: OptimizationHandoff): boolean {
  return (
    (handoff.cache.scope === 'public-permutation' || handoff.cache.scope === 'static') &&
    handoff.state?.profile === undefined
  )
}

function applyHydratedSignals(
  state: OptimizationSelectionState,
  options: HandoffStateHydrationOptions,
): void {
  const { changes, profile, selectedOptimizations } = state
  const {
    changes: changesSignal,
    experienceRequestState,
    profile: profileSignal,
    selectedOptimizations: selectedOptimizationsSignal,
  } = signals

  const updateSignals = (): void => {
    batch(() => {
      changesSignal.value = changes
      if (hasOptimizationSelectionStateField(state, 'profile')) profileSignal.value = profile
      selectedOptimizationsSignal.value = selectedOptimizations

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

  applyHydratedSignals(CONTENT_STATE_RESET, options)
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
  state: OptimizationHandoff['state'],
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

  const {
    interceptors: { state: stateInterceptors },
  } = sdk

  const hydratedState = await stateInterceptors
    .run(inputState, mergeOptimizationSelectionState)
    .catch((error: unknown) => {
      if (hydration === latestHandoffStateHydration) throw error
      return undefined
    })

  if (hydratedState === undefined || hydration !== latestHandoffStateHydration) return
  if (!shouldContinueHydration(options)) return

  const mergedState = mergeOptimizationSelectionState(inputState, hydratedState)

  applyHydratedSignals(mergedState, options)
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
  handoff: OptimizationHandoff,
  options: { readonly routeKey?: string; readonly isCurrent?: () => boolean } = {},
): Promise<void> {
  assertOptimizationCacheSafety(handoff)
  const routeKey =
    options.routeKey ??
    (typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`)
  const initialization = getHandoffInitialization(handoff, routeKey)
  if (handoff.replay !== undefined && handoff.replay.routeKey !== routeKey) return
  initialization.hydration ??= hydrateOptimizationHandoffState(sdk, handoff.state, {
    isCurrent: () => initialization.isCurrent() && options.isCurrent?.() !== false,
    suppressDurableContinuityPersistence: shouldPreserveDurableContinuity(handoff),
  }).catch((error: unknown) => {
    initialization.hydration = undefined
    throw error
  })
  await initialization.hydration
  if (options.isCurrent?.() === false) initialization.hydration = undefined
}
