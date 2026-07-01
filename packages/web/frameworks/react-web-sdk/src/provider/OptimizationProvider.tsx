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
import { useLayoutEffect, useRef, useState, type PropsWithChildren, type ReactElement } from 'react'

import { OptimizationContext, type OptimizationSdk } from '../context/OptimizationContext'

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
  readonly sdk: OptimizationSdk | undefined
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

function canUseInjectedSdkDuringInitialRender(props: OptimizationProviderProps): boolean {
  return (
    props.sdk !== undefined &&
    props.onStatesReady === undefined &&
    props.serverOptimizationState === undefined
  )
}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement | null {
  const { children } = props
  const initialPropsRef = useRef(props)
  const liveLocale = props.sdk === undefined ? props.locale : undefined

  const sdkBindingRef = useRef<ProviderSdkBinding | undefined>(undefined)

  const [state, setState] = useState<ProviderState>(() => {
    if (canUseInjectedSdkDuringInitialRender(props)) {
      return { error: undefined, isReady: true, sdk: props.sdk }
    }

    // Two paths must defer to useLayoutEffect and cannot init here:
    // 1. serverOptimizationState — async hydration; the Promise cannot be awaited in useState.
    // 2. onStatesReady — the callback must run before children mount; on server where
    //    useLayoutEffect never fires, children must not render at all.
    if (props.serverOptimizationState !== undefined || props.onStatesReady !== undefined) {
      return { error: undefined, isReady: false, sdk: undefined }
    }

    try {
      const binding = initializeProviderSdk(props)

      if (!isPromiseLike(binding)) {
        sdkBindingRef.current = binding
        return { error: undefined, isReady: true, sdk: binding.sdk }
      }
    } catch (error: unknown) {
      return { error: toError(error), isReady: false, sdk: undefined }
    }

    return { error: undefined, isReady: false, sdk: undefined }
  })

  useLayoutEffect(() => {
    const { current: initialProps } = initialPropsRef

    if (canUseInjectedSdkDuringInitialRender(initialProps)) return

    // SDK was already initialized synchronously in useState (browser or server); only register
    // the cleanup teardown — do not create a second instance.
    if (sdkBindingRef.current !== undefined) {
      const { current: binding } = sdkBindingRef
      return () => {
        disposeSdkBinding(binding)
        sdkBindingRef.current = undefined
      }
    }

    // Async path: serverOptimizationState requires hydration before the SDK is ready.
    const setupState = { disposed: false }
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

      disposeOnce(sdkBindingRef.current)
      sdkBindingRef.current = initializedBinding
      setState({ error: undefined, isReady: true, sdk: initializedBinding.sdk })
    }

    function setInitializationError(error: unknown): void {
      if (!setupState.disposed) {
        setState({ error: toError(error), isReady: false, sdk: undefined })
      }
    }

    try {
      const initializedBinding = initializeProviderSdk(initialProps)

      if (!isPromiseLike(initializedBinding)) {
        setInitializedState(initializedBinding)
        return () => {
          setupState.disposed = true
          disposeOnce(sdkBindingRef.current)
          sdkBindingRef.current = undefined
        }
      }

      void initializedBinding.then(setInitializedState, setInitializationError)
    } catch (error: unknown) {
      setInitializationError(error)
      return
    }

    return () => {
      setupState.disposed = true
      disposeOnce(sdkBindingRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    if (state.sdk === undefined || props.sdk !== undefined || liveLocale === undefined) {
      return
    }

    try {
      state.sdk.setLocale(liveLocale)
    } catch (error: unknown) {
      setState({ error: toError(error), isReady: true, sdk: state.sdk })
    }
  }, [liveLocale, props.sdk, state.sdk])

  // Gate rendering when async setup must complete first:
  // - onStatesReady: the callback subscribes to SDK state and must run before children mount.
  // - serverOptimizationState: async hydration must finish before children see SDK-resolved data.
  // In all other cases, always render: the owned SDK initializes in useLayoutEffect and client
  // components guard on isReady/sdk in their own effects. This also allows Next.js SSR to produce
  // HTML from server components inside the provider tree.
  const needsAsyncSetup =
    props.onStatesReady !== undefined || props.serverOptimizationState !== undefined
  if (needsAsyncSetup && !state.isReady && state.error === undefined) {
    return null
  }

  return <OptimizationContext.Provider value={state}>{children}</OptimizationContext.Provider>
}
