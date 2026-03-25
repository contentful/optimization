/**
 * Contentful Optimization React Native SDK.
 *
 * @remarks
 * Implements React Native-specific functionality on top of the ContentfulOptimization Core Library.
 * Provides components for optimization, analytics tracking, and a preview panel for
 * debugging selected optimizations during development.
 *
 * @packageDocumentation
 */

import './images'
import './polyfills/crypto'

import type { CoreStatefulConfig } from '@contentful/optimization-core'

/**
 * Configuration options for initializing the Optimization React Native SDK.
 *
 * Passed as props to {@link OptimizationProvider} and {@link OptimizationRoot}.
 * Only `clientId` is required. See the README for full configuration reference.
 *
 * @public
 */
export type OptimizationConfig = CoreStatefulConfig

export { OptimizationProvider } from './components/OptimizationProvider'
export type { OptimizationProviderProps } from './components/OptimizationProvider'
export { OptimizationRoot } from './components/OptimizationRoot'
export type { OptimizationRootProps } from './components/OptimizationRoot'

export { OptimizedEntry } from './components/OptimizedEntry'
export type { OptimizedEntryProps } from './components/OptimizedEntry'

export { OptimizationScrollProvider, useScrollContext } from './context/OptimizationScrollContext'
export type { OptimizationScrollProviderProps } from './context/OptimizationScrollContext'

export { LiveUpdatesProvider, useLiveUpdates } from './context/LiveUpdatesContext'
export { useOptimization } from './context/OptimizationContext'

export { useInteractionTracking } from './context/InteractionTrackingContext'
export type {
  EntryInteraction,
  TrackEntryInteractionOptions,
} from './context/InteractionTrackingContext'

export { useViewportTracking } from './hooks/useViewportTracking'
export type {
  UseViewportTrackingOptions,
  UseViewportTrackingReturn,
} from './hooks/useViewportTracking'

export { useTapTracking } from './hooks/useTapTracking'
export type { UseTapTrackingOptions, UseTapTrackingReturn } from './hooks/useTapTracking'

// Export screen tracking hooks
export { useScreenTracking, useScreenTrackingCallback } from './hooks/useScreenTracking'
export type { UseScreenTrackingOptions, UseScreenTrackingReturn } from './hooks/useScreenTracking'

export { OptimizationNavigationContainer } from './components/OptimizationNavigationContainer'
export type { OptimizationNavigationContainerProps } from './components/OptimizationNavigationContainer'

export { PreviewPanel as OptimizationPreviewPanel } from './preview/components/PreviewPanel'
export { PreviewPanelOverlay } from './preview/components/PreviewPanelOverlay'
export type {
  ContentfulClient,
  PreviewPanelConfig,
  PreviewPanelOverlayProps,
  PreviewPanelProps,
} from './preview/types'

export { default as ContentfulOptimization } from './ContentfulOptimization'
