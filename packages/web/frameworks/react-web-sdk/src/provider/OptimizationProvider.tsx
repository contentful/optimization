import ContentfulOptimization, {
  type AutoTrackEntryInteractionOptions,
  type OptimizationWebConfig,
} from '@contentful/optimization-web'
import { useLayoutEffect, useRef, useState, type PropsWithChildren, type ReactElement } from 'react'

import { OptimizationContext, type OptimizationSdk } from '../context/OptimizationContext'

/**
 * Provider-owned callback for app-level subscriptions once SDK state is ready.
 *
 * @public
 */
type Cleanup = () => void
type OnStatesReadyResult = Cleanup | ReturnType<Cleanup>

export type OnStatesReady = (states: OptimizationSdk['states']) => OnStatesReadyResult
export type TrackEntryInteractionOptions = AutoTrackEntryInteractionOptions

type OptimizationProviderBaseConfigProps = Omit<OptimizationWebConfig, 'autoTrackEntryInteraction'>

interface ProviderRuntime {
  readonly cleanup?: Cleanup
  readonly ownsInstance: boolean
  readonly sdk: OptimizationSdk
}

interface ProviderState {
  readonly error: Error | undefined
  readonly isReady: boolean
  readonly sdk: OptimizationSdk | undefined
}

function getCleanup(
  sdk: OptimizationSdk,
  onStatesReady: OnStatesReady | undefined,
): Cleanup | undefined {
  const cleanup = onStatesReady?.(sdk.states)
  return typeof cleanup === 'function' ? cleanup : undefined
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

function resolveTrackEntryInteractionOptions(
  trackEntryInteraction: TrackEntryInteractionOptions | undefined,
): Required<AutoTrackEntryInteractionOptions> {
  return {
    clicks: trackEntryInteraction?.clicks ?? false,
    hovers: trackEntryInteraction?.hovers ?? false,
    views: trackEntryInteraction?.views ?? true,
  }
}

function createInjectedRuntime(props: OptimizationProviderSdkProps): ProviderRuntime {
  const { onStatesReady, sdk } = props

  return {
    cleanup: getCleanup(sdk, onStatesReady),
    ownsInstance: false,
    sdk,
  }
}

function createOwnedRuntime(props: OptimizationProviderConfigProps): ProviderRuntime {
  const { children: _children, onStatesReady, sdk: _sdk, trackEntryInteraction, ...config } = props
  const sdk = new ContentfulOptimization({
    ...config,
    autoTrackEntryInteraction: resolveTrackEntryInteractionOptions(trackEntryInteraction),
  })

  try {
    return {
      cleanup: getCleanup(sdk, onStatesReady),
      ownsInstance: true,
      sdk,
    }
  } catch (error) {
    sdk.destroy()
    throw error
  }
}

function disposeRuntime(runtime: ProviderRuntime | undefined): void {
  runtime?.cleanup?.()
  if (runtime?.ownsInstance === true) {
    runtime.sdk.destroy()
  }
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
      const runtime =
        initialProps.sdk === undefined
          ? createOwnedRuntime(initialProps)
          : createInjectedRuntime(initialProps)
      setState({ error: undefined, isReady: true, sdk: runtime.sdk })

      return () => {
        disposeRuntime(runtime)
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

  const shouldRenderChildren = state.isReady || state.error !== undefined

  if (!shouldRenderChildren) {
    return null
  }

  return <OptimizationContext.Provider value={state}>{children}</OptimizationContext.Provider>
}
