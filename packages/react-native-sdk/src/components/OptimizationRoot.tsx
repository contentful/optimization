import React, { type ReactNode } from 'react'
import type Optimization from '../'
import { LiveUpdatesProvider } from '../context/LiveUpdatesContext'
import { PreviewPanelOverlay } from '../preview/components/PreviewPanelOverlay'
import type { ContentfulClient } from '../preview/types'
import { OptimizationProvider } from './OptimizationProvider'

/**
 * Configuration options for the preview panel feature.
 *
 * @public
 */
export interface PreviewPanelConfig {
  /**
   * Whether the preview panel is enabled.
   * When `true`, a floating action button appears that opens the preview panel.
   */
  enabled: boolean

  /**
   * Contentful client instance used to fetch `nt_audience` and `nt_experience` entries.
   */
  contentfulClient: ContentfulClient

  /**
   * Optional positioning overrides for the floating action button.
   */
  fabPosition?: { bottom?: number; right?: number }

  /**
   * Called when the panel visibility changes.
   */
  onVisibilityChange?: (isVisible: boolean) => void

  /**
   * Whether to show the header with title in the preview panel.
   */
  showHeader?: boolean
}

/**
 * Props for the {@link OptimizationRoot} component.
 *
 * @public
 */
export interface OptimizationRootProps {
  /**
   * The Optimization instance to provide to child components.
   */
  instance: Optimization

  /**
   * Optional configuration for the preview panel.
   * When provided with `enabled: true`, the preview panel will be available.
   */
  previewPanel?: PreviewPanelConfig

  /**
   * Whether {@link Personalization} components should react to state changes in real-time.
   *
   * @remarks
   * Live updates are always enabled when the preview panel is open,
   * regardless of this setting.
   *
   * @defaultValue false
   */
  liveUpdates?: boolean

  /**
   * Children components that will have access to the Optimization instance.
   */
  children: ReactNode
}

/**
 * Recommended top-level wrapper that combines {@link OptimizationProvider} with optional
 * preview panel and live updates support.
 *
 * @param props - Component props
 * @returns The provider tree wrapping children
 *
 * @example Basic usage
 * ```tsx
 * const optimization = await Optimization.create({
 *   clientId: 'your-client-id',
 *   environment: 'main',
 * })
 *
 * <OptimizationRoot instance={optimization}>
 *   <App />
 * </OptimizationRoot>
 * ```
 *
 * @example With preview panel
 * ```tsx
 * <OptimizationRoot
 *   instance={optimization}
 *   previewPanel={{
 *     enabled: __DEV__,
 *     contentfulClient,
 *     fabPosition: { bottom: 50, right: 20 },
 *   }}
 * >
 *   <App />
 * </OptimizationRoot>
 * ```
 *
 * @example With global live updates
 * ```tsx
 * <OptimizationRoot instance={optimization} liveUpdates={true}>
 *   <App />
 * </OptimizationRoot>
 * ```
 *
 * @see {@link OptimizationProvider}
 * @see {@link Personalization} for per-component live updates override
 *
 * @public
 */
export function OptimizationRoot({
  instance,
  previewPanel,
  liveUpdates = false,
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

  return (
    <OptimizationProvider instance={instance}>
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{content}</LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

export default OptimizationRoot
