import {
  logger,
  type OptimizationData,
  type PreviewPanelCompatibleObject,
  type SelectedPersonalizationArray,
  type Signals,
} from '@contentful/optimization-core'
import { useOptimization } from '@contentful/optimization-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AudienceOverride,
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
  apiPersonalizations: SelectedPersonalizationArray | undefined,
  overrides: Record<string, PersonalizationOverride>,
): SelectedPersonalizationArray | undefined {
  if (!apiPersonalizations) return undefined

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

  // Keep overridesRef in sync with state
  useEffect(() => {
    overridesRef.current = overrides
  }, [overrides])

  // Register with SDK and set up interceptor on mount
  useEffect(() => {
    // Create a preview panel compatible object to receive signals
    const previewPanelObject: PreviewPanelCompatibleObject = {
      signals: null,
    }

    // Register with the SDK to get signal access
    optimization.registerPreviewPanel(previewPanelObject)
    ;({ signals: signalsRef.current } = previewPanelObject)

    logger.info('[PreviewPanel] Registered with SDK, signals access obtained')

    // Register state interceptor to preserve overrides when API responses arrive
    interceptorIdRef.current = optimization.personalization.interceptor.state.add(
      (data: OptimizationData): OptimizationData => {
        const { current: currentOverrides } = overridesRef

        // If no personalization overrides, pass through unchanged
        if (Object.keys(currentOverrides.personalizations).length === 0) {
          return data
        }

        logger.debug('[PreviewPanel] Intercepting state update to preserve overrides')

        // Merge API response with our overrides
        const overriddenPersonalizations = applyPersonalizationOverrides(
          data.personalizations,
          currentOverrides.personalizations,
        )
        return {
          ...data,
          ...(overriddenPersonalizations && { personalizations: overriddenPersonalizations }),
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

      if (updatedPersonalizations) {
        signals.personalizations.value = updatedPersonalizations
        logger.debug('[PreviewPanel] Updated personalizations signal directly')
      }
    },
    [],
  )

  const activateAudience = useCallback((audienceId: string) => {
    logger.info('[PreviewPanel] Activating audience override:', audienceId)

    setOverrides((prev) => {
      const newOverride: AudienceOverride = {
        audienceId,
        isActive: true,
        source: 'manual',
      }
      return {
        ...prev,
        audiences: {
          ...prev.audiences,
          [audienceId]: newOverride,
        },
      }
    })
  }, [])

  const deactivateAudience = useCallback((audienceId: string) => {
    logger.info('[PreviewPanel] Deactivating audience override:', audienceId)

    setOverrides((prev) => {
      const newOverride: AudienceOverride = {
        audienceId,
        isActive: false,
        source: 'manual',
      }
      return {
        ...prev,
        audiences: {
          ...prev.audiences,
          [audienceId]: newOverride,
        },
      }
    })
  }, [])

  const resetAudienceOverride = useCallback((audienceId: string) => {
    logger.info('[PreviewPanel] Resetting audience override:', audienceId)

    setOverrides((prev) => ({
      ...prev,
      audiences: Object.fromEntries(
        Object.entries(prev.audiences).filter(([key]) => key !== audienceId),
      ) as Record<string, AudienceOverride>,
    }))
  }, [])

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

  const resetAllOverrides = useCallback(() => {
    logger.info('[PreviewPanel] Resetting all overrides')
    setOverrides(initialOverrideState)

    // Clear signal overrides - restore to API values would require re-fetching
    // For now, just clear the overrides tracking
  }, [])

  const resetSdkState = useCallback(() => {
    logger.info('[PreviewPanel] Resetting SDK state')
    optimization.reset()
    setOverrides(initialOverrideState)
  }, [optimization])

  const actions: PreviewActions = {
    activateAudience,
    deactivateAudience,
    resetAudienceOverride,
    setVariantOverride,
    resetPersonalizationOverride,
    resetAllOverrides,
    resetSdkState,
  }

  return {
    overrides,
    actions,
  }
}

export default useProfileOverrides
