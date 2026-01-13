import {
  logger,
  type OptimizationData,
  type PreviewPanelSignalObject,
  type SelectedPersonalizationArray,
  type Signals,
} from '@contentful/optimization-core'
import { useOptimization } from '@contentful/optimization-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AudienceOverride,
  ExperienceDefinition,
  OverrideState,
  PersonalizationOverride,
  PreviewActions,
} from '../types'

const initialOverrideState: OverrideState = {
  audiences: {},
  personalizations: {},
}

/**
 * Applies personalization overrides to the API response data.
 * This merges the user's manual overrides with the data from the API.
 */
function applyPersonalizationOverrides(
  apiPersonalizations: SelectedPersonalizationArray,
  overrides: Record<string, PersonalizationOverride>,
): SelectedPersonalizationArray {
  const overrideEntries = Object.values(overrides)
  if (overrideEntries.length === 0) return apiPersonalizations

  return apiPersonalizations.map((personalization) => {
    const { [personalization.experienceId]: override } = overrides
    if (override) {
      return {
        ...personalization,
        variantIndex: override.variantIndex,
      }
    }
    return personalization
  })
}

/**
 * Hook for managing profile and personalization overrides in the preview panel.
 * Provides local state for overrides and actions to modify them.
 *
 * When an SDK instance is provided, this hook will:
 * 1. Register with the SDK to get direct signal access
 * 2. Register a state interceptor to preserve overrides when API responses arrive
 * 3. Modify signals directly when overrides change for immediate UI updates
 */
export function useProfileOverrides(): {
  overrides: OverrideState
  actions: PreviewActions
} {
  const optimization = useOptimization()
  const [overrides, setOverrides] = useState<OverrideState>(initialOverrideState)

  // Store signals reference obtained from SDK registration
  const signalsRef = useRef<Signals | null>(null)

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
    const previewPanelObject: PreviewPanelSignalObject = {
      signals: null,
    }

    // Register with the SDK to get signal access
    optimization.registerPreviewPanel(previewPanelObject)
    ;({ signals: signalsRef.current } = previewPanelObject)

    logger.info('[PreviewPanel] Registered with SDK, signals access obtained')

    // Register state interceptor to preserve overrides when API responses arrive
    interceptorIdRef.current = optimization.personalization.interceptor.state.add(
      (data: OptimizationData): OptimizationData => {
        // Cache the un-overridden data
        lastActualDataRef.current = data

        const { current: currentOverrides } = overridesRef

        // If no personalization overrides, pass through unchanged
        if (Object.keys(currentOverrides.personalizations).length === 0) {
          return data
        }

        logger.debug('[PreviewPanel] Intercepting state update to preserve overrides')

        // Merge API response with our overrides
        return {
          ...data,
          personalizations: applyPersonalizationOverrides(
            data.personalizations,
            currentOverrides.personalizations,
          ),
        }
      },
    )

    logger.info('[PreviewPanel] State interceptor registered')

    // Cleanup on unmount
    return () => {
      if (interceptorIdRef.current !== null) {
        optimization.personalization.interceptor.state.remove(interceptorIdRef.current)
        logger.info('[PreviewPanel] State interceptor removed')
      }
      signalsRef.current = null
    }
  }, [optimization])

  // Helper to update signals directly for immediate UI feedback
  const updatePersonalizationsSignal = useCallback(
    (newOverrides: Record<string, PersonalizationOverride>) => {
      const { current: signals } = signalsRef
      if (!signals) return

      const {
        personalizations: { value: currentPersonalizations },
      } = signals
      if (!currentPersonalizations) return

      const updatedPersonalizations = applyPersonalizationOverrides(
        currentPersonalizations,
        newOverrides,
      )

      signals.personalizations.value = updatedPersonalizations
      logger.debug('[PreviewPanel] Updated personalizations signal directly')
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
      logger.info('[PreviewPanel] Setting audience override:', { audienceId, isActive })

      const experienceIds = experiences.map((exp) => exp.id)

      setOverrides((prev) => {
        const newPersonalizations = { ...prev.personalizations }
        experiences.forEach((exp) => {
          newPersonalizations[exp.id] = { experienceId: exp.id, variantIndex }
        })

        if (experiences.length > 0) {
          updatePersonalizationsSignal(newPersonalizations)
        }

        return {
          ...prev,
          audiences: {
            ...prev.audiences,
            [audienceId]: { audienceId, isActive, source: 'manual', experienceIds },
          },
          personalizations: newPersonalizations,
        }
      })
    },
    [updatePersonalizationsSignal],
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
      logger.info('[PreviewPanel] Resetting audience override:', audienceId)

      setOverrides((prev) => {
        // Get the stored experience IDs from the audience override
        const storedExperienceIds = prev.audiences[audienceId]?.experienceIds ?? []
        const experienceIdSet = new Set(storedExperienceIds)

        const newPersonalizations = Object.fromEntries(
          Object.entries(prev.personalizations).filter(([key]) => !experienceIdSet.has(key)),
        ) as Record<string, PersonalizationOverride>

        if (storedExperienceIds.length > 0) {
          updatePersonalizationsSignal(newPersonalizations)
        }

        return {
          ...prev,
          audiences: Object.fromEntries(
            Object.entries(prev.audiences).filter(([key]) => key !== audienceId),
          ) as Record<string, AudienceOverride>,
          personalizations: newPersonalizations,
        }
      })
    },
    [updatePersonalizationsSignal],
  )

  const setVariantOverride = useCallback(
    (experienceId: string, variantIndex: number) => {
      logger.info('[PreviewPanel] Setting variant override:', {
        experienceId,
        variantIndex,
      })

      setOverrides((prev) => {
        const newOverride: PersonalizationOverride = {
          experienceId,
          variantIndex,
        }
        const newPersonalizations = {
          ...prev.personalizations,
          [experienceId]: newOverride,
        }

        // Update signals directly for immediate feedback
        updatePersonalizationsSignal(newPersonalizations)

        return {
          ...prev,
          personalizations: newPersonalizations,
        }
      })
    },
    [updatePersonalizationsSignal],
  )

  const resetPersonalizationOverride = useCallback(
    (experienceId: string) => {
      logger.info('[PreviewPanel] Resetting personalization override:', experienceId)

      setOverrides((prev) => {
        const newPersonalizations = Object.fromEntries(
          Object.entries(prev.personalizations).filter(([key]) => key !== experienceId),
        ) as Record<string, PersonalizationOverride>

        // Update signals directly for immediate feedback
        updatePersonalizationsSignal(newPersonalizations)

        return {
          ...prev,
          personalizations: newPersonalizations,
        }
      })
    },
    [updatePersonalizationsSignal],
  )

  const resetSdkState = useCallback(() => {
    logger.info('[PreviewPanel] Resetting SDK state to actual')
    // Instead of completely clearing the SDK state with optimization.reset(),
    // we just clear our overrides and restore the last known actual state from the API.
    setOverrides(initialOverrideState)

    // Restore signals to actual data if we have it
    if (lastActualDataRef.current && signalsRef.current) {
      const {
        current: { personalizations, profile, changes },
      } = lastActualDataRef
      const { current: signals } = signalsRef

      signals.personalizations.value = personalizations
      signals.profile.value = profile
      signals.changes.value = changes
      logger.debug('[PreviewPanel] Restored signals to actual data')
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
