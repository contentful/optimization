import {
  type ConsentInput,
  CoreStateful,
  type CoreStatefulConfig,
  type CurrentStateTrackingResult,
  type EventEmissionResult,
  hasOptimizationSelectionStateField,
  type OptimizationSelectionState,
  resolveStatefulDefaults,
  type ScreenViewBuilderArgs,
  signalFns,
  signals,
} from '@contentful/optimization-core'
import type { PartialProfile } from '@contentful/optimization-core/api-schemas'
import { merge } from 'es-toolkit'
import { Platform } from 'react-native'
import {
  OPTIMIZATION_REACT_NATIVE_SDK_NAME,
  OPTIMIZATION_REACT_NATIVE_SDK_VERSION,
} from './constants'
import { createAppStateChangeListener, createOnlineChangeListener } from './handlers'
import AsyncStorageStore from './storage/AsyncStorageStore'

function collapseCurrentScreenEmissionResult<TData>(
  result: CurrentStateTrackingResult<TData>,
): EventEmissionResult<TData> {
  if (!result.accepted) return { accepted: false }
  if (result.data === undefined) return { accepted: true }

  return { accepted: true, data: result.data }
}

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
          name: `${OPTIMIZATION_REACT_NATIVE_SDK_NAME}-${Platform.OS}`,
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

async function enqueueContinuityWriteForPolicy(state?: OptimizationSelectionState): Promise<void> {
  switch (signals.persistenceConsent.value) {
    case true:
      if (!state) {
        await enqueueCurrentProfileContinuityPersistence()
        break
      }

      await AsyncStorageStore.writeProfileContinuity({
        changes: hasOptimizationSelectionStateField(state, 'changes')
          ? state.changes
          : AsyncStorageStore.changes,
        profile: hasOptimizationSelectionStateField(state, 'profile')
          ? state.profile
          : AsyncStorageStore.profile,
        selectedOptimizations: hasOptimizationSelectionStateField(state, 'selectedOptimizations')
          ? state.selectedOptimizations
          : AsyncStorageStore.selectedOptimizations,
      })
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

async function persistOptimizationState(state: OptimizationSelectionState): Promise<void> {
  const consentWrite = enqueueConsentStatePersistence()
  const continuityWrite = enqueueContinuityWriteForPolicy(state)

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
  private stagedOptimizationState: OptimizationSelectionState | undefined

  private constructor(config: CoreStatefulConfig) {
    super(config)

    try {
      this.registerDisposer(() => {
        if (activeOptimizationInstance === this) activeOptimizationInstance = undefined
        void AsyncStorageStore.drainPersistence()
      })

      const statePersistenceInterceptorId = this.interceptors.state.add((data) => {
        this.stagedOptimizationState = data
        return data
      })
      this.registerDisposer(() => {
        this.interceptors.state.remove(statePersistenceInterceptorId)
      })
      this.registerEffect(() => {
        if (signals.experienceRequestState.value.status !== 'success') {
          this.stagedOptimizationState = undefined
          return
        }

        const { stagedOptimizationState } = this
        this.stagedOptimizationState = undefined
        if (!stagedOptimizationState) return

        signalFns.untracked(() => {
          void persistOptimizationState(stagedOptimizationState)
        })
      })

      this.registerDisposer(
        createOnlineChangeListener((isOnline) => {
          this.online = isOnline
        }),
      )

      this.registerDisposer(
        createAppStateChangeListener(async () => {
          await this.flush()
          await AsyncStorageStore.drainPersistence()
        }),
      )
    } catch (error) {
      super.destroy()
      throw error
    }
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
   * Track the current React Native screen with route-key deduplication.
   *
   * @remarks
   * Automatic screen tracking should use this helper. Manual `screen()` calls
   * remain direct emits and are not deduplicated. Same-key calls join the
   * owning in-flight screen emission. The public result remains
   * {@link EventEmissionResult}: an internally accepted attempt preserves its
   * data, while deduplicated, blocked, non-accepted, or superseded attempts
   * collapse to `{ accepted: false }`. Current-screen tracking is online-only
   * and is never enqueued; call this method again after reconnecting to retry.
   *
   * @public
   */
  async trackCurrentScreen({
    routeKey,
    ...payload
  }: TrackCurrentScreenPayload): Promise<EventEmissionResult> {
    const key = routeKey ?? payload.screen?.name ?? payload.name
    const result = await this.emitCurrentScreen(key, () => payload)

    return collapseCurrentScreenEmissionResult(result)
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
    super.destroy()
  }
}

export default ContentfulOptimization
