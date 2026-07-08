import ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { hydrateOptimizationData } from '@contentful/optimization-web/bridge-support'
import { DEFAULT_WEB_ALLOWED_EVENT_TYPES } from '@contentful/optimization-web/constants'
import {
  createOptimizationRootSdkBinding,
  disposeOptimizationRootSdkBinding,
  getOptimizedEntrySourceKey,
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

import {
  createWebSnapshotRuntime,
  type WebOptimizationRuntime,
} from '@contentful/optimization-web/runtime'
import { OptimizationContext, type OptimizationSdk } from '../context/OptimizationContext'
import type { ManagedEntryDescriptor, ManagedEntryHandoff } from '../server-optimized-entries'

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
  /**
   * Server-fetched baseline entries for SDK-managed OptimizedEntry hydration.
   */
  readonly prefetchedManagedEntries?: readonly ManagedEntryHandoff[]
  /**
   * Managed entries to prefetch after the live SDK is ready.
   */
  readonly prefetchManagedEntries?: readonly ManagedEntryDescriptor[]
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
       * Called once the live SDK state surface is initialized.
       * Return a cleanup function to unsubscribe app-level state observers on teardown.
       */
      readonly onStatesReady?: OnStatesReady
      readonly sdk?: never
    }
>

export type OptimizationProviderSdkProps = PropsWithChildren<
  ServerOptimizationStateProps & {
    /**
     * Called with the injected SDK state surface before provider children mount unless a server
     * snapshot is provided for the initial render.
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
    prefetchedManagedEntries: _prefetchedManagedEntries,
    prefetchManagedEntries: _prefetchManagedEntries,
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

function canUseInjectedSdkDuringInitialRender(props: OptimizationProviderProps): boolean {
  return (
    props.sdk !== undefined &&
    props.onStatesReady === undefined &&
    props.serverOptimizationState === undefined
  )
}

function injectedSdkBacksInitialRender(props: OptimizationProviderProps): boolean {
  return props.sdk !== undefined && props.serverOptimizationState === undefined
}

function createInitialRuntime(props: OptimizationProviderProps): WebOptimizationRuntime {
  if (props.sdk !== undefined) {
    return injectedSdkBacksInitialRender(props)
      ? props.sdk
      : createWebSnapshotRuntime({ data: props.serverOptimizationState })
  }

  return createWebSnapshotRuntime({
    allowedEventTypes: props.allowedEventTypes ?? DEFAULT_WEB_ALLOWED_EVENT_TYPES,
    consent: props.defaults?.consent,
    data: props.serverOptimizationState,
    locale: props.locale,
    persistenceConsent: props.defaults?.persistenceConsent,
  })
}

function createPrefetchedManagedEntries(
  entries: readonly ManagedEntryHandoff[] | undefined,
): ReadonlyMap<string, ManagedEntryHandoff['baselineEntry']> | undefined {
  if (entries === undefined) return undefined

  const map = new Map<string, ManagedEntryHandoff['baselineEntry']>()
  for (const { baselineEntry, entryId, entryQuery } of entries) {
    map.set(getOptimizedEntrySourceKey(entryId, entryQuery), baselineEntry)
  }

  return map
}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement {
  const { children } = props
  const initialPropsRef = useRef(props)
  const liveLocale = props.sdk === undefined ? props.locale : undefined
  const [state, setState] = useState<ProviderState>(() => ({
    error: undefined,
    isLive: injectedSdkBacksInitialRender(props),
    runtime: createInitialRuntime(props),
  }))
  const prefetchedManagedEntries = useMemo(
    () => createPrefetchedManagedEntries(props.prefetchedManagedEntries),
    [props.prefetchedManagedEntries],
  )

  useLayoutEffect(() => {
    const { current: initialProps } = initialPropsRef

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
      setState({ error: undefined, isLive: true, runtime: initializedBinding.sdk })
    }

    function setInitializationError(error: unknown): void {
      if (!setupState.disposed) {
        setState({ error: toError(error), isLive: false, runtime: undefined })
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
      setState({ error: toError(error), isLive: true, runtime: state.runtime })
    }
  }, [liveLocale, props.sdk, state.isLive, state.runtime])

  useLayoutEffect(() => {
    if (
      !state.isLive ||
      state.runtime === undefined ||
      props.prefetchManagedEntries === undefined
    ) {
      return
    }

    let disposed = false

    void state.runtime
      .prefetchManagedEntries(props.prefetchManagedEntries)
      .catch((error: unknown) => {
        if (!disposed) {
          setState({ error: toError(error), isLive: true, runtime: state.runtime })
        }
      })

    return () => {
      disposed = true
    }
  }, [props.prefetchManagedEntries, state.isLive, state.runtime])

  const contextValue = useMemo(
    () => ({
      sdk: state.runtime,
      error: state.error,
      isLive: state.isLive,
      prefetchedManagedEntries,
    }),
    [state.runtime, state.error, state.isLive, prefetchedManagedEntries],
  )

  return (
    <OptimizationContext.Provider value={contextValue}>{children}</OptimizationContext.Provider>
  )
}
