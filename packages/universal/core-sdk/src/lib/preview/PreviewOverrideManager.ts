import type {
  OptimizationData,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { Signal } from '../../signals'
import { applyOptimizationOverrides } from './applyOptimizationOverrides'
import type { OptimizationOverride, OverrideState } from './types'

/**
 * Minimal interface for registering and removing state interceptors.
 * Uses a structural type rather than the `InterceptorManager` class to avoid
 * nominal incompatibility when the class is resolved from different paths.
 *
 * @public
 */
export interface StateInterceptorRegistry<T> {
  add: (interceptor: (value: Readonly<T>) => T | Promise<T>) => number
  remove: (id: number) => boolean
}

const logger = createScopedLogger('PreviewOverrides')

const INITIAL_STATE: OverrideState = {
  audiences: {},
  selectedOptimizations: {},
}

/**
 * Configuration for {@link PreviewOverrideManager}.
 *
 * @public
 */
export interface PreviewOverrideManagerConfig {
  /** Signal for selected optimizations (variant selections). */
  selectedOptimizations: Signal<SelectedOptimizationArray | undefined>

  /** The state interceptor registry to register with. */
  stateInterceptors: StateInterceptorRegistry<OptimizationData>

  /**
   * Callback invoked whenever override state changes.
   * RN uses this to trigger setState; the iOS bridge can use it
   * to notify the native side.
   */
  onOverridesChanged?: (state: Readonly<OverrideState>) => void
}

/**
 * Platform-agnostic manager for preview panel overrides.
 *
 * Registers a state interceptor that preserves overrides across API refreshes
 * and provides methods to activate/deactivate audiences and set variant
 * overrides. Always derives the signal value from a clean API baseline plus
 * current overrides — never reads from the (possibly stale) signal.
 *
 * @remarks
 * Intended to be wrapped by platform-specific layers:
 * - React Native: the `useProfileOverrides` hook
 * - iOS: the JSC bridge override methods
 *
 * @public
 */
export class PreviewOverrideManager {
  private baselineSelectedOptimizations: SelectedOptimizationArray | null = null
  private overrides: OverrideState = { ...INITIAL_STATE, audiences: {}, selectedOptimizations: {} }
  private interceptorId: number | null = null

  private readonly selectedOptimizations: Signal<SelectedOptimizationArray | undefined>
  private readonly stateInterceptors: StateInterceptorRegistry<OptimizationData>
  private readonly onOverridesChanged?: PreviewOverrideManagerConfig['onOverridesChanged']

  constructor(config: PreviewOverrideManagerConfig) {
    const { selectedOptimizations, stateInterceptors, onOverridesChanged } = config
    this.selectedOptimizations = selectedOptimizations
    this.stateInterceptors = stateInterceptors
    this.onOverridesChanged = onOverridesChanged

    // Capture current signal state as the initial baseline so we have
    // data to restore to even if no API calls happen after construction.
    const { value: initialSelectedOptimizations } = selectedOptimizations
    if (initialSelectedOptimizations) {
      this.baselineSelectedOptimizations = initialSelectedOptimizations
      logger.debug('Captured initial signal state as baseline')
    }

    // Register state interceptor to preserve overrides when API responses arrive
    this.interceptorId = config.stateInterceptors.add(
      (data: Readonly<OptimizationData>): OptimizationData => {
        // Cache the un-overridden selectedOptimizations as the new baseline
        const { selectedOptimizations: incoming } = data
        this.baselineSelectedOptimizations = incoming

        // If no optimization overrides, pass through unchanged
        if (Object.keys(this.overrides.selectedOptimizations).length === 0) {
          return { ...data }
        }

        logger.debug('Intercepting state update to preserve overrides')

        // Merge API response with current overrides
        return {
          ...data,
          selectedOptimizations: applyOptimizationOverrides(
            data.selectedOptimizations,
            this.overrides.selectedOptimizations,
          ),
        }
      },
    )

    logger.info('State interceptor registered')
  }

  // ---------------------------------------------------------------------------
  // Audience actions
  // ---------------------------------------------------------------------------

  /**
   * Activate an audience override and set all associated experiences to
   * variant index 1 (first non-baseline variant).
   */
  activateAudience(audienceId: string, experienceIds: string[]): void {
    logger.info('Activating audience override:', audienceId)
    this.setAudienceOverride(audienceId, true, 1, experienceIds)
  }

  /**
   * Deactivate an audience override and set all associated experiences to
   * variant index 0 (baseline).
   */
  deactivateAudience(audienceId: string, experienceIds: string[]): void {
    logger.info('Deactivating audience override:', audienceId)
    this.setAudienceOverride(audienceId, false, 0, experienceIds)
  }

  /**
   * Reset a specific audience override and its associated experience overrides.
   * Recomputes the signal from the clean baseline.
   */
  resetAudienceOverride(audienceId: string): void {
    logger.info('Resetting audience override:', audienceId)

    const { overrides } = this
    const { audiences, selectedOptimizations: currentOptOverrides } = overrides
    const storedExperienceIds = audiences[audienceId]?.experienceIds ?? []
    const experienceIdSet = new Set(storedExperienceIds)

    const newSelectedOptimizations = Object.fromEntries(
      Object.entries(currentOptOverrides).filter(([key]) => !experienceIdSet.has(key)),
    ) as Record<string, OptimizationOverride>

    const remainingAudiences = Object.fromEntries(
      Object.entries(audiences).filter(([key]) => key !== audienceId),
    )

    this.overrides = {
      audiences: remainingAudiences as typeof audiences,
      selectedOptimizations: newSelectedOptimizations,
    }

    if (storedExperienceIds.length > 0) {
      this.syncOverridesToSignal()
    }
    this.notifyChanged()
  }

  // ---------------------------------------------------------------------------
  // Variant actions
  // ---------------------------------------------------------------------------

  /**
   * Override a single experience's variant selection.
   */
  setVariantOverride(experienceId: string, variantIndex: number): void {
    logger.info('Setting variant override:', { experienceId, variantIndex })

    this.overrides = {
      ...this.overrides,
      selectedOptimizations: {
        ...this.overrides.selectedOptimizations,
        [experienceId]: { experienceId, variantIndex },
      },
    }

    this.syncOverridesToSignal()
    this.notifyChanged()
  }

  /**
   * Reset a single experience's variant override.
   */
  resetOptimizationOverride(experienceId: string): void {
    logger.info('Resetting optimization override:', experienceId)

    const { selectedOptimizations: currentOpts } = { ...this.overrides }
    const remaining = Object.fromEntries(
      Object.entries(currentOpts).filter(([key]) => key !== experienceId),
    ) as Record<string, OptimizationOverride>

    this.overrides = {
      ...this.overrides,
      selectedOptimizations: remaining,
    }

    this.syncOverridesToSignal()
    this.notifyChanged()
  }

  // ---------------------------------------------------------------------------
  // Global actions
  // ---------------------------------------------------------------------------

  /**
   * Clear all overrides and restore the `selectedOptimizations` signal to the
   * clean API baseline.
   */
  resetAll(): void {
    logger.info('Resetting all overrides to baseline')

    this.overrides = { audiences: {}, selectedOptimizations: {} }

    // Restore signal to baseline
    const { baselineSelectedOptimizations } = this
    if (baselineSelectedOptimizations) {
      this.selectedOptimizations.value = baselineSelectedOptimizations
      logger.debug('Restored signal to baseline')
    }

    this.notifyChanged()
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** Returns the current override state (read-only). */
  getOverrides(): Readonly<OverrideState> {
    return this.overrides
  }

  /** Returns the cached baseline selected optimizations, or null if no baseline yet. */
  getBaselineSelectedOptimizations(): Readonly<SelectedOptimizationArray> | null {
    return this.baselineSelectedOptimizations
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Remove the state interceptor and clear all internal state.
   * Call this when the preview panel is unmounted or destroyed.
   */
  destroy(): void {
    if (this.interceptorId !== null) {
      this.stateInterceptors.remove(this.interceptorId)
      logger.info('State interceptor removed')
      this.interceptorId = null
    }

    this.overrides = { audiences: {}, selectedOptimizations: {} }
    this.baselineSelectedOptimizations = null
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Recompute the signal from the clean API baseline + current overrides.
   * Never reads from the current signal — always derives from baseline.
   */
  private syncOverridesToSignal(): void {
    this.selectedOptimizations.value = applyOptimizationOverrides(
      this.baselineSelectedOptimizations ?? [],
      this.overrides.selectedOptimizations,
    )
    logger.debug('Synced overrides to signal')
  }

  private setAudienceOverride(
    audienceId: string,
    isActive: boolean,
    variantIndex: number,
    experienceIds: string[],
  ): void {
    const newSelectedOptimizations = { ...this.overrides.selectedOptimizations }
    for (const expId of experienceIds) {
      newSelectedOptimizations[expId] = { experienceId: expId, variantIndex }
    }

    this.overrides = {
      audiences: {
        ...this.overrides.audiences,
        [audienceId]: {
          audienceId,
          isActive,
          source: 'manual',
          experienceIds,
        },
      },
      selectedOptimizations: newSelectedOptimizations,
    }

    if (experienceIds.length > 0) {
      this.syncOverridesToSignal()
    }
    this.notifyChanged()
  }

  private notifyChanged(): void {
    this.onOverridesChanged?.(this.overrides)
  }
}
