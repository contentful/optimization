export type { ContentfulEntryQuery, ManagedEntryDescriptor, ManagedEntryHandoff } from './CoreBase'
export {
  OptimizedEntrySourceController,
  createOptimizedEntryLoadingEntry,
  getOptimizedEntrySourceKey,
  prefetchManagedEntries,
  type ManagedEntryPrefetchRuntime,
  type OptimizedEntrySourceControllerOptions,
  type OptimizedEntrySourceSnapshot,
  type OptimizedEntrySourceSnapshotListener,
} from './OptimizedEntrySourceController'
