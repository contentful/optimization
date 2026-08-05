import type { EntryFor, OptimizedEntryMetadata, ResolvedData } from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import type { ChainModifiers, EntrySkeletonType, LocaleCode } from 'contentful'
import type { OptimizedEntryLoadingPresentation } from './OptimizedEntryLoadingPresentation'
import type { OptimizedEntryTrackingAttributes } from './OptimizedEntryTrackingAttributes'

/** Current presentation state for one optimized entry. @public */
export interface OptimizedEntrySnapshot<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  /** Whether SDK state says optimized content can be selected. */
  readonly canOptimize: boolean
  /** Entry that should be rendered for the current snapshot. */
  readonly entry: EntryFor<S, M, L>
  /** Host attributes needed for automatic entry interaction tracking. */
  readonly hostAttributes: OptimizedEntryTrackingAttributes
  /** Whether the resolved variant deliberately renders no visible content. */
  readonly isEmptyVariant: boolean
  /** Whether the optimized entry is still waiting for optimization state. */
  readonly isLoading: boolean
  /** Whether the client presentation layer is ready to reveal rendered content. */
  readonly isPresentationReady: boolean
  /** Whether the current entry has been resolved and can be exposed to render callbacks. */
  readonly isResolved: boolean
  /** Loading and fallback rendering decisions for wrappers around the entry. */
  readonly loadingPresentation: OptimizedEntryLoadingPresentation
  /** Baseline, resolved-entry, and optimization metadata for render surfaces. */
  readonly metadata: OptimizedEntryMetadata<S, M, L>
  /** Full resolved entry data returned by the SDK resolver. */
  readonly resolvedData: ResolvedData<S, M, L>
  /** Selected optimization that resolved the current entry, when one applied. */
  readonly selectedOptimization: ResolvedData<S, M, L>['selectedOptimization']
  /** Selected optimization array used for this snapshot. */
  readonly selectedOptimizations: SelectedOptimizationArray | undefined
}

/** Receives optimized-entry snapshot updates. @public */
export type OptimizedEntrySnapshotListener<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = (snapshot: OptimizedEntrySnapshot<S, M, L>) => void

function areHostAttributesEqual(
  left: OptimizedEntryTrackingAttributes,
  right: OptimizedEntryTrackingAttributes,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => left[key] === right[key])
}

function areLoadingPresentationsEqual(
  left: OptimizedEntryLoadingPresentation,
  right: OptimizedEntryLoadingPresentation,
): boolean {
  return (
    left.showLoadingFallback === right.showLoadingFallback &&
    left.hideLoadingLayoutTarget === right.hideLoadingLayoutTarget &&
    left.shouldRenderBaselineWhileLoading === right.shouldRenderBaselineWhileLoading &&
    left.targetDisplay === right.targetDisplay
  )
}

function areSnapshotMetadataEqual(
  left: OptimizedEntrySnapshot['metadata'],
  right: OptimizedEntrySnapshot['metadata'],
): boolean {
  return (
    left.baselineEntry === right.baselineEntry &&
    left.optimizationContextId === right.optimizationContextId
  )
}

function areSnapshotValuesEqual(
  left: OptimizedEntrySnapshot,
  right: OptimizedEntrySnapshot,
): boolean {
  return (
    left.canOptimize === right.canOptimize &&
    left.entry === right.entry &&
    left.isEmptyVariant === right.isEmptyVariant &&
    left.isLoading === right.isLoading &&
    left.isPresentationReady === right.isPresentationReady &&
    left.isResolved === right.isResolved &&
    left.selectedOptimization === right.selectedOptimization &&
    left.selectedOptimizations === right.selectedOptimizations
  )
}

export function areOptimizedEntrySnapshotsEqual(
  left: OptimizedEntrySnapshot,
  right: OptimizedEntrySnapshot,
): boolean {
  return (
    areSnapshotValuesEqual(left, right) &&
    areSnapshotMetadataEqual(left.metadata, right.metadata) &&
    areLoadingPresentationsEqual(left.loadingPresentation, right.loadingPresentation) &&
    areHostAttributesEqual(left.hostAttributes, right.hostAttributes)
  )
}
