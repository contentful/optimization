import { logger } from '@contentful/optimization-core'
import { useOptimization } from '@contentful/optimization-react-native'
import { useCallback, useState } from 'react'
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
 * Hook for managing profile and personalization overrides in the preview panel.
 * Provides local state for overrides and actions to modify them.
 */
export function useProfileOverrides(): {
  overrides: OverrideState
  actions: PreviewActions
} {
  const optimization = useOptimization()
  const [overrides, setOverrides] = useState<OverrideState>(initialOverrideState)

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

  const setVariantOverride = useCallback((experienceId: string, variantIndex: number) => {
    logger.info('[PreviewPanel] Setting variant override:', {
      experienceId,
      variantIndex,
    })

    setOverrides((prev) => {
      const newOverride: PersonalizationOverride = {
        experienceId,
        variantIndex,
      }
      return {
        ...prev,
        personalizations: {
          ...prev.personalizations,
          [experienceId]: newOverride,
        },
      }
    })
  }, [])

  const resetPersonalizationOverride = useCallback((experienceId: string) => {
    logger.info('[PreviewPanel] Resetting personalization override:', experienceId)

    setOverrides((prev) => ({
      ...prev,
      personalizations: Object.fromEntries(
        Object.entries(prev.personalizations).filter(([key]) => key !== experienceId),
      ) as Record<string, PersonalizationOverride>,
    }))
  }, [])

  const resetAllOverrides = useCallback(() => {
    logger.info('[PreviewPanel] Resetting all overrides')
    setOverrides(initialOverrideState)
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
