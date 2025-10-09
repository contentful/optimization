import { type CoreConfig, CoreStateful, effect, signals } from '@contentful/optimization-core'
import { merge } from 'es-toolkit'
import { getLocale, getPageProperties, getUserAgent } from './builders/EventBuilder'
import AsyncStorageStore from './storage/AsyncStorageStore'

async function mergeConfig({ defaults, logLevel, ...config }: CoreConfig): Promise<CoreConfig> {
  // Initialize AsyncStorage before reading from it
  await AsyncStorageStore.initialize()

  return merge(
    {
      defaults: {
        changes: AsyncStorageStore.changes ?? defaults?.changes,
        consent: AsyncStorageStore.consent ?? defaults?.consent,
        profile: AsyncStorageStore.profile ?? defaults?.profile,
        variants: AsyncStorageStore.variants ?? defaults?.variants,
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
        variants: { value },
      } = signals

      AsyncStorageStore.variants = value
    })
  }

  static async create(config: CoreConfig): Promise<Optimization> {
    const mergedConfig = await mergeConfig(config)
    return new Optimization(mergedConfig)
  }
}

// Export components
export { OptimizationProvider } from './components/OptimizationProvider'

export default Optimization
