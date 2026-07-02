import ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { hydrateOptimizationData } from '@contentful/optimization-web/bridge-support'
import {
  resolveTrackEntryInteractionOptions,
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

/**
 * Provider-owned callback for app-level subscriptions once SDK state is ready.
 *
 * @public
 */
export type OnStatesReady = SharedOnStatesReady<OptimizationSdk>
export type TrackEntryInteractionOptions = SharedTrackEntryInteractionOptions

export type OptimizationProviderConfigProps = PropsWithChildren<
  OptimizationRootSdkConfig & {
    /**
     * Server-returned Optimization state to apply before provider children mount.
     *
     * @remarks
     * Use this for server-to-browser state handoff. Keep `defaults` for configuration and default
     * state such as consent policy.
     */
    readonly serverOptimizationState?: OptimizationData
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

export type OptimizationProviderSdkProps = PropsWithChildren<{
  /**
   * Server-returned Optimization state to apply before provider children mount.
   *
   * @remarks
   * Use this for server-to-browser state handoff. Keep `defaults` for configuration and default
   * state such as consent policy.
   */
  readonly serverOptimizationState?: OptimizationData
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

function resolveOwnedSdk(props: OptimizationProviderConfigProps): OptimizationSdk {
  const {
    children: _children,
    onStatesReady: _onStatesReady,
    sdk: _sdk,
    serverOptimizationState: _serverOptimizationState,
    trackEntryInteraction,
    locale,
    ...config
  } = props

  return ContentfulOptimization.getOrCreate({
    ...config,
    locale,
    autoTrackEntryInteraction: resolveTrackEntryInteractionOptions(trackEntryInteraction),
  })
}

function hasSetupCallbacks(props: OptimizationProviderProps): boolean {
  return props.serverOptimizationState !== undefined || props.onStatesReady !== undefined
}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement | null {
  // SDK ref is initialized once during render — safe for SSR and StrictMode.
  const sdkRef = useRef<OptimizationSdk | null>(null)
  sdkRef.current ??= props.sdk ?? resolveOwnedSdk(props)

  // Cleanup from onStatesReady; called on unmount when async setup ran.
  const cleanupRef = useRef<(() => void) | null>(null)

  // State only tracks whether async setup is done or failed.
  // sdk is always available synchronously from sdkRef.
  const [error, setError] = useState<Error | undefined>(undefined)
  const [setupDone, setSetupDone] = useState(() => !hasSetupCallbacks(props))

  // Handles async setup: serverOptimizationState hydration and onStatesReady subscription.
  // Runs at most once per mount; cleanup unsubscribes onStatesReady listeners on teardown.
  useLayoutEffect(() => {
    if (!hasSetupCallbacks(props)) return

    let disposed = false
    const { current: sdk } = sdkRef

    if (sdk === null) return

    const runSetup = async (): Promise<void> => {
      try {
        if (props.serverOptimizationState !== undefined) {
          await hydrateOptimizationData(sdk, props.serverOptimizationState)
        }
        if (disposed) return
        const result = props.onStatesReady?.(sdk.states)
        if (typeof result === 'function') cleanupRef.current = result
        setSetupDone(true)
      } catch (err: unknown) {
        if (!disposed) setError(toError(err))
      }
    }

    void runSetup()

    return () => {
      disposed = true
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [])

  const configProps = props.sdk === undefined ? props : undefined

  useLayoutEffect(() => {
    const { current: sdk } = sdkRef
    if (sdk === null || configProps === undefined) return

    sdk.setConfig({
      locale: configProps.locale,
      autoTrackEntryInteraction: resolveTrackEntryInteractionOptions(
        configProps.trackEntryInteraction,
      ),
    })
  }, [configProps?.locale, configProps?.trackEntryInteraction])

  const contextValue = useMemo(() => {
    const sdk = setupDone && error === undefined ? (sdkRef.current ?? undefined) : undefined
    return { sdk, isReady: sdk !== undefined, error }
  }, [setupDone, error])

  // Gate rendering when async setup must complete first:
  // - onStatesReady: the callback subscribes to SDK state and must run before children mount.
  // - serverOptimizationState: async hydration must finish before children see SDK-resolved data.
  // In all other cases, always render so Next.js SSR produces HTML and client hydration matches.
  if (hasSetupCallbacks(props) && !setupDone && error === undefined) {
    return null
  }

  return (
    <OptimizationContext.Provider value={contextValue}>
      {props.children}
    </OptimizationContext.Provider>
  )
}
