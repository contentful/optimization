import React, { type ReactNode } from 'react'
import type Optimization from '../'
import { PreviewPanelOverlay } from '../preview/components/PreviewPanelOverlay'
import type { ContentfulClient } from '../preview/types'
import { OptimizationProvider } from './OptimizationProvider'

/**
 * Configuration options for the preview panel feature
 */
export interface PreviewPanelConfig {
  /**
   * Whether the preview panel is enabled.
   * When true, a floating action button will appear that opens the preview panel.
   */
  enabled: boolean

  /**
   * Contentful client instance used to fetch audience and experience entries.
   * The panel will automatically fetch nt_audience and nt_experience content types.
   */
  contentfulClient: ContentfulClient

  /**
   * Optional positioning overrides for the floating action button
   */
  fabPosition?: { bottom?: number; right?: number }

  /**
   * Called when the panel visibility changes
   */
  onVisibilityChange?: (isVisible: boolean) => void

  /**
   * Whether to show the header with title in the preview panel
   */
  showHeader?: boolean
}

/**
 * Props for the OptimizationRoot component
 */
export interface OptimizationRootProps {
  /**
   * The Optimization instance to provide to child components
   */
  instance: Optimization

  /**
   * Optional configuration for the preview panel.
   * When provided with `enabled: true`, the preview panel will be available.
   */
  previewPanel?: PreviewPanelConfig

  /**
   * Children components that will have access to the Optimization instance
   */
  children: ReactNode
}

/**
 * OptimizationRoot Component
 *
 * A convenience wrapper that combines the OptimizationProvider with optional
 * preview panel functionality. This is the recommended way to integrate the
 * Optimization SDK into your React Native app.
 *
 * The component follows the common "Root" pattern used by other React Native
 * libraries like GestureHandlerRootView, SafeAreaProvider, and NavigationContainer.
 *
 * @example
 * Basic usage without preview panel:
 * ```tsx
 * const optimization = await Optimization.create({
 *   clientId: 'your-client-id',
 *   environment: 'master'
 * })
 *
 * <OptimizationRoot instance={optimization}>
 *   <App />
 * </OptimizationRoot>
 * ```
 *
 * @example
 * With preview panel enabled:
 * ```tsx
 * import { createClient } from 'contentful'
 *
 * const contentfulClient = createClient({
 *   space: 'your-space-id',
 *   accessToken: 'your-access-token'
 * })
 *
 * <OptimizationRoot
 *   instance={optimization}
 *   previewPanel={{
 *     enabled: true,
 *     contentfulClient: contentfulClient,
 *     fabPosition: { bottom: 50, right: 20 }
 *   }}
 * >
 *   <App />
 * </OptimizationRoot>
 * ```
 */
export function OptimizationRoot({
  instance,
  previewPanel,
  children,
}: OptimizationRootProps): React.JSX.Element {
  const content = previewPanel?.enabled ? (
    <PreviewPanelOverlay
      contentfulClient={previewPanel.contentfulClient}
      fabPosition={previewPanel.fabPosition}
      onVisibilityChange={previewPanel.onVisibilityChange}
      showHeader={previewPanel.showHeader}
    >
      {children}
    </PreviewPanelOverlay>
  ) : (
    <>{children}</>
  )

  return <OptimizationProvider instance={instance}>{content}</OptimizationProvider>
}

export default OptimizationRoot
