// Polyfill crypto.randomUUID() for React Native
import './polyfills/crypto'

// Import image type declarations to ensure they're included in the compilation
import './images'

import {
  type CoreConfig,
  type CoreStatefulConfig,
  CoreStateful,
  effect,
  signals,
} from '@contentful/optimization-core'
import { merge } from 'es-toolkit'
import { getLocale, getPageProperties, getUserAgent } from './builders/EventBuilder'
import { OPTIMIZATION_REACT_NATIVE_SDK_VERSION } from './global-constants'
import { createAppStateChangeListener, createOnlineChangeListener } from './handlers'
import AsyncStorageStore from './storage/AsyncStorageStore'

async function mergeConfig({
  defaults,
  logLevel,
  ...config
}: CoreStatefulConfig): Promise<CoreConfig> {
  // Initialize AsyncStorage before reading from it
  await AsyncStorageStore.initialize()

  const {
    consent = AsyncStorageStore.consent,
    profile = AsyncStorageStore.profile,
    changes = AsyncStorageStore.changes,
    personalizations = AsyncStorageStore.personalizations,
  } = defaults ?? {}

  return merge(
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
          name: 'Optimization React Native SDK',
          version: OPTIMIZATION_REACT_NATIVE_SDK_VERSION,
        },
        getLocale,
        getPageProperties,
        getUserAgent,
      },
      logLevel: AsyncStorageStore.debug ? 'debug' : logLevel,
    },
    config,
  )
}

class Optimization extends CoreStateful {
  private readonly cleanupOnlineListener: () => void

  private readonly cleanupAppStateListener: () => void

  private constructor(config: CoreConfig) {
    super(config)

    // Set up online/offline detection
    this.cleanupOnlineListener = createOnlineChangeListener((isOnline) => {
      this.online(isOnline)
    })

    // Set up app state change detection to flush events when app backgrounds
    this.cleanupAppStateListener = createAppStateChangeListener(async () => {
      await this.flush()
    })

    // Set up effects to sync state with AsyncStorage
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

  static async create(config: CoreConfig): Promise<Optimization> {
    const mergedConfig = await mergeConfig(config)
    return new Optimization(mergedConfig)
  }

  /**
   * Clean up event listeners and resources.
   *
   * @remarks
   * Call this method when the SDK instance is no longer needed to prevent memory leaks.
   */
  destroy(): void {
    this.cleanupOnlineListener()
    this.cleanupAppStateListener()
  }
}

// Re-export all core functionality to provide a single entry point
export * from '@contentful/optimization-core'

// Export React Native specific components
export { OptimizationProvider } from './components/OptimizationProvider'
export { OptimizationRoot } from './components/OptimizationRoot'
export type { OptimizationRootProps, PreviewPanelConfig } from './components/OptimizationRoot'

// Component tracking components
export { Personalization } from './components/Personalization'
export type { PersonalizationProps } from './components/Personalization'

export { Analytics } from './components/Analytics'
export type { AnalyticsProps } from './components/Analytics'

// Export scroll context and provider
export { ScrollProvider, useScrollContext } from './context/ScrollContext'
export type { ScrollProviderProps } from './context/ScrollContext'

// Export hooks
export { useLiveUpdates } from './context/LiveUpdatesContext'
export { useOptimization } from './context/OptimizationContext'

// Export viewport tracking hook for advanced usage
export { useViewportTracking } from './hooks/useViewportTracking'
export type {
  UseViewportTrackingOptions,
  UseViewportTrackingReturn,
} from './hooks/useViewportTracking'

// Export screen tracking hook
export { useScreenTracking } from './hooks/useScreenTracking'
export type { UseScreenTrackingOptions, UseScreenTrackingReturn } from './hooks/useScreenTracking'

// Export navigation container wrapper for automatic screen tracking
export { OptimizationNavigationContainer } from './components/OptimizationNavigationContainer'
export type { OptimizationNavigationContainerProps } from './components/OptimizationNavigationContainer'

// Preview Panel
export { PreviewPanel as OptimizationPreviewPanel } from './preview/components/PreviewPanel'
export { PreviewPanelOverlay } from './preview/components/PreviewPanelOverlay'
export type { ContentfulClient, PreviewPanelOverlayProps, PreviewPanelProps } from './preview/types'

export default Optimization
