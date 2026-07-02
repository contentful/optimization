import ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { hydrateOptimizationData } from '@contentful/optimization-web/bridge-support'
import {
  createOptimizationRootSdkBinding,
  disposeOptimizationRootSdkBinding,
  type OptimizationRootSdkBinding,
  type OptimizationRootSdkConfig,
  type OnStatesReady as SharedOnStatesReady,
  type TrackEntryInteractionOptions as SharedTrackEntryInteractionOptions,
} from '@contentful/optimization-web/presentation'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from 'react'

import { OptimizationContext, type OptimizationSdk } from '../context/OptimizationContext'
import { createWebSnapshotRuntime, type WebOptimizationRuntime } from '../runtime/webRuntime'

/**
 * Provider-owned callback for app-level subscriptions once SDK state is ready.
 *
 * @public
 */
export type OnStatesReady = SharedOnStatesReady<OptimizationSdk>
export type TrackEntryInteractionOptions = SharedTrackEntryInteractionOptions

type OptimizationProviderBaseConfigProps = OptimizationRootSdkConfig
type ProviderSdkBinding = OptimizationRootSdkBinding<OptimizationSdk>

interface ProviderState {
  readonly error: Error | undefined
  readonly isReady: boolean
  /** Whether `runtime` is the live browser SDK (vs the initial snapshot runtime). */
  readonly isLive: boolean
  readonly runtime: WebOptimizationRuntime | undefined
}

interface ServerOptimizationStateProps {
  /**
   * Server-returned Optimization state to apply before provider children mount.
   *
   * @remarks
   * Use this for server-to-browser state handoff. Keep `defaults` for configuration and default
   * state such as consent policy.
   */
  readonly serverOptimizationState?: OptimizationData
}

export type OptimizationProviderConfigProps = PropsWithChildren<
  OptimizationProviderBaseConfigProps &
    ServerOptimizationStateProps & {
      /**
       * Controls automatic entry interaction tracking for OptimizedEntry components.
       *
       * @defaultValue `{ views: true, clicks: true, hovers: true }`
       */
      readonly trackEntryInteraction?: TrackEntryInteractionOptions
      /**
       * Called once the SDK state surface is initialized and before provider children mount.
       * Return a cleanup function to unsubscribe app-level state observers on teardown.
       */
      readonly onStatesReady?: OnStatesReady
      readonly sdk?: never
    }
>

export type OptimizationProviderSdkProps = PropsWithChildren<
  ServerOptimizationStateProps & {
    /**
     * Called with the injected SDK state surface before provider children mount.
     * Return a cleanup function to unsubscribe app-level state observers on teardown.
     */
    readonly onStatesReady?: OnStatesReady
    readonly sdk: OptimizationSdk
  }
>

export type OptimizationProviderProps =
  | OptimizationProviderConfigProps
  | OptimizationProviderSdkProps

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function createInjectedSdkBinding(props: OptimizationProviderSdkProps): ProviderSdkBinding {
  const { sdk } = props

  return createOptimizationRootSdkBinding({ sdk })
}

function createOwnedSdkBinding(props: OptimizationProviderConfigProps): ProviderSdkBinding {
  const {
    children: _children,
    onStatesReady: _onStatesReady,
    sdk: _sdk,
    serverOptimizationState: _serverOptimizationState,
    trackEntryInteraction,
    ...config
  } = props

  return createOptimizationRootSdkBinding({
    config,
    createSdk: (sdkConfig) => new ContentfulOptimization(sdkConfig),
    trackEntryInteraction,
  })
}

function disposeSdkBinding(sdkBinding: ProviderSdkBinding | undefined): void {
  disposeOptimizationRootSdkBinding(sdkBinding)
}

function bindOnStatesReady(
  sdkBinding: ProviderSdkBinding,
  onStatesReady: OnStatesReady | undefined,
): ProviderSdkBinding {
  const cleanup = onStatesReady?.(sdkBinding.sdk.states)

  if (typeof cleanup !== 'function') {
    return sdkBinding
  }

  return { ...sdkBinding, cleanup }
}

async function initializeServerOptimizationState(
  sdkBinding: ProviderSdkBinding,
  serverOptimizationState: OptimizationData,
  onStatesReady: OnStatesReady | undefined,
): Promise<ProviderSdkBinding> {
  try {
    await hydrateOptimizationData(sdkBinding.sdk, serverOptimizationState)

    return bindOnStatesReady(sdkBinding, onStatesReady)
  } catch (error: unknown) {
    disposeSdkBinding(sdkBinding)
    throw error
  }
}

function initializeProviderSdk(
  props: OptimizationProviderProps,
): ProviderSdkBinding | Promise<ProviderSdkBinding> {
  const sdkBinding =
    props.sdk === undefined ? createOwnedSdkBinding(props) : createInjectedSdkBinding(props)

  if (props.serverOptimizationState === undefined) {
    try {
      return bindOnStatesReady(sdkBinding, props.onStatesReady)
    } catch (error: unknown) {
      disposeSdkBinding(sdkBinding)
      throw error
    }
  }

  return initializeServerOptimizationState(
    sdkBinding,
    props.serverOptimizationState,
    props.onStatesReady,
  )
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return value instanceof Promise
}

/**
 * Whether an injected SDK can back the initial render directly, with no
 * asynchronous setup to run first.
 *
 * @remarks
 * When true, the initial-render runtime is already the final live runtime, so
 * the mount effect must not re-set state — this keeps the context identity
 * stable across re-renders.
 */
function canUseInjectedSdkDuringInitialRender(props: OptimizationProviderProps): boolean {
  return (
    props.sdk !== undefined &&
    props.onStatesReady === undefined &&
    props.serverOptimizationState === undefined
  )
}

/**
 * Build the runtime used for the initial render (server render and the first
 * client render, before the mount effect runs).
 *
 * @remarks
 * With a config-driven provider this is a read-only snapshot runtime seeded from
 * server state plus the configured consent/locale defaults, so it reports the
 * same values the live SDK will after hydration. With an injected SDK the live
 * instance is already available and is used directly.
 */
function createInitialRuntime(props: OptimizationProviderProps): WebOptimizationRuntime {
  if (props.sdk !== undefined) {
    return props.sdk
  }

  return createWebSnapshotRuntime({
    data: props.serverOptimizationState,
    consent: props.defaults?.consent,
    persistenceConsent: props.defaults?.persistenceConsent,
    locale: props.locale,
  })
}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement {
  const { children } = props
  const initialPropsRef = useRef(props)
  const liveLocale = props.sdk === undefined ? props.locale : undefined
  const [state, setState] = useState<ProviderState>(() => {
    const injectedIsLive = canUseInjectedSdkDuringInitialRender(props)

    return {
      error: undefined,
      isReady: true,
      isLive: injectedIsLive,
      runtime: createInitialRuntime(props),
    }
  })

  useLayoutEffect(() => {
    const { current: initialProps } = initialPropsRef

    // An injected SDK with no async setup already backs the initial render; do
    // not re-set state so the context value identity stays stable.
    if (canUseInjectedSdkDuringInitialRender(initialProps)) {
      return
    }

    const setupState = { disposed: false }
    let sdkBinding: ProviderSdkBinding | undefined = undefined
    let disposedBinding: ProviderSdkBinding | undefined = undefined

    function disposeOnce(binding: ProviderSdkBinding | undefined): void {
      if (binding === undefined || binding === disposedBinding) return

      disposeSdkBinding(binding)
      disposedBinding = binding
    }

    function setInitializedState(initializedBinding: ProviderSdkBinding): void {
      if (setupState.disposed) {
        disposeOnce(initializedBinding)
        return
      }

      sdkBinding = initializedBinding
      setState({ error: undefined, isReady: true, isLive: true, runtime: initializedBinding.sdk })
    }

    function setInitializationError(error: unknown): void {
      if (!setupState.disposed) {
        setState({ error: toError(error), isReady: false, isLive: false, runtime: undefined })
      }
    }

    try {
      const initializedBinding = initializeProviderSdk(initialProps)

      if (!isPromiseLike(initializedBinding)) {
        setInitializedState(initializedBinding)

        return () => {
          setupState.disposed = true
          disposeOnce(sdkBinding)
        }
      }

      void initializedBinding.then(setInitializedState, setInitializationError)
    } catch (error: unknown) {
      setInitializationError(error)
      return
    }

    return () => {
      setupState.disposed = true
      disposeOnce(sdkBinding)
    }
  }, [])

  useLayoutEffect(() => {
    if (!state.isLive || state.runtime === undefined || props.sdk !== undefined) {
      return
    }
    if (liveLocale === undefined) {
      return
    }

    try {
      state.runtime.setLocale(liveLocale)
    } catch (error: unknown) {
      setState({ error: toError(error), isReady: true, isLive: true, runtime: state.runtime })
    }
  }, [liveLocale, props.sdk, state.isLive, state.runtime])

  const contextValue = useMemo(
    () => ({ sdk: state.runtime, isReady: state.isReady, error: state.error }),
    [state.runtime, state.isReady, state.error],
  )

  return (
    <OptimizationContext.Provider value={contextValue}>{children}</OptimizationContext.Provider>
  )
}
