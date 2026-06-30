import { getPreviewPanelBridge } from '@contentful/optimization-core/bridge-support'
import { PreviewOverrideManager } from '@contentful/optimization-core/preview-support'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOptimization } from '../../context/OptimizationContext'
import { requireOptimizationPreviewRuntime } from '../../OptimizationSdk'
import type { ExperienceDefinition, OverrideState, PreviewActions } from '../types'

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
  const contentfulOptimization = requireOptimizationPreviewRuntime(useOptimization())
  const [overrides, setOverrides] = useState<OverrideState>(initialOverrideState)
  const managerRef = useRef<PreviewOverrideManager | null>(null)

  useEffect(() => {
    const { profile, selectedOptimizations, stateInterceptors } =
      getPreviewPanelBridge(contentfulOptimization)

    const manager = new PreviewOverrideManager({
      selectedOptimizations,
      profile,
      stateInterceptors,
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
