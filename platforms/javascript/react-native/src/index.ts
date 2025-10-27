import {
  type CoreConfig,
  CoreStateful,
  type CoreStatefulConfig,
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
    analytics: { profile: analyticsProfile = AsyncStorageStore.profile } = {},
    personalization: {
      changes = AsyncStorageStore.changes,
      profile: personalizationProfile = AsyncStorageStore.profile,
      personalizations = AsyncStorageStore.personalizations,
    } = {},
  } = defaults ?? {}

  return merge(
    {
      defaults: {
        consent,
        analytics: {
          profile: analyticsProfile,
        },
        personalization: {
          changes,
          profile: personalizationProfile,
          personalizations,
        },
      },
      eventBuilder: {
        channel: 'react-native',
        library: { name: 'Optimization React Native API', version: '1.0.0' },
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
export { OptimizationTrackedView } from './components/OptimizationTrackedView'
export type { OptimizationTrackedViewProps } from './components/OptimizationTrackedView'

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

export default Optimization
