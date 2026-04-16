import type { PreviewPanelSignalObject, Signals } from '@contentful/optimization-core'
import type {
  OptimizationData,
  SelectedOptimizationArray,
} from '@contentful/optimization-core/api-schemas'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import { PREVIEW_PANEL_SIGNALS_SYMBOL } from '@contentful/optimization-core/symbols'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOptimization } from '../../context/OptimizationContext'
import type {
  AudienceOverride,
  ExperienceDefinition,
  OptimizationOverride,
  OverrideState,
  PreviewActions,
} from '../types'

const logger = createScopedLogger('RN:Preview')

const initialOverrideState: OverrideState = {
  audiences: {},
  selectedOptimizations: {},
}

/**
 * @internal
 */
function applyOptimizationOverrides(
  apiSelectedOptimizations: SelectedOptimizationArray,
  overrides: Record<string, OptimizationOverride>,
): SelectedOptimizationArray {
  const overrideEntries = Object.values(overrides)
  if (overrideEntries.length === 0) return apiSelectedOptimizations

  const overridden = apiSelectedOptimizations.map((selectedOptimization) => {
    const { [selectedOptimization.experienceId]: override } = overrides
    if (override) {
      return {
        ...selectedOptimization,
        variantIndex: override.variantIndex,
      }
    }
    return selectedOptimization
  })

  for (const override of overrideEntries) {
    if (!overridden.some((selected) => selected.experienceId === override.experienceId)) {
      overridden.push({
        experienceId: override.experienceId,
        variantIndex: override.variantIndex,
        variants: {},
      })
    }
  }

  return overridden
}

/**
 * Manages profile and optimization overrides in the preview panel.
 *
 * Registers with the SDK to get direct signal access and sets up a state
 * interceptor to preserve overrides when API responses arrive.
 *
 * @returns An object containing the current override state and available actions
 *
 * @throws Error if called outside of an {@link OptimizationProvider}
 *
 * @internal
 */
export function useProfileOverrides(): {
  overrides: OverrideState
  actions: PreviewActions
} {
  const contentfulOptimization = useOptimization()
  const [overrides, setOverrides] = useState<OverrideState>(initialOverrideState)

  // Store signals reference obtained from SDK registration
  const signalsRef = useRef<Signals | null | undefined>(null)

  // Store interceptor ID for cleanup
  const interceptorIdRef = useRef<number | null>(null)

  // Store current overrides in a ref so the interceptor can access latest values
  const overridesRef = useRef<OverrideState>(initialOverrideState)

  // Store the last un-overridden data from the API
  const lastActualDataRef = useRef<OptimizationData | null>(null)

  // Keep overridesRef in sync with state
  useEffect(() => {
    overridesRef.current = overrides
  }, [overrides])

  // Register with SDK and set up interceptor on mount
  useEffect(() => {
    // Create a preview panel compatible object to receive signals
    const previewPanelObject: PreviewPanelSignalObject = {}

    // Register with the SDK to get signal access
    contentfulOptimization.registerPreviewPanel(previewPanelObject)
    const registeredSignals = Reflect.get(previewPanelObject, PREVIEW_PANEL_SIGNALS_SYMBOL)
    signalsRef.current = registeredSignals

    logger.info('Registered with SDK, signals access obtained')

    // Capture current signal state as the initial "actual" data
    // This ensures we have data to restore to even if no API calls happen after mounting
    if (signalsRef.current && !lastActualDataRef.current) {
      const { current } = signalsRef
      const {
        selectedOptimizations: { value: selectedOptimizations },
        profile: { value: profile },
        changes: { value: changes },
      } = current
      if (selectedOptimizations && profile && changes) {
        const actualData: OptimizationData = {
          selectedOptimizations,
          profile,
          changes,
        }
        lastActualDataRef.current = actualData
        logger.debug('Captured initial signal state as actual data')
      }
    }

    // Register state interceptor to preserve overrides when API responses arrive
    interceptorIdRef.current = contentfulOptimization.interceptors.state.add(
      (data: OptimizationData): OptimizationData => {
        // Cache the un-overridden data
        lastActualDataRef.current = data

        const { current: currentOverrides } = overridesRef

        // If no optimization overrides, pass through unchanged
        if (Object.keys(currentOverrides.selectedOptimizations).length === 0) {
          return data
        }

        logger.debug('Intercepting state update to preserve overrides')

        // Merge API response with our overrides
        return {
          ...data,
          selectedOptimizations: applyOptimizationOverrides(
            data.selectedOptimizations,
            currentOverrides.selectedOptimizations,
          ),
        }
      },
    )

    logger.info('State interceptor registered')

    // Cleanup on unmount
    return () => {
      if (interceptorIdRef.current !== null) {
        contentfulOptimization.interceptors.state.remove(interceptorIdRef.current)
        logger.info('State interceptor removed')
      }
      signalsRef.current = null
    }
  }, [contentfulOptimization])

  // Helper to recompute the signal from the clean API baseline + current overrides.
  // Mirrors the web preview's `syncOverrides` pattern: always derive from the
  // un-overridden API state rather than layering onto the (possibly stale) signal.
  const syncOverridesToSignal = useCallback(
    (currentOverrides: Record<string, OptimizationOverride>) => {
      const { current: signals } = signalsRef
      if (!signals) return

      signals.selectedOptimizations.value = applyOptimizationOverrides(
        lastActualDataRef.current?.selectedOptimizations ?? [],
        currentOverrides,
      )
      logger.debug('Synced overrides to signal')
    },
    [],
  )

  const setAudienceOverride = useCallback(
    (
      audienceId: string,
      isActive: boolean,
      variantIndex: number,
      experiences: ExperienceDefinition[],
    ) => {
      logger.info('Setting audience override:', { audienceId, isActive })

      const experienceIds = experiences.map((exp) => exp.id)

      setOverrides((prev) => {
        const newSelectedOptimizations = { ...prev.selectedOptimizations }
        experiences.forEach((exp) => {
          newSelectedOptimizations[exp.id] = { experienceId: exp.id, variantIndex }
        })

        if (experiences.length > 0) {
          syncOverridesToSignal(newSelectedOptimizations)
        }

        return {
          ...prev,
          audiences: {
            ...prev.audiences,
            [audienceId]: { audienceId, isActive, source: 'manual', experienceIds },
          },
          selectedOptimizations: newSelectedOptimizations,
        }
      })
    },
    [syncOverridesToSignal],
  )

  const activateAudience = useCallback(
    (audienceId: string, experiences: ExperienceDefinition[]) => {
      setAudienceOverride(audienceId, true, 1, experiences)
    },
    [setAudienceOverride],
  )

  const deactivateAudience = useCallback(
    (audienceId: string, experiences: ExperienceDefinition[]) => {
      setAudienceOverride(audienceId, false, 0, experiences)
    },
    [setAudienceOverride],
  )

  const resetAudienceOverride = useCallback(
    (audienceId: string) => {
      logger.info('Resetting audience override:', audienceId)

      setOverrides((prev) => {
        // Get the stored experience IDs from the audience override
        const storedExperienceIds = prev.audiences[audienceId]?.experienceIds ?? []
        const experienceIdSet = new Set(storedExperienceIds)

        const newSelectedOptimizations = Object.fromEntries(
          Object.entries(prev.selectedOptimizations).filter(([key]) => !experienceIdSet.has(key)),
        ) as Record<string, OptimizationOverride>

        if (storedExperienceIds.length > 0) {
          syncOverridesToSignal(newSelectedOptimizations)
        }

        return {
          ...prev,
          audiences: Object.fromEntries(
            Object.entries(prev.audiences).filter(([key]) => key !== audienceId),
          ) as Record<string, AudienceOverride>,
          selectedOptimizations: newSelectedOptimizations,
        }
      })
    },
    [syncOverridesToSignal],
  )

  const setVariantOverride = useCallback(
    (experienceId: string, variantIndex: number) => {
      logger.info('Setting variant override:', {
        experienceId,
        variantIndex,
      })

      setOverrides((prev) => {
        const newOverride: OptimizationOverride = {
          experienceId,
          variantIndex,
        }
        const newSelectedOptimizations = {
          ...prev.selectedOptimizations,
          [experienceId]: newOverride,
        }

        // Update signals directly for immediate feedback
        syncOverridesToSignal(newSelectedOptimizations)

        return {
          ...prev,
          selectedOptimizations: newSelectedOptimizations,
        }
      })
    },
    [syncOverridesToSignal],
  )

  const resetOptimizationOverride = useCallback(
    (experienceId: string) => {
      logger.info('Resetting optimization override:', experienceId)

      setOverrides((prev) => {
        const newSelectedOptimizations = Object.fromEntries(
          Object.entries(prev.selectedOptimizations).filter(([key]) => key !== experienceId),
        ) as Record<string, OptimizationOverride>

        // Update signals directly for immediate feedback
        syncOverridesToSignal(newSelectedOptimizations)

        return {
          ...prev,
          selectedOptimizations: newSelectedOptimizations,
        }
      })
    },
    [syncOverridesToSignal],
  )

  const resetSdkState = useCallback(() => {
    logger.info('Resetting SDK state to actual')
    // Instead of completely clearing the SDK state with contentfulOptimization.reset(),
    // we just clear our overrides and restore the last known actual state from the API.
    setOverrides(initialOverrideState)

    // Restore signals to actual data if we have it
    if (lastActualDataRef.current && signalsRef.current) {
      const {
        current: { selectedOptimizations, profile, changes },
      } = lastActualDataRef
      const { current: signals } = signalsRef

      signals.selectedOptimizations.value = selectedOptimizations
      signals.profile.value = profile
      signals.changes.value = changes
      logger.debug('Restored signals to actual data')
    }
  }, [])

  const actions: PreviewActions = {
    activateAudience,
    deactivateAudience,
    resetAudienceOverride,
    setVariantOverride,
    resetOptimizationOverride,
    resetSdkState,
  }

  return {
    overrides,
    actions,
  }
}

export default useProfileOverrides
