import type { CoreStatefulConfig } from '@contentful/optimization-core'
import React, { type ReactNode } from 'react'
import {
  InteractionTrackingProvider,
  type TrackEntryInteractionOptions,
} from '../context/InteractionTrackingContext'
import { LiveUpdatesProvider } from '../context/LiveUpdatesContext'
import type { PreviewPanelConfig } from '../preview'
import { PreviewPanelOverlay } from '../preview/components/PreviewPanelOverlay'
import { OptimizationProvider } from './OptimizationProvider'

/**
 * Props for the {@link OptimizationRoot} component.
 *
 * Accepts all {@link CoreStatefulConfig} properties directly. Only `clientId` is required.
 *
 * @public
 */
export interface OptimizationRootProps extends CoreStatefulConfig {
  /**
   * Optional configuration for the preview panel.
   * When provided with `enabled: true`, the preview panel will be available.
   */
  previewPanel?: PreviewPanelConfig

  /**
   * Whether {@link OptimizedEntry} components react to state changes in real time.
   *
   * @defaultValue `false`
   *
   * @remarks
   * Live updates are always enabled when the preview panel is open,
   * regardless of this setting.
   */
  liveUpdates?: boolean

  /**
   * Controls which entry interactions are tracked automatically for all
   * {@link OptimizedEntry} components. Individual
   * components can override each interaction type with their `trackViews`
   * and `trackTaps` props.
   *
   * @defaultValue `{ views: true, taps: false }`
   *
   * @remarks
   * Mirrors the web SDK's `autoTrackEntryInteraction` pattern. Uses `taps`
   * instead of `clicks` to match React Native terminology.
   *
   * @example
   * ```tsx
   * <OptimizationRoot
   *   clientId="your-client-id"
   *   trackEntryInteraction={{ views: true, taps: true }}
   * >
   *   <App />
   * </OptimizationRoot>
   * ```
   */
  trackEntryInteraction?: TrackEntryInteractionOptions

  /**
   * Children components that will have access to the {@link ContentfulOptimization} instance.
   */
  children: ReactNode
}

/**
 * Recommended top-level wrapper that combines {@link OptimizationProvider} with optional
 * preview panel, live updates, and interaction tracking support.
 *
 * Handles SDK initialization internally — pass config properties directly as props.
 *
 * @param props - Component props.
 * @returns The provider tree wrapping children.
 *
 * @example Basic usage
 * ```tsx
 * <OptimizationRoot clientId="your-client-id" environment="main">
 *   <App />
 * </OptimizationRoot>
 * ```
 * @example With interaction tracking
 * ```tsx
 * <OptimizationRoot
 *   clientId="your-client-id"
 *   trackEntryInteraction={{ views: true, taps: true }}
 * >
 *   <App />
 * </OptimizationRoot>
 * ```
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
 * @see {@link OptimizedEntry} for per-entry interaction overrides
 *
 * @public
 */
export function OptimizationRoot({
  previewPanel,
  liveUpdates = false,
  trackEntryInteraction,
  children,
  ...config
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
    <OptimizationProvider {...config}>
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>
        <InteractionTrackingProvider trackEntryInteraction={trackEntryInteraction}>
          {content}
        </InteractionTrackingProvider>
      </LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

export default OptimizationRoot
