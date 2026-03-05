/**
 * Contentful Optimization React Native SDK.
 *
 * @remarks
 * Implements React Native-specific functionality on top of the Optimization Core Library.
 * Provides components for personalization, analytics tracking, and a preview panel for
 * debugging personalizations during development.
 *
 * @packageDocumentation
 */

import './images'
import './polyfills/crypto'

import type { CoreStatefulConfig } from '@contentful/optimization-core'

/**
 * SDK initialization config passed as props to {@link OptimizationProvider} and {@link OptimizationRoot}.
 *
 * Alias of {@link CoreStatefulConfig}. Only `clientId` is required.
 *
 * @public
 */
export type OptimizationConfig = CoreStatefulConfig

export { OptimizationProvider } from './components/OptimizationProvider'
export type { OptimizationProviderProps } from './components/OptimizationProvider'
export { OptimizationRoot } from './components/OptimizationRoot'
export type { OptimizationRootProps, PreviewPanelConfig } from './components/OptimizationRoot'

export { Personalization } from './components/Personalization'
export type { PersonalizationProps } from './components/Personalization'

export { Analytics } from './components/Analytics'
export type { AnalyticsProps } from './components/Analytics'

export { OptimizationScrollProvider, useScrollContext } from './context/OptimizationScrollContext'
export type { OptimizationScrollProviderProps } from './context/OptimizationScrollContext'

export { LiveUpdatesProvider, useLiveUpdates } from './context/LiveUpdatesContext'
export { useOptimization } from './context/OptimizationContext'

export { useViewportTracking } from './hooks/useViewportTracking'
export type {
  UseViewportTrackingOptions,
  UseViewportTrackingReturn,
} from './hooks/useViewportTracking'

// Export screen tracking hooks
export { useScreenTracking, useScreenTrackingCallback } from './hooks/useScreenTracking'
export type { UseScreenTrackingOptions, UseScreenTrackingReturn } from './hooks/useScreenTracking'

export { OptimizationNavigationContainer } from './components/OptimizationNavigationContainer'
export type { OptimizationNavigationContainerProps } from './components/OptimizationNavigationContainer'

export { PreviewPanel as OptimizationPreviewPanel } from './preview/components/PreviewPanel'
export { PreviewPanelOverlay } from './preview/components/PreviewPanelOverlay'
export type { ContentfulClient, PreviewPanelOverlayProps, PreviewPanelProps } from './preview/types'

export { default as OptimizationReactNativeSdk } from './OptimizationReactNativeSdk'
