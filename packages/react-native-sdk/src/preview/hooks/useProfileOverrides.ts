import type { PreviewPanelSignalObject, Signals } from '@contentful/optimization-core'
import type {
  OptimizationData,
  SelectedPersonalizationArray,
} from '@contentful/optimization-core/api-schemas'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import { PREVIEW_PANEL_SIGNALS_SYMBOL } from '@contentful/optimization-core/symbols'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOptimization } from '../../context/OptimizationContext'
import type {
  AudienceOverride,
  ExperienceDefinition,
  OverrideState,
  PersonalizationOverride,
  PreviewActions,
} from '../types'

const logger = createScopedLogger('RN:Preview')

const initialOverrideState: OverrideState = {
  audiences: {},
  selectedPersonalizations: {},
}

/**
 * @internal
 */
function applyPersonalizationOverrides(
  apiSelectedPersonalizations: SelectedPersonalizationArray,
  overrides: Record<string, PersonalizationOverride>,
): SelectedPersonalizationArray {
  const overrideEntries = Object.values(overrides)
  if (overrideEntries.length === 0) return apiSelectedPersonalizations

  return apiSelectedPersonalizations.map((selectedPersonalization) => {
    const { [selectedPersonalization.experienceId]: override } = overrides
    if (override) {
      return {
        ...selectedPersonalization,
        variantIndex: override.variantIndex,
      }
    }
    return selectedPersonalization
  })
}

/**
 * Manages profile and personalization overrides in the preview panel.
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
        selectedPersonalizations: { value: selectedPersonalizations },
        profile: { value: profile },
        changes: { value: changes },
      } = current
      if (selectedPersonalizations && profile && changes) {
        const actualData: OptimizationData = {
          selectedPersonalizations,
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

        // If no personalization overrides, pass through unchanged
        if (Object.keys(currentOverrides.selectedPersonalizations).length === 0) {
          return data
        }

        logger.debug('Intercepting state update to preserve overrides')

        // Merge API response with our overrides
        return {
          ...data,
          selectedPersonalizations: applyPersonalizationOverrides(
            data.selectedPersonalizations,
            currentOverrides.selectedPersonalizations,
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

  // Helper to update signals directly for immediate UI feedback
  const updateSelectedPersonalizationsSignal = useCallback(
    (newOverrides: Record<string, PersonalizationOverride>) => {
      const { current: signals } = signalsRef
      if (!signals) return

      const {
        selectedPersonalizations: { value: currentSelectedPersonalizations },
      } = signals
      if (!currentSelectedPersonalizations) return

      const updatedSelectedPersonalizations = applyPersonalizationOverrides(
        currentSelectedPersonalizations,
        newOverrides,
      )

      signals.selectedPersonalizations.value = updatedSelectedPersonalizations
      logger.debug('Updated selected personalizations signal directly')
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
        const newSelectedPersonalizations = { ...prev.selectedPersonalizations }
        experiences.forEach((exp) => {
          newSelectedPersonalizations[exp.id] = { experienceId: exp.id, variantIndex }
        })

        if (experiences.length > 0) {
          updateSelectedPersonalizationsSignal(newSelectedPersonalizations)
        }

        return {
          ...prev,
          audiences: {
            ...prev.audiences,
            [audienceId]: { audienceId, isActive, source: 'manual', experienceIds },
          },
          selectedPersonalizations: newSelectedPersonalizations,
        }
      })
    },
    [updateSelectedPersonalizationsSignal],
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

        const newSelectedPersonalizations = Object.fromEntries(
          Object.entries(prev.selectedPersonalizations).filter(
            ([key]) => !experienceIdSet.has(key),
          ),
        ) as Record<string, PersonalizationOverride>

        if (storedExperienceIds.length > 0) {
          updateSelectedPersonalizationsSignal(newSelectedPersonalizations)
        }

        return {
          ...prev,
          audiences: Object.fromEntries(
            Object.entries(prev.audiences).filter(([key]) => key !== audienceId),
          ) as Record<string, AudienceOverride>,
          selectedPersonalizations: newSelectedPersonalizations,
        }
      })
    },
    [updateSelectedPersonalizationsSignal],
  )

  const setVariantOverride = useCallback(
    (experienceId: string, variantIndex: number) => {
      logger.info('Setting variant override:', {
        experienceId,
        variantIndex,
      })

      setOverrides((prev) => {
        const newOverride: PersonalizationOverride = {
          experienceId,
          variantIndex,
        }
        const newSelectedPersonalizations = {
          ...prev.selectedPersonalizations,
          [experienceId]: newOverride,
        }

        // Update signals directly for immediate feedback
        updateSelectedPersonalizationsSignal(newSelectedPersonalizations)

        return {
          ...prev,
          selectedPersonalizations: newSelectedPersonalizations,
        }
      })
    },
    [updateSelectedPersonalizationsSignal],
  )

  const resetPersonalizationOverride = useCallback(
    (experienceId: string) => {
      logger.info('Resetting personalization override:', experienceId)

      setOverrides((prev) => {
        const newSelectedPersonalizations = Object.fromEntries(
          Object.entries(prev.selectedPersonalizations).filter(([key]) => key !== experienceId),
        ) as Record<string, PersonalizationOverride>

        // Update signals directly for immediate feedback
        updateSelectedPersonalizationsSignal(newSelectedPersonalizations)

        return {
          ...prev,
          selectedPersonalizations: newSelectedPersonalizations,
        }
      })
    },
    [updateSelectedPersonalizationsSignal],
  )

  const resetSdkState = useCallback(() => {
    logger.info('Resetting SDK state to actual')
    // Instead of completely clearing the SDK state with contentfulOptimization.reset(),
    // we just clear our overrides and restore the last known actual state from the API.
    setOverrides(initialOverrideState)

    // Restore signals to actual data if we have it
    if (lastActualDataRef.current && signalsRef.current) {
      const {
        current: { selectedPersonalizations, profile, changes },
      } = lastActualDataRef
      const { current: signals } = signalsRef

      signals.selectedPersonalizations.value = selectedPersonalizations
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
    resetPersonalizationOverride,
    resetSdkState,
  }

  return {
    overrides,
    actions,
  }
}

export default useProfileOverrides
