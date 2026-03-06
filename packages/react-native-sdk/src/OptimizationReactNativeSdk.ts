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

let activeOptimizationInstance: OptimizationReactNativeSdk | undefined = undefined

/**
 * Main entry point for the Contentful Optimization React Native SDK.
 *
 * Extends {@link CoreStateful} with React Native-specific behavior including
 * AsyncStorage persistence, network connectivity detection via
 * `@react-native-community/netinfo`, and automatic event flushing when the
 * app backgrounds.
 *
 * @example Using with OptimizationProvider (recommended)
 * ```tsx
 * import { OptimizationProvider } from '@contentful/optimization-react-native'
 *
 * <OptimizationProvider clientId="your-client-id" environment="main">
 *   <App />
 * </OptimizationProvider>
 * ```
 *
 * @example Manual initialization
 * ```ts
 * import { OptimizationReactNativeSdk } from '@contentful/optimization-react-native'
 *
 * const optimization = await OptimizationReactNativeSdk.create({
 *   clientId: 'your-client-id',
 *   environment: 'main',
 * })
 * ```
 *
 * @see {@link CoreStateful}
 *
 * @public
 */
class OptimizationReactNativeSdk extends CoreStateful {
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
   * const optimization = await OptimizationReactNativeSdk.create({
   *   clientId: 'your-client-id',
   *   environment: 'main',
   * })
   * ```
   *
   * @public
   */
  static async create(config: CoreStatefulConfig): Promise<OptimizationReactNativeSdk> {
    if (activeOptimizationInstance) {
      throw new Error(
        'Optimization React Native SDK is already initialized. Reuse the existing instance.',
      )
    }

    const mergedConfig = await mergeConfig(config)

    const instance = new OptimizationReactNativeSdk(mergedConfig)
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

export default OptimizationReactNativeSdk
