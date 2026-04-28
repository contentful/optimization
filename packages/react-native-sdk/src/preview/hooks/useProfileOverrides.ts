import type { PreviewPanelSignalObject } from '@contentful/optimization-core'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import { PreviewOverrideManager } from '@contentful/optimization-core/preview-support'
import { PREVIEW_PANEL_SIGNALS_SYMBOL } from '@contentful/optimization-core/symbols'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOptimization } from '../../context/OptimizationContext'
import type { ExperienceDefinition, OverrideState, PreviewActions } from '../types'

const logger = createScopedLogger('RN:Preview')

const initialOverrideState: OverrideState = {
  audiences: {},
  selectedOptimizations: {},
}

/**
 * Manages profile and optimization overrides in the preview panel.
 *
 * Delegates to a shared {@link PreviewOverrideManager} that registers a state
 * interceptor to preserve overrides when API responses arrive, and provides
 * methods to activate/deactivate audiences and set variant overrides.
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
  const managerRef = useRef<PreviewOverrideManager | null>(null)

  useEffect(() => {
    // Create a preview panel compatible object to receive signals
    const previewPanelObject: PreviewPanelSignalObject = {}

    // Register with the SDK to get signal access
    contentfulOptimization.registerPreviewPanel(previewPanelObject)
    const signals = Reflect.get(previewPanelObject, PREVIEW_PANEL_SIGNALS_SYMBOL)

    if (!signals) {
      logger.warn('Failed to obtain signals from SDK registration')
      return
    }

    logger.info('Registered with SDK, signals access obtained')

    const manager = new PreviewOverrideManager({
      selectedOptimizations: signals.selectedOptimizations,
      profile: signals.profile,
      stateInterceptors: contentfulOptimization.interceptors.state,
      onOverridesChanged: (state) => {
        setOverrides({ ...state })
      },
    })
    managerRef.current = manager

    return () => {
      manager.destroy()
      managerRef.current = null
    }
  }, [contentfulOptimization])

  const activateAudience = useCallback(
    (audienceId: string, experiences: ExperienceDefinition[]) => {
      managerRef.current?.activateAudience(
        audienceId,
        experiences.map((exp) => exp.id),
      )
    },
    [],
  )

  const deactivateAudience = useCallback(
    (audienceId: string, experiences: ExperienceDefinition[]) => {
      managerRef.current?.deactivateAudience(
        audienceId,
        experiences.map((exp) => exp.id),
      )
    },
    [],
  )

  const resetAudienceOverride = useCallback((audienceId: string) => {
    managerRef.current?.resetAudienceOverride(audienceId)
  }, [])

  const setVariantOverride = useCallback((experienceId: string, variantIndex: number) => {
    managerRef.current?.setVariantOverride(experienceId, variantIndex)
  }, [])

  const resetOptimizationOverride = useCallback((experienceId: string) => {
    managerRef.current?.resetOptimizationOverride(experienceId)
  }, [])

  const resetSdkState = useCallback(() => {
    managerRef.current?.resetAll()
  }, [])

  const actions: PreviewActions = useMemo(
    () => ({
      activateAudience,
      deactivateAudience,
      resetAudienceOverride,
      setVariantOverride,
      resetOptimizationOverride,
      resetSdkState,
    }),
    [
      activateAudience,
      deactivateAudience,
      resetAudienceOverride,
      setVariantOverride,
      resetOptimizationOverride,
      resetSdkState,
    ],
  )

  return {
    overrides,
    actions,
  }
}

export default useProfileOverrides
