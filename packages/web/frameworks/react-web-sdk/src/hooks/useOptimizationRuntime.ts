import { resolveShouldLiveUpdate } from '@contentful/optimization-web/presentation'
import type { OptimizationSdk } from '../context/OptimizationContext'
import { useOptimizationRouteTransition } from '../context/OptimizationRouteTransitionContext'
import { useOptionalLiveUpdates } from './useLiveUpdates'
import { requireOptimizationSdk, useOptimizationContext } from './useOptimization'

export function useOptimizationRuntime(liveUpdates?: boolean): {
  readonly isLive: boolean
  readonly sdk: OptimizationSdk
} {
  const { error, isLive, sdk: liveSdk } = useOptimizationContext()
  const routeTransition = useOptimizationRouteTransition()
  const liveUpdatesContext = useOptionalLiveUpdates()
  const { globalLiveUpdates = false, previewPanelVisible = false } = liveUpdatesContext ?? {}
  const shouldLiveUpdate = resolveShouldLiveUpdate({
    entryLiveUpdatesEnabled: liveUpdates,
    rootLiveUpdatesEnabled: globalLiveUpdates,
    isPreviewPanelOpen: previewPanelVisible,
  })
  let runtimeIsLive = isLive ?? true
  let runtimeSdk = liveSdk

  if (
    routeTransition !== null &&
    (!shouldLiveUpdate || !routeTransition.isLiveRuntimeAuthoritative)
  ) {
    const { isPresentationLive, presentationSdk } = routeTransition
    runtimeIsLive = isPresentationLive
    runtimeSdk = presentationSdk ?? liveSdk
  }

  return {
    isLive: runtimeIsLive,
    sdk: requireOptimizationSdk(runtimeSdk, error),
  }
}
