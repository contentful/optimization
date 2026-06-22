export {
  OPTIMIZED_ENTRY_HOST_DISPLAY,
  OptimizedEntryController,
  createOptimizationRootSdkBinding,
  disposeOptimizationRootSdkBinding,
  resolveOptimizedEntryNestingState,
  resolveTrackEntryInteractionOptions,
  type CreateInjectedOptimizationRootSdkBindingOptions,
  type CreateOwnedOptimizationRootSdkBindingOptions,
  type OnStatesReady,
  type OptimizationRootSdk,
  type OptimizationRootSdkBinding,
  type OptimizationRootSdkConfig,
  type OptimizedEntryControllerOptions,
  type OptimizedEntryLoadingTargetDisplay,
  type OptimizedEntryNestingState,
  type OptimizedEntrySdk,
  type OptimizedEntrySnapshot,
  type OptimizedEntrySnapshotListener,
  type TrackEntryInteractionOptions,
} from '../presentation'
export {
  CurrentPageTracker,
  getCurrentPageTracker,
  installCurrentPageTrackerSdkSupport,
  resetCurrentPageTrackerState,
} from './currentPageTracker'
export type {
  CurrentPageEmissionMetadata,
  CurrentPageTrackerSdk,
  CurrentPageTrackerSdkSupport,
  EmitCurrentPageOptions,
} from './currentPageTracker'
