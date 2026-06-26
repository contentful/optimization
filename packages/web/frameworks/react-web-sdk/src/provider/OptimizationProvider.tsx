import ContentfulOptimization from '@contentful/optimization-web'
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

export type OptimizationProviderConfigProps = PropsWithChildren<
  OptimizationProviderBaseConfigProps & {
    /**
     * Controls automatic entry interaction tracking for OptimizedEntry components.
     *
     * @defaultValue `{ views: true, clicks: false, hovers: false }`
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

export type OptimizationProviderSdkProps = PropsWithChildren<{
  /**
   * Called with the injected SDK state surface before provider children mount.
   * Return a cleanup function to unsubscribe app-level state observers on teardown.
   */
  readonly onStatesReady?: OnStatesReady
  readonly sdk: OptimizationSdk
}>

export type OptimizationProviderProps =
  | OptimizationProviderConfigProps
  | OptimizationProviderSdkProps

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function createInjectedSdkBinding(props: OptimizationProviderSdkProps): ProviderSdkBinding {
  const { onStatesReady, sdk } = props

  return createOptimizationRootSdkBinding({ onStatesReady, sdk })
}

function createOwnedSdkBinding(props: OptimizationProviderConfigProps): ProviderSdkBinding {
  const { children: _children, onStatesReady, sdk: _sdk, trackEntryInteraction, ...config } = props

  return createOptimizationRootSdkBinding({
    config,
    createSdk: (sdkConfig) => new ContentfulOptimization(sdkConfig),
    onStatesReady,
    trackEntryInteraction,
  })
}

function disposeSdkBinding(sdkBinding: ProviderSdkBinding | undefined): void {
  disposeOptimizationRootSdkBinding(sdkBinding)
}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement | null {
  const { children } = props
  const initialPropsRef = useRef(props)
  const liveLocale = props.sdk === undefined ? props.locale : undefined
  const [state, setState] = useState<ProviderState>(() => ({
    error: undefined,
    isReady: !props.onStatesReady && props.sdk !== undefined,
    sdk: props.onStatesReady ? undefined : props.sdk,
  }))

  useLayoutEffect(() => {
    const { current: initialProps } = initialPropsRef

    if (initialProps.sdk && !initialProps.onStatesReady) {
      return
    }

    try {
      const sdkBinding =
        initialProps.sdk === undefined
          ? createOwnedSdkBinding(initialProps)
          : createInjectedSdkBinding(initialProps)
      setState({ error: undefined, isReady: true, sdk: sdkBinding.sdk })

      return () => {
        disposeSdkBinding(sdkBinding)
      }
    } catch (error: unknown) {
      setState({ error: toError(error), isReady: false, sdk: undefined })
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
