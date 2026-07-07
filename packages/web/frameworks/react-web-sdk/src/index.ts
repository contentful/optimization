'use client'

import type { OptimizationSdk } from './context/OptimizationContext'

export type { OptimizationWebRuntime } from '@contentful/optimization-web'
export type {
  AutoPageEmissionContext,
  AutoPagePayload,
  AutoPagePayloadOptions,
  AutoPageRouteState,
} from './auto-page/types'
export type { InitialAutoPageEvent } from './auto-page/useAutoPageEmitter'
export { LiveUpdatesContext } from './context/LiveUpdatesContext'
export type { LiveUpdatesContextValue } from './context/LiveUpdatesContext'
export { OptimizationContext } from './context/OptimizationContext'
export type { OptimizationContextValue, OptimizationSdk } from './context/OptimizationContext'
export { useEntryResolver } from './hooks/useEntryResolver'
export type { UseEntryResolverResult } from './hooks/useEntryResolver'
export { useLiveUpdates } from './hooks/useLiveUpdates'
export { useMergeTagResolver } from './hooks/useMergeTagResolver'
export type { UseMergeTagResolverResult } from './hooks/useMergeTagResolver'
export { useOptimization, useOptimizationContext } from './hooks/useOptimization'
export { useOptimizationActions } from './hooks/useOptimizationActions'
export type { UseOptimizationActionsResult } from './hooks/useOptimizationActions'
export {
  useCanOptimizeState,
  useConsentState,
  useEventStreamState,
  useProfileState,
  useSelectedOptimizationsState,
} from './hooks/useOptimizationState'
export { OptimizedEntry } from './optimized-entry/OptimizedEntry'
export type {
  OptimizedEntryErrorFallback,
  OptimizedEntryLoadingFallback,
  OptimizedEntryProps,
  OptimizedEntryRenderContext,
} from './optimized-entry/OptimizedEntry'
export { useOptimizedEntry } from './optimized-entry/useOptimizedEntry'
export type {
  UseOptimizedEntryParams,
  UseOptimizedEntryResult,
} from './optimized-entry/useOptimizedEntry'
export { LiveUpdatesProvider } from './provider/LiveUpdatesProvider'
export type { LiveUpdatesProviderProps } from './provider/LiveUpdatesProvider'
export { OptimizationProvider } from './provider/OptimizationProvider'
export type {
  OnStatesReady,
  OptimizationProviderProps,
  TrackEntryInteractionOptions,
} from './provider/OptimizationProvider'
export { OptimizationRoot } from './root/OptimizationRoot'
export type { OptimizationRootProps } from './root/OptimizationRoot'
export {
  prefetchOptimizedEntries,
  type OptimizedEntryPrefetchDescriptor,
  type OptimizedEntryPrefetchRuntime,
  type ServerOptimizedEntryHandoff,
} from './server-optimized-entries'
export type ContentfulOptimizationOrNull = OptimizationSdk | null
