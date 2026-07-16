import type { ContentOptimizationHydrationMode } from '../handoff'
import type {
  OptimizedEntryLoadingTargetDisplay,
  OptimizedEntrySnapshot,
} from './OptimizedEntryController'

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
}: LoadingPresentationInput): OptimizedEntrySnapshot['loadingPresentation'] {
  const preservesServerContent = hydration === 'preserve-server'
  const showLoadingFallback =
    !preservesServerContent && (isLoading || (isServerRender && !isPresentationReady))
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
