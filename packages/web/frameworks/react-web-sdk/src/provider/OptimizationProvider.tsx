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
import { useLayoutEffect, useState, type PropsWithChildren, type ReactElement } from 'react'

import { OptimizationContext, type OptimizationSdk } from '../context/OptimizationContext'
import { useLifecycle } from '../lib/useLifecycle'

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

const PENDING_STATE: ProviderState = { error: undefined, isReady: false, sdk: undefined }

function readyState(sdk: OptimizationSdk): ProviderState {
  return { error: undefined, isReady: true, sdk }
}

function failedState(error: unknown): ProviderState {
  return { error: toError(error), isReady: false, sdk: undefined }
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
    createSdk: (sdkConfig) => {
      if (typeof window !== 'undefined') window.contentfulOptimization?.destroy()
      return new ContentfulOptimization(sdkConfig)
    },
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

function initializeProviderSdk(
  props: OptimizationProviderProps,
): ProviderSdkBinding | Promise<ProviderSdkBinding> {
  const sdkBinding =
    props.sdk === undefined
      ? createOwnedSdkBinding(props)
      : createOptimizationRootSdkBinding({ sdk: props.sdk })

  if (props.serverOptimizationState === undefined) {
    try {
      return bindOnStatesReady(sdkBinding, props.onStatesReady)
    } catch (error: unknown) {
      disposeSdkBinding(sdkBinding)
      throw error
    }
  }

  return hydrateOptimizationData(sdkBinding.sdk, props.serverOptimizationState)
    .then(() => bindOnStatesReady(sdkBinding, props.onStatesReady))
    .catch((error: unknown) => {
      disposeSdkBinding(sdkBinding)
      throw error
    })
}

function canUseInjectedSdkDuringInitialRender(
  props: OptimizationProviderProps,
): props is OptimizationProviderSdkProps & {
  readonly onStatesReady: undefined
  readonly serverOptimizationState: undefined
} {
  return (
    props.sdk !== undefined &&
    props.onStatesReady === undefined &&
    props.serverOptimizationState === undefined
  )
}

function requiresAsyncSetup(props: OptimizationProviderProps): boolean {
  return props.serverOptimizationState !== undefined || props.onStatesReady !== undefined
}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement | null {
  const lifecycle = useLifecycle<ProviderSdkBinding>(
    (): ProviderSdkBinding | Promise<ProviderSdkBinding> => initializeProviderSdk(props),
    disposeSdkBinding,
  )

  const [state, setState] = useState<ProviderState>(() => {
    if (canUseInjectedSdkDuringInitialRender(props)) {
      return readyState(props.sdk)
    }
    if (requiresAsyncSetup(props)) {
      return PENDING_STATE
    }
    const result = lifecycle.init()
    if (result === undefined) return PENDING_STATE
    if ('error' in result) return failedState(result.error)
    return readyState(result.value.sdk)
  })

  const liveLocale = props.sdk === undefined ? props.locale : undefined

  useLayoutEffect(() => {
    if (canUseInjectedSdkDuringInitialRender(props)) return
    return lifecycle.mount(
      (binding) => {
        setState(readyState(binding.sdk))
      },
      (error) => {
        setState(failedState(error))
      },
    )
  }, [])

  useLayoutEffect(() => {
    if (state.sdk === undefined || liveLocale === undefined) return

    try {
      state.sdk.setLocale(liveLocale)
    } catch (error: unknown) {
      setState({ ...readyState(state.sdk), error: toError(error) })
    }
  }, [liveLocale, state.sdk])

  // Gate rendering when async setup must complete first:
  // - onStatesReady: the callback subscribes to SDK state and must run before children mount.
  // - serverOptimizationState: async hydration must finish before children see SDK-resolved data.
  // In all other cases, always render so Next.js SSR produces HTML and client hydration matches.
  if (requiresAsyncSetup(props) && !state.isReady && state.error === undefined) {
    return null
  }

  return <OptimizationContext.Provider value={state}>{props.children}</OptimizationContext.Provider>
}
