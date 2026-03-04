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

import {
  type CoreStatefulConfig,
  CoreStateful,
  effect,
  signals,
} from '@contentful/optimization-core'
import { merge } from 'es-toolkit'
import {
  OPTIMIZATION_REACT_NATIVE_SDK_NAME,
  OPTIMIZATION_REACT_NATIVE_SDK_VERSION,
} from './constants'
import { createAppStateChangeListener, createOnlineChangeListener } from './handlers'
import AsyncStorageStore from './storage/AsyncStorageStore'

/**
 * Merges user-supplied configuration with React Native-specific defaults
 * and values restored from AsyncStorage.
 *
 * @param config - The user-supplied SDK configuration
 * @returns Fully resolved configuration with defaults applied
 *
 * @internal
 */
async function mergeConfig({
  allowedEventTypes,
  defaults,
  logLevel,
  ...config
}: CoreStatefulConfig): Promise<CoreStatefulConfig> {
  await AsyncStorageStore.initialize()

  const {
    consent = AsyncStorageStore.consent,
    profile = AsyncStorageStore.profile,
    changes = AsyncStorageStore.changes,
    personalizations = AsyncStorageStore.personalizations,
  } = defaults ?? {}

  const mergedConfig = merge(
    {
      defaults: {
        consent,
        profile,
        changes,
        personalizations,
      },
      eventBuilder: {
        channel: 'mobile',
        library: {
          name: OPTIMIZATION_REACT_NATIVE_SDK_NAME,
          version: OPTIMIZATION_REACT_NATIVE_SDK_VERSION,
        },
      },
      logLevel: AsyncStorageStore.debug ? 'debug' : logLevel,
    },
    config,
  )

  return {
    ...mergedConfig,
    allowedEventTypes: allowedEventTypes ?? ['identify', 'screen'],
  }
}

let activeOptimizationInstance: Optimization | undefined = undefined

/**
 * Main entry point for the Contentful Optimization React Native SDK.
 *
 * Extends {@link CoreStateful} with React Native-specific behavior including
 * AsyncStorage persistence, network connectivity detection via
 * `@react-native-community/netinfo`, and automatic event flushing when the
 * app backgrounds.
 *
 * @example
 * ```ts
 * import Optimization from '@contentful/optimization-react-native'
 *
 * const optimization = await Optimization.create({
 *   clientId: 'your-client-id',
 *   environment: 'main',
 * })
 * ```
 *
 * @see {@link CoreStateful}
 *
 * @public
 */
class Optimization extends CoreStateful {
  private readonly cleanupOnlineListener: () => void

  private readonly cleanupAppStateListener: () => void

  private constructor(config: CoreStatefulConfig) {
    super(config)

    this.cleanupOnlineListener = createOnlineChangeListener((isOnline) => {
      this.online = isOnline
    })

    this.cleanupAppStateListener = createAppStateChangeListener(async () => {
      await this.flush()
    })

    effect(() => {
      const {
        changes: { value },
      } = signals

      AsyncStorageStore.changes = value
    })

    effect(() => {
      const {
        consent: { value },
      } = signals

      AsyncStorageStore.consent = value
    })

    effect(() => {
      const {
        profile: { value },
      } = signals

      AsyncStorageStore.profile = value

      const { anonymousId: storedAnonymousId } = AsyncStorageStore

      AsyncStorageStore.anonymousId = value?.id ?? storedAnonymousId
    })

    effect(() => {
      const {
        personalizations: { value },
      } = signals

      AsyncStorageStore.personalizations = value
    })
  }

  /**
   * Creates and initializes a new Optimization instance with React Native defaults.
   *
   * @param config - SDK configuration options
   * @returns A fully initialized Optimization instance
   *
   * @example
   * ```ts
   * const optimization = await Optimization.create({
   *   clientId: 'your-client-id',
   *   environment: 'main',
   * })
   * ```
   *
   * @public
   */
  static async create(config: CoreStatefulConfig): Promise<Optimization> {
    if (activeOptimizationInstance) {
      throw new Error(
        'Optimization React Native SDK is already initialized. Reuse the existing instance.',
      )
    }

    const mergedConfig = await mergeConfig(config)

    const instance = new Optimization(mergedConfig)
    activeOptimizationInstance = instance

    return instance
  }

  /**
   * Cleans up event listeners and resources.
   *
   * @remarks
   * Call this method when the SDK instance is no longer needed to prevent memory leaks.
   *
   * @example
   * ```ts
   * optimization.destroy()
   * ```
   *
   * @public
   */
  destroy(): void {
    this.cleanupOnlineListener()
    this.cleanupAppStateListener()

    if (activeOptimizationInstance === this) {
      activeOptimizationInstance = undefined
    }

    super.destroy()
  }
}

export { OptimizationProvider } from './components/OptimizationProvider'
export { OptimizationRoot } from './components/OptimizationRoot'
export type { OptimizationRootProps, PreviewPanelConfig } from './components/OptimizationRoot'

export { Personalization } from './components/Personalization'
export type { PersonalizationProps } from './components/Personalization'

export { Analytics } from './components/Analytics'
export type { AnalyticsProps } from './components/Analytics'

export { OptimizationScrollProvider, useScrollContext } from './context/OptimizationScrollContext'
export type { OptimizationScrollProviderProps } from './context/OptimizationScrollContext'

export { useLiveUpdates } from './context/LiveUpdatesContext'
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

export default Optimization
