import type {
  ChangeArray,
  OptimizationData,
  OptimizationEntry,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import { batch, type Signal } from '@preact/signals-core'
import type { InterceptorManager } from '../lib/interceptor'
import { applyChangeOverrides } from './applyChangeOverrides'
import { applyOptimizationOverrides } from './applyOptimizationOverrides'
import type { OptimizationOverride, OverrideState } from './types'

const logger = createScopedLogger('PreviewOverrides')

/**
 * Subset of {@link InterceptorManager} consumed by the preview override
 * manager. Picking only the public methods (`add` / `remove`) avoids the
 * nominal-typing mismatch that can arise when a consumer passes
 * an `InterceptorManager` resolved from one bundle (e.g. the package root)
 * into a `PreviewOverrideManager` typed via a different bundle (e.g. the
 * `./preview-support` entry point), since `InterceptorManager`'s `private`
 * fields are emitted into each bundled `.d.ts` separately.
 */
type StateInterceptorAccess<T> = Pick<InterceptorManager<T>, 'add' | 'remove'>

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

  /**
   * Optional profile signal. When provided, the manager snapshots the user's
   * natural qualification for each audience (via `profile.audiences.includes(id)`)
   * on the first override of that audience. Exposed via
   * {@link PreviewOverrideManager.getBaselineAudienceQualifications} so the preview
   * panel can surface "was naturally qualified: yes/no" alongside the override.
   */
  profile?: Signal<Profile | undefined>

  /**
   * Optional `changes` signal. When provided alongside {@link optimizationEntries},
   * the manager keeps inline-variable Variable changes in sync with overrides on
   * every mutation and on every API refresh — so `getFlag()` consumers see the
   * preview-selected variant value without a round-trip.
   */
  changes?: Signal<ChangeArray | undefined>

  /**
   * Optional provider for the optimization entries the panel knows about.
   * Required to coordinate {@link changes}; the manager uses each entry's
   * `nt_config.components` to translate variant overrides into Variable changes.
   * Implemented as a function so callers can return an up-to-date list as the
   * panel fetches additional entries.
   */
  optimizationEntries?: () => readonly OptimizationEntry[]

  /** The state interceptor registry to register with. */
  stateInterceptors: StateInterceptorAccess<OptimizationData>

  /**
   * Callback invoked whenever override state changes.
   * RN uses this to trigger setState; the iOS bridge uses it to
   * notify the native side via a global callback.
   */
  onOverridesChanged: (state: Readonly<OverrideState>) => void
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
  private baselineChanges: ChangeArray | null = null
  private baselineAudienceQualifications: Record<string, boolean> = {}
  private overrides: OverrideState = { ...INITIAL_STATE, audiences: {}, selectedOptimizations: {} }
  private interceptorId: number | null = null

  private readonly selectedOptimizations: Signal<SelectedOptimizationArray | undefined>
  private readonly changes: Signal<ChangeArray | undefined> | undefined
  private readonly optimizationEntries: (() => readonly OptimizationEntry[]) | undefined
  private readonly profile: Signal<Profile | undefined> | undefined
  private readonly stateInterceptors: StateInterceptorAccess<OptimizationData>
  private readonly onOverridesChanged: ((state: Readonly<OverrideState>) => void) | undefined

  constructor(config: PreviewOverrideManagerConfig) {
    const {
      selectedOptimizations,
      changes,
      optimizationEntries,
      profile,
      stateInterceptors,
      onOverridesChanged,
    } = config
    this.selectedOptimizations = selectedOptimizations
    this.changes = changes
    this.optimizationEntries = optimizationEntries
    this.profile = profile
    this.stateInterceptors = stateInterceptors
    this.onOverridesChanged = onOverridesChanged

    // Capture current signal state as the initial baseline so we have
    // data to restore to even if no API calls happen after construction.
    const { value: initialSelectedOptimizations } = selectedOptimizations
    if (initialSelectedOptimizations) {
      this.baselineSelectedOptimizations = initialSelectedOptimizations
      logger.debug('Captured initial signal state as baseline')
    }

    if (changes) {
      const { value: initialChanges } = changes
      if (initialChanges) this.baselineChanges = initialChanges
    }

    // Register state interceptor to preserve overrides when API responses arrive
    this.interceptorId = config.stateInterceptors.add(
      (data: Readonly<OptimizationData>): OptimizationData => {
        // Cache the un-overridden state as the new baseline
        const { selectedOptimizations: incomingSelected, changes: incomingChanges } = data
        this.baselineSelectedOptimizations = incomingSelected
        this.baselineChanges = incomingChanges

        const hasOverrides = Object.keys(this.overrides.selectedOptimizations).length > 0
        const next: OptimizationData = hasOverrides
          ? {
              ...data,
              selectedOptimizations: applyOptimizationOverrides(
                data.selectedOptimizations,
                this.overrides.selectedOptimizations,
              ),
              changes: this.deriveChanges(data.changes),
            }
          : { ...data }

        if (hasOverrides) logger.debug('Intercepting state update to preserve overrides')

        // Fire the change callback on every API refresh so consumers can pull a
        // fresh snapshot of derived preview state (audience qualification,
        // current variant selection, etc.) — not just when an override mutates.
        this.notifyChanged()

        return next
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

    this.baselineAudienceQualifications = Object.fromEntries(
      Object.entries(this.baselineAudienceQualifications).filter(([key]) => key !== audienceId),
    )

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
   * Clear all overrides and restore the tracked signals to their clean
   * API baselines.
   */
  resetAll(): void {
    logger.info('Resetting all overrides to baseline')

    this.overrides = { audiences: {}, selectedOptimizations: {} }
    this.baselineAudienceQualifications = {}

    const { baselineSelectedOptimizations, baselineChanges, changes } = this
    if (baselineSelectedOptimizations) {
      if (changes && baselineChanges) {
        batch(() => {
          this.selectedOptimizations.value = baselineSelectedOptimizations
          changes.value = baselineChanges
        })
      } else {
        this.selectedOptimizations.value = baselineSelectedOptimizations
      }
      logger.debug('Restored signals to baseline')
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

  /** Returns the cached baseline changes array, or null if no baseline yet. */
  getBaselineChanges(): Readonly<ChangeArray> | null {
    return this.baselineChanges
  }

  /**
   * Returns the pre-override audience qualification snapshot — a map from
   * `audienceId` to whether the user was naturally in that audience (`profile.audiences`
   * membership) at the moment the first override for that id was applied.
   * Empty when no `profile` signal was passed to the constructor, or when no
   * audience has been overridden since construction / last `resetAll()`.
   */
  getBaselineAudienceQualifications(): Readonly<Record<string, boolean>> {
    return this.baselineAudienceQualifications
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
    this.baselineChanges = null
    this.baselineAudienceQualifications = {}
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Capture the user's natural qualification for `audienceId` — read from
   * `profile.audiences` — the first time this audience is overridden.
   * Subsequent calls for the same id are no-ops so the baseline reflects the
   * *pre-override* state, not the most recent override's pre-flip state.
   *
   * When the manager was constructed without a `profile` signal, snapshots are
   * skipped entirely. This preserves backward compatibility for consumers that
   * don't hook the profile signal up.
   */
  private snapshotAudienceQualification(audienceId: string): void {
    if (!this.profile) return
    if (audienceId in this.baselineAudienceQualifications) return
    const wasQualified = this.profile.value?.audiences.includes(audienceId) ?? false
    this.baselineAudienceQualifications[audienceId] = wasQualified
  }

  /**
   * Recompute the tracked signals from their clean API baselines + current
   * overrides. Both writes happen inside one signals batch so subscribers
   * never observe a half-updated state. Never reads from the current
   * signal values — always derives from the cached baselines.
   */
  private syncOverridesToSignal(): void {
    const nextSelected = applyOptimizationOverrides(
      this.baselineSelectedOptimizations ?? [],
      this.overrides.selectedOptimizations,
    )

    if (this.changes) {
      const nextChanges = this.deriveChanges(this.baselineChanges ?? [])
      batch(() => {
        this.selectedOptimizations.value = nextSelected
        if (this.changes) this.changes.value = nextChanges
      })
    } else {
      this.selectedOptimizations.value = nextSelected
    }

    logger.debug('Synced overrides to signals')
  }

  /**
   * Translate the current variant overrides into Variable changes and merge
   * them into the supplied baseline `changes` array. Returns the input
   * unchanged when the manager wasn't given an `optimizationEntries` provider.
   */
  private deriveChanges(baseline: ChangeArray): ChangeArray {
    if (!this.optimizationEntries) return baseline
    return applyChangeOverrides(
      baseline,
      this.optimizationEntries(),
      this.overrides.selectedOptimizations,
    )
  }

  private setAudienceOverride(
    audienceId: string,
    isActive: boolean,
    variantIndex: number,
    experienceIds: string[],
  ): void {
    this.snapshotAudienceQualification(audienceId)

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
