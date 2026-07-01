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

  // sdkBindingRef holds the binding created during initialization so the
  // useLayoutEffect cleanup can dispose it without re-creating the SDK.
  const sdkBindingRef = useRef<ProviderSdkBinding | undefined>(undefined)

  const [state, setState] = useState<ProviderState>(() => {
    if (canUseInjectedSdkDuringInitialRender(props)) {
      return { error: undefined, isReady: true, sdk: props.sdk }
    }

    // Async hydration path — defer to useLayoutEffect
    if (props.serverOptimizationState !== undefined) {
      return { error: undefined, isReady: false, sdk: undefined }
    }

    // On the server (no window) it is safe to run synchronous initialization here:
    // useState initializers run exactly once during SSR, so no double-init risk.
    // In the browser, defer to useLayoutEffect to avoid StrictMode double-invocation.
    if (typeof window !== 'undefined') {
      return { error: undefined, isReady: false, sdk: undefined }
    }

    try {
      const result = initializeProviderSdk(props)

      if (!isPromiseLike(result)) {
        sdkBindingRef.current = result
        return { error: undefined, isReady: true, sdk: result.sdk }
      }
    } catch (error: unknown) {
      return { error: toError(error), isReady: false, sdk: undefined }
    }

    return { error: undefined, isReady: false, sdk: undefined }
  })

  useLayoutEffect(() => {
    const { current: initialProps } = initialPropsRef

    // Sync init already ran in useState — just register cleanup for the binding.
    if (sdkBindingRef.current !== undefined) {
      const { current: binding } = sdkBindingRef

      return () => {
        disposeSdkBinding(binding)
        sdkBindingRef.current = undefined
      }
    }

    if (canUseInjectedSdkDuringInitialRender(initialProps)) return

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
        sdkBindingRef.current = initializedBinding
        return () => {
          setupState.disposed = true
          disposeOnce(sdkBindingRef.current)
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

  // When onStatesReady is set, gate rendering until the callback has run — the app may subscribe
  // to SDK state in the callback and children must not mount before that.
  // Without onStatesReady, always render: the owned SDK initializes in useLayoutEffect and
  // client components already guard on isReady/sdk in their own effects. This also allows
  // Next.js SSR to produce HTML from server components that live inside the provider tree.
  if (props.onStatesReady && !state.isReady && state.error === undefined) {
    return null
  }

  return <OptimizationContext.Provider value={state}>{children}</OptimizationContext.Provider>
}
