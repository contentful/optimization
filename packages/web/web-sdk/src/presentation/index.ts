/**
 * Low-level presentation primitives shared by optimized-entry wrappers.
 *
 * @packageDocumentation
 */

export type { OptimizedEntryMetadata } from '@contentful/optimization-core'
export {
  OptimizedEntrySourceController,
  createOptimizedEntryLoadingEntry,
  getOptimizedEntrySourceKey,
  prefetchOptimizedEntries,
  type OptimizedEntryPrefetchDescriptor,
  type OptimizedEntryPrefetchRuntime,
  type OptimizedEntrySourceControllerOptions,
  type OptimizedEntrySourceSnapshot,
  type OptimizedEntrySourceSnapshotListener,
  type ServerOptimizedEntryHandoff,
} from '@contentful/optimization-core/entry-source'
export {
  createOptimizationRootSdkBinding,
  disposeOptimizationRootSdkBinding,
  resolveTrackEntryInteractionOptions,
  type CreateInjectedOptimizationRootSdkBindingOptions,
  type CreateOwnedOptimizationRootSdkBindingOptions,
  type OnStatesReady,
  type OptimizationRootSdk,
  type OptimizationRootSdkBinding,
  type OptimizationRootSdkConfig,
  type TrackEntryInteractionOptions,
} from './optimizationRootRuntime'
export {
  OPTIMIZED_ENTRY_HOST_DISPLAY,
  OptimizedEntryController,
  resolveOptimizedEntryNestingState,
  type OptimizedEntryControllerOptions,
  type OptimizedEntryLoadingTargetDisplay,
  type OptimizedEntryNestingState,
  type OptimizedEntrySdk,
  type OptimizedEntrySnapshot,
  type OptimizedEntrySnapshotListener,
} from './OptimizedEntryController'
export {
  resolveOptimizedEntryTrackingAttributes,
  type OptimizedEntryHostAttributeValue,
  type OptimizedEntryTrackingAttributeOptions,
  type OptimizedEntryTrackingAttributes,
} from './OptimizedEntryTrackingAttributes'
