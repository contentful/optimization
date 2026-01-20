// Polyfill crypto.randomUUID() for React Native
import './polyfills/crypto'

import {
  type CoreConfig,
  type CoreStatefulConfig,
  CoreStateful,
  effect,
  signals,
} from '@contentful/optimization-core'
import { merge } from 'es-toolkit'
import { getLocale, getPageProperties, getUserAgent } from './builders/EventBuilder'
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
        library: { name: 'Optimization React Native SDK', version: '1.0.0' },
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
  private constructor(config: CoreConfig) {
    super(config)

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
}

// Re-export all core functionality to provide a single entry point
export * from '@contentful/optimization-core'

// Explicitly re-export logger for better IDE support
export { logger } from '@contentful/optimization-core'

// Export React Native specific components
export { OptimizationProvider } from './components/OptimizationProvider'

// Component tracking components
export { Personalization } from './components/Personalization'
export type { PersonalizationProps } from './components/Personalization'

export { Analytics } from './components/Analytics'
export type { AnalyticsProps } from './components/Analytics'

// Export scroll context and provider
export { ScrollProvider, useScrollContext } from './context/ScrollContext'
export type { ScrollProviderProps } from './context/ScrollContext'

// Export hooks
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
export type { ContentfulClient, PreviewPanelProps } from './preview/types'

export default Optimization
