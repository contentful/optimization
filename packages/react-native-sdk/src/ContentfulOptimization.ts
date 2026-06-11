import {
  type ConsentInput,
  type CoreStatefulConfig,
  CoreStateful,
  signals,
} from '@contentful/optimization-core'
import type { OptimizationData } from '@contentful/optimization-core/api-schemas'
import { merge } from 'es-toolkit'
import {
  OPTIMIZATION_REACT_NATIVE_SDK_NAME,
  OPTIMIZATION_REACT_NATIVE_SDK_VERSION,
} from './constants'
import { createAppStateChangeListener, createOnlineChangeListener } from './handlers'
import AsyncStorageStore from './storage/AsyncStorageStore'

function resolvePersistedDefault<T>(
  configured: T | undefined,
  canLoadPersistedContinuity: boolean,
  readPersistedValue: () => T | undefined,
): T | undefined {
  if (configured !== undefined) return configured
  if (!canLoadPersistedContinuity) return undefined

  return readPersistedValue()
}

function resolveStorageDefaults(
  defaults: CoreStatefulConfig['defaults'] | undefined,
): NonNullable<CoreStatefulConfig['defaults']> {
  const consent = defaults?.consent ?? AsyncStorageStore.consent
  const persistenceConsent =
    defaults?.persistenceConsent ?? defaults?.consent ?? AsyncStorageStore.persistenceConsent
  const canLoadPersistedContinuity = persistenceConsent === true
  const profile = resolvePersistedDefault(
    defaults?.profile,
    canLoadPersistedContinuity,
    () => AsyncStorageStore.profile,
  )
  const changes = resolvePersistedDefault(
    defaults?.changes,
    canLoadPersistedContinuity,
    () => AsyncStorageStore.changes,
  )
  const selectedOptimizations = resolvePersistedDefault(
    defaults?.selectedOptimizations,
    canLoadPersistedContinuity,
    () => AsyncStorageStore.selectedOptimizations,
  )

  return { consent, persistenceConsent, profile, changes, selectedOptimizations }
}

async function mergeConfig({
  allowedEventTypes,
  defaults,
  logLevel,
  ...config
}: CoreStatefulConfig): Promise<CoreStatefulConfig> {
  await AsyncStorageStore.initializeConsentState()
  const persistenceConsent =
    defaults?.persistenceConsent ?? defaults?.consent ?? AsyncStorageStore.persistenceConsent

  if (persistenceConsent === true) {
    await AsyncStorageStore.initializeProfileContinuity()
  } else if (persistenceConsent === false) {
    await AsyncStorageStore.clearProfileContinuity()
  }

  const storageDefaults = resolveStorageDefaults(defaults)

  const mergedConfig = merge(
    {
      defaults: storageDefaults,
      eventBuilder: {
        channel: 'mobile',
        library: {
          name: OPTIMIZATION_REACT_NATIVE_SDK_NAME,
          version: OPTIMIZATION_REACT_NATIVE_SDK_VERSION,
        },
      },
      logLevel: AsyncStorageStore.debug ? 'debug' : logLevel,
      getAnonymousId:
        config.getAnonymousId ??
        (() =>
          AsyncStorageStore.persistenceConsent === true
            ? AsyncStorageStore.anonymousId
            : undefined),
    },
    config,
  )

  return {
    ...mergedConfig,
    allowedEventTypes: allowedEventTypes ?? ['identify', 'screen'],
  }
}

let activeOptimizationInstance: ContentfulOptimization | undefined = undefined

async function enqueueConsentStatePersistence(): Promise<void> {
  await AsyncStorageStore.writeConsentState({
    consent: signals.consent.value,
    persistenceConsent: signals.persistenceConsent.value,
  })
}

async function enqueueCurrentProfileContinuityPersistence(): Promise<void> {
  await AsyncStorageStore.writeProfileContinuity({
    changes: signals.changes.value,
    profile: signals.profile.value,
    selectedOptimizations: signals.selectedOptimizations.value,
  })
}

async function enqueueContinuityWriteForPolicy(data?: OptimizationData): Promise<void> {
  switch (signals.persistenceConsent.value) {
    case true:
      await (data
        ? AsyncStorageStore.writeProfileContinuity(data)
        : enqueueCurrentProfileContinuityPersistence())
      break
    case false:
      await AsyncStorageStore.clearProfileContinuity()
      break
    default:
      await AsyncStorageStore.drainPersistence()
  }
}

async function persistCurrentStateForPolicy(): Promise<void> {
  const consentWrite = enqueueConsentStatePersistence()
  const continuityWrite = enqueueContinuityWriteForPolicy()

  await consentWrite
  await continuityWrite
}

async function persistOptimizationData(data: OptimizationData): Promise<void> {
  const consentWrite = enqueueConsentStatePersistence()
  const continuityWrite = enqueueContinuityWriteForPolicy(data)

  await consentWrite
  await continuityWrite
}

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
 * import { ContentfulOptimization } from '@contentful/optimization-react-native'
 *
 * const optimization = await ContentfulOptimization.create({
 *   clientId: 'your-client-id',
 *   environment: 'main',
 * })
 * ```
 *
 * @see {@link CoreStateful}
 *
 * @public
 */
class ContentfulOptimization extends CoreStateful {
  private readonly cleanupOnlineListener: () => void

  private readonly cleanupAppStateListener: () => void

  private readonly statePersistenceInterceptorId: number

  private constructor(config: CoreStatefulConfig) {
    super(config)

    this.statePersistenceInterceptorId = this.interceptors.state.add(async (data) => {
      await persistOptimizationData(data)
      return data
    })

    this.cleanupOnlineListener = createOnlineChangeListener((isOnline) => {
      this.online = isOnline
    })

    this.cleanupAppStateListener = createAppStateChangeListener(async () => {
      await this.flush()
      await AsyncStorageStore.drainPersistence()
    })
  }

  /**
   * Creates and initializes a new ContentfulOptimization instance with React Native defaults.
   *
   * @param config - SDK configuration options
   * @returns A fully initialized ContentfulOptimization instance
   *
   * @example
   * ```ts
   * const optimization = await ContentfulOptimization.create({
   *   clientId: 'your-client-id',
   *   environment: 'main',
   * })
   * ```
   *
   * @public
   */
  static async create(config: CoreStatefulConfig): Promise<ContentfulOptimization> {
    if (activeOptimizationInstance) {
      throw new Error(
        'ContentfulOptimization React Native SDK is already initialized. Reuse the existing instance.',
      )
    }

    const mergedConfig = await mergeConfig(config)

    const instance = new ContentfulOptimization(mergedConfig)

    activeOptimizationInstance = instance
    try {
      await persistCurrentStateForPolicy()
    } catch (error: unknown) {
      activeOptimizationInstance = undefined
      instance.destroy()
      throw error
    }

    return instance
  }

  override consent(accept: ConsentInput): void {
    super.consent(accept)

    void persistCurrentStateForPolicy()
  }

  override reset(): void {
    void AsyncStorageStore.clearProfileContinuity()
    super.reset()
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
    this.interceptors.state.remove(this.statePersistenceInterceptorId)

    if (activeOptimizationInstance === this) {
      activeOptimizationInstance = undefined
    }

    super.destroy()
    void AsyncStorageStore.drainPersistence()
  }
}

export default ContentfulOptimization
