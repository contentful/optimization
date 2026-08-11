import type { ContentOptimizationHydrationMode } from '../handoff'

/** Display mode used for the temporary loading layout target. @public */
export type OptimizedEntryLoadingTargetDisplay = 'block' | 'inline'

export interface OptimizedEntryLoadingPresentation {
  readonly showLoadingFallback: boolean
  readonly hideLoadingLayoutTarget: boolean
  readonly shouldRenderBaselineWhileLoading: boolean
  readonly targetDisplay: OptimizedEntryLoadingTargetDisplay
}

interface LoadingPresentationInput {
  readonly hasBaselineRevealTimedOut: boolean
  readonly hasCustomLoadingFallback: boolean
  readonly hydration: ContentOptimizationHydrationMode
  readonly isLoading: boolean
  readonly isPresentationReady: boolean
  readonly isServerRender: boolean
  readonly targetDisplay: OptimizedEntryLoadingTargetDisplay
}

export function resolveLoadingPresentation({
  hasBaselineRevealTimedOut,
  hasCustomLoadingFallback,
  hydration,
  isLoading,
  isPresentationReady,
  isServerRender,
  targetDisplay,
}: LoadingPresentationInput): OptimizedEntryLoadingPresentation {
  const preservesServerContent = hydration === 'preserve-server'
  const showLoadingFallback = !preservesServerContent && (isLoading || !isPresentationReady)
  const shouldRenderBaselineWhileLoading =
    !preservesServerContent && (!hasCustomLoadingFallback || hasBaselineRevealTimedOut)
  const hideLoadingLayoutTarget =
    !preservesServerContent &&
    (isServerRender || (shouldRenderBaselineWhileLoading && !hasBaselineRevealTimedOut))

  return {
    showLoadingFallback,
    hideLoadingLayoutTarget,
    shouldRenderBaselineWhileLoading,
    targetDisplay,
  }
}
