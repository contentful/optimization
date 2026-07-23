import {
  AcceptedCurrentStateTracker,
  type ConsentInput,
  CoreStateful,
  type CoreStatefulConfig,
  type EventEmissionResult,
  resolveStatefulDefaults,
  type ScreenViewBuilderArgs,
  signals,
} from '@contentful/optimization-core'
import type { OptimizationData, PartialProfile } from '@contentful/optimization-core/api-schemas'
import { merge } from 'es-toolkit'
import {
  OPTIMIZATION_REACT_NATIVE_SDK_NAME,
  OPTIMIZATION_REACT_NATIVE_SDK_VERSION,
} from './constants'
import { createAppStateChangeListener, createOnlineChangeListener } from './handlers'
import AsyncStorageStore from './storage/AsyncStorageStore'

function resolveStorageDefaults(
  defaults: CoreStatefulConfig['defaults'] | undefined,
): NonNullable<CoreStatefulConfig['defaults']> {
  return resolveStatefulDefaults(defaults, {
    consent: AsyncStorageStore.consent,
    persistenceConsent: AsyncStorageStore.persistenceConsent,
    profile: () => AsyncStorageStore.profile,
    changes: () => AsyncStorageStore.changes,
    selectedOptimizations: () => AsyncStorageStore.selectedOptimizations,
  }).defaults
}

async function mergeConfig({
  allowedEventTypes,
  defaults,
  logLevel,
  ...config
}: CoreStatefulConfig): Promise<CoreStatefulConfig> {
  await AsyncStorageStore.initializeConsentState()
  const { canLoadPersistedContinuity, defaults: initialDefaults } = resolveStatefulDefaults(
    defaults,
    {
      consent: AsyncStorageStore.consent,
      persistenceConsent: AsyncStorageStore.persistenceConsent,
    },
  )

  if (canLoadPersistedContinuity) {
    await AsyncStorageStore.initializeProfileContinuity()
  } else if (initialDefaults.persistenceConsent === false) {
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
 * Payload for {@link ContentfulOptimization.trackCurrentScreen}.
 *
 * @public
 */
export type TrackCurrentScreenPayload = ScreenViewBuilderArgs & {
  /**
   * Stable screen identity used for current-screen deduplication.
   */
  routeKey?: string
  profile?: PartialProfile
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
 * const optimization = await ContentfulOptimization.initialize({
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
  private readonly currentScreenTracker = new AcceptedCurrentStateTracker<string>()

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
   * Async initializer for a ContentfulOptimization SDK instance with React Native defaults.
   *
   * @param config - SDK configuration options
   * @returns An initialized ContentfulOptimization instance
   *
   * @example
   * ```ts
   * const optimization = await ContentfulOptimization.initialize({
   *   clientId: 'your-client-id',
   *   environment: 'main',
   * })
   * ```
   *
   * @public
   */
  static async initialize(config: CoreStatefulConfig): Promise<ContentfulOptimization> {
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
    this.currentScreenTracker.reset()
    void AsyncStorageStore.clearProfileContinuity()
    super.reset()
  }

  /**
   * Track the current React Native screen with route-key deduplication.
   *
   * @remarks
   * Automatic screen tracking should use this helper. Manual `screen()` calls
   * remain direct emits and are not deduplicated.
   *
   * @public
   */
  async trackCurrentScreen({
    routeKey,
    ...payload
  }: TrackCurrentScreenPayload): Promise<EventEmissionResult> {
    const key = routeKey ?? payload.screen?.name ?? payload.name
    const result = await this.currentScreenTracker.emitIfNeeded({
      key,
      isAllowed: this.hasConsent('screen'),
      emit: async () => await this.screen(payload),
    })

    if (!result.accepted) return { accepted: false }
    if (result.data === undefined) return { accepted: true }

    return { accepted: true, data: result.data }
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
