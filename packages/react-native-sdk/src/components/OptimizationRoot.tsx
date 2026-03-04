import type { CoreStatefulConfig } from '@contentful/optimization-core'
import React, { type ReactNode } from 'react'
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
 * Accepts all {@link CoreStatefulConfig} properties directly. Only `clientId` is required.
 *
 * @public
 */
export interface OptimizationReactNativeConfig extends CoreStatefulConfig {
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
 * Handles SDK initialization internally — pass config properties directly as props.
 *
 * @param props - Component props
 * @returns The provider tree wrapping children
 *
 * @example Basic usage
 * ```tsx
 * <OptimizationRoot clientId="your-client-id" environment="main">
 *   <App />
 * </OptimizationRoot>
 * ```
 *
 * @example With preview panel
 * ```tsx
 * <OptimizationRoot
 *   clientId="your-client-id"
 *   environment="main"
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
 * <OptimizationRoot clientId="your-client-id" environment="main" liveUpdates={true}>
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
  previewPanel,
  liveUpdates = false,
  children,
  ...config
}: OptimizationReactNativeConfig): React.JSX.Element {
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
    <OptimizationProvider {...config}>
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{content}</LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

export default OptimizationRoot
