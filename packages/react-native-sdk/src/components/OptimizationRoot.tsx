import type { CoreStatefulConfig, ManagedEntryDescriptor } from '@contentful/optimization-core'
import React, { type ReactNode } from 'react'
import {
  InteractionTrackingProvider,
  type TrackEntryInteractionOptions,
} from '../context/InteractionTrackingContext'
import { LiveUpdatesProvider } from '../context/LiveUpdatesContext'
import type { OnStatesReady } from './OptimizationProvider'
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
   * Managed entries to prefetch after the SDK is ready.
   */
  prefetchManagedEntries?: readonly ManagedEntryDescriptor[]

  /**
   * Controls which entry interactions are tracked automatically for all
   * {@link OptimizedEntry} components. Individual
   * components can override each interaction type with their `trackViews`
   * and `trackTaps` props.
   *
   * @defaultValue `{ views: true, taps: true }`
   *
   * @remarks
   * Mirrors React Web's `trackEntryInteraction` pattern. Uses `taps`
   * instead of `clicks` to match React Native terminology.
   *
   * @example
   * ```tsx
   * <OptimizationRoot
   *   clientId="your-client-id"
   *   trackEntryInteraction={{ taps: false }}
   * >
   *   <App />
   * </OptimizationRoot>
   * ```
   */
  trackEntryInteraction?: TrackEntryInteractionOptions

  /**
   * Called once SDK state initialization completes and before provider children mount.
   * Return a cleanup function to unsubscribe app-level state observers on teardown.
   */
  onStatesReady?: OnStatesReady

  /**
   * Children components that will have access to the {@link ContentfulOptimization} instance.
   */
  children: ReactNode
}

/**
 * Recommended top-level wrapper that combines {@link OptimizationProvider} with optional
 * live updates and interaction tracking support.
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
 * @example With tap tracking opt out
 * ```tsx
 * <OptimizationRoot
 *   clientId="your-client-id"
 *   trackEntryInteraction={{ taps: false }}
 * >
 *   <App />
 * </OptimizationRoot>
 * ```
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
  liveUpdates = false,
  trackEntryInteraction,
  onStatesReady,
  children,
  ...config
}: OptimizationRootProps): React.JSX.Element {
  return (
    <OptimizationProvider {...config} onStatesReady={onStatesReady}>
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>
        <InteractionTrackingProvider trackEntryInteraction={trackEntryInteraction}>
          {children}
        </InteractionTrackingProvider>
      </LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

export default OptimizationRoot
