import {
  batch,
  hasOptimizationSelectionStateField,
  mergeOptimizationSelectionState,
  signals,
  type OptimizationSelectionState,
} from '@contentful/optimization-core'
import type {
  BrowserOptimizationHandoff,
  OptimizationHandoffHydrationOptions,
  OptimizationHandoffHydrationTarget,
} from './handoff'
import {
  preserveProfilelessHandoffDurableContinuity,
  suppressDurableContinuityPersistence,
} from './storage/durableContinuityPersistence'

type BrowserOptimizationHandoffState = NonNullable<BrowserOptimizationHandoff['state']>

interface BrowserHandoffStateInterceptorRunner {
  readonly run: (
    state: BrowserOptimizationHandoffState,
    merge?: typeof mergeOptimizationSelectionState,
  ) => Promise<BrowserOptimizationHandoffState>
}

interface InternalHandoffStateHydrationOptions extends OptimizationHandoffHydrationOptions {
  readonly authoritativeStateHydration?: boolean
  readonly suppressDurableContinuityPersistence?: boolean
}

interface HydratedSignalUpdate {
  readonly generation: number
  readonly hasChanges: boolean
  readonly hasProfile: boolean
  readonly hasSelectedOptimizations: boolean
  readonly options: InternalHandoffStateHydrationOptions
  readonly sdk: OptimizationHandoffHydrationTarget
  readonly state: BrowserOptimizationHandoffState
}

interface HandoffRuntimeState {
  generation: number
}

type HandoffRuntimeGlobal = typeof globalThis & {
  __ctfl_optimization_handoff_runtime__?: HandoffRuntimeState
}

const CONTENT_STATE_RESET: OptimizationSelectionState = {
  changes: undefined,
  selectedOptimizations: undefined,
}

function getHandoffRuntimeState(): HandoffRuntimeState {
  const runtimeGlobal = globalThis as HandoffRuntimeGlobal
  runtimeGlobal.__ctfl_optimization_handoff_runtime__ ??= { generation: 0 }

  return runtimeGlobal.__ctfl_optimization_handoff_runtime__
}

function hasBrowserHandoffStateInterceptorRunner(
  value: unknown,
): value is BrowserHandoffStateInterceptorRunner {
  if (value === null || typeof value !== 'object') return false
  if (!('run' in value)) return false

  return typeof value.run === 'function'
}

function isCurrentHydration(
  generation: number,
  options: OptimizationHandoffHydrationOptions,
): boolean {
  return options.isCurrent?.() !== false && generation === getHandoffRuntimeState().generation
}

function applyHydratedSignals({
  generation,
  hasChanges,
  hasProfile,
  hasSelectedOptimizations,
  options,
  sdk,
  state,
}: HydratedSignalUpdate): boolean {
  if (!isCurrentHydration(generation, options)) return false

  const { changes, profile, selectedOptimizations } = state
  const {
    changes: changesSignal,
    experienceRequestState,
    profile: profileSignal,
    selectedOptimizations: selectedOptimizationsSignal,
  } = signals

  const updateSignals = (): void => {
    const authoritativeState = {
      ...(hasChanges ? { changes } : {}),
      ...(hasProfile ? { profile } : {}),
      ...(hasSelectedOptimizations ? { selectedOptimizations } : {}),
    }
    if (
      options.authoritativeStateHydration === true &&
      sdk.applyOptimizationHandoffState !== undefined
    ) {
      sdk.applyOptimizationHandoffState(authoritativeState)
      return
    }

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
    return true
  }

  updateSignals()
  return true
}

function applySuccessfulEmptyHandoffHydration(
  sdk: OptimizationHandoffHydrationTarget,
  generation: number,
  options: InternalHandoffStateHydrationOptions,
): boolean {
  return applyHydratedSignals({
    generation,
    hasChanges: true,
    hasProfile: false,
    hasSelectedOptimizations: true,
    options,
    sdk,
    state: CONTENT_STATE_RESET,
  })
}

export async function hydrateOptimizationHandoffStateInternal(
  sdk: OptimizationHandoffHydrationTarget,
  state: BrowserOptimizationHandoff['state'],
  options: InternalHandoffStateHydrationOptions = {},
): Promise<boolean> {
  if (options.isCurrent?.() === false) return false

  const handoffRuntime = getHandoffRuntimeState()
  handoffRuntime.generation += 1
  const { generation } = handoffRuntime

  if (!state) {
    return applySuccessfulEmptyHandoffHydration(sdk, generation, options)
  }

  const hasChanges = hasOptimizationSelectionStateField(state, 'changes')
  const hasProfile = hasOptimizationSelectionStateField(state, 'profile')
  const hasSelectedOptimizations = hasOptimizationSelectionStateField(
    state,
    'selectedOptimizations',
  )
  if (!hasChanges && !hasProfile && !hasSelectedOptimizations) {
    return applySuccessfulEmptyHandoffHydration(sdk, generation, options)
  }

  const inputState = mergeOptimizationSelectionState(CONTENT_STATE_RESET, state)

  const stateInterceptors: unknown = sdk.interceptors.state
  if (!hasBrowserHandoffStateInterceptorRunner(stateInterceptors)) {
    throw new Error('Contentful Optimization SDK instance does not expose state hydration support.')
  }

  const hydratedState = await stateInterceptors.run(inputState, mergeOptimizationSelectionState)
  const mergedState = mergeOptimizationSelectionState(inputState, hydratedState)

  return applyHydratedSignals({
    generation,
    hasChanges: hasOptimizationSelectionStateField(mergedState, 'changes'),
    hasProfile: hasOptimizationSelectionStateField(mergedState, 'profile'),
    hasSelectedOptimizations: hasOptimizationSelectionStateField(
      mergedState,
      'selectedOptimizations',
    ),
    options,
    sdk,
    state: mergedState,
  })
}
