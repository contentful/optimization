import ContentfulOptimization from '@contentful/optimization-web'
import { DEFAULT_WEB_ALLOWED_EVENT_TYPES } from '@contentful/optimization-web/constants'
import { assertOptimizationCacheSafety } from '@contentful/optimization-web/core-sdk'
import {
  hydrateOptimizationHandoff,
  type ContentOptimizationHandoff,
  type ContentOptimizationHydrationMode,
  type OptimizationHandoffHydrationTarget,
} from '@contentful/optimization-web/handoff'
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
  useCallback,
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
import { OptimizationHydrationContext } from '../context/OptimizationHydrationContext'
import {
  hasAuthoritativeLiveRuntime,
  isHydratedHandoff,
  OptimizationRouteTransitionContext,
  type RoutePresentation,
  type RouteSettlement,
} from '../context/OptimizationRouteTransitionContext'
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

interface OptimizationHandoffProps {
  /**
   * Server/static/edge Optimization handoff to apply before provider children mount.
   * Supply a fresh object for each route occurrence; object reuse does not identify a new handoff.
   */
  readonly handoff?: ContentOptimizationHandoff
  /**
   * Overrides the content hydration presentation mode published to optimized entries.
   */
  readonly hydration?: ContentOptimizationHydrationMode
  /**
   * Managed entries to prefetch after the live SDK is ready.
   */
  readonly prefetchManagedEntries?: readonly ManagedEntryDescriptor[]
}

export type OptimizationProviderConfigProps = PropsWithChildren<
  OptimizationProviderBaseConfigProps &
    OptimizationHandoffProps & {
      /**
       * Controls automatic entry interaction tracking for OptimizedEntry components.
       *
       * @defaultValue `{ views: true, clicks: true, hovers: true }`
       */
      readonly trackEntryInteraction?: TrackEntryInteractionOptions
      /**
       * Called once the live SDK state surface is initialized.
       * Return a synchronous cleanup function to unsubscribe app-level state observers on
       * teardown. Cleanup functions must not throw or re-enter provider teardown.
       */
      readonly onStatesReady?: OnStatesReady
      readonly sdk?: never
    }
>

export type OptimizationProviderSdkProps = PropsWithChildren<
  OptimizationHandoffProps & {
    /**
     * Called with the injected SDK state surface before provider children mount unless a server
     * snapshot is provided for the initial render.
     * Return a synchronous cleanup function to unsubscribe app-level state observers on
     * teardown. Cleanup functions must not throw or re-enter provider teardown.
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
    handoff: _handoff,
    hydration: _hydration,
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

function getOnStatesReadyCleanup(
  sdkBinding: ProviderSdkBinding,
  onStatesReady: OnStatesReady | undefined,
): ProviderSdkBinding['cleanup'] {
  const cleanup = onStatesReady?.(sdkBinding.sdk.states)

  return typeof cleanup === 'function' ? cleanup : undefined
}

function isHandoffHydrationTarget(
  runtime: WebOptimizationRuntime,
): runtime is WebOptimizationRuntime & OptimizationHandoffHydrationTarget {
  if (!('interceptors' in runtime)) return false

  const { interceptors } = runtime
  return typeof interceptors === 'object' && interceptors !== null && 'state' in interceptors
}

async function hydrateProviderHandoff(
  runtime: WebOptimizationRuntime,
  handoff: ContentOptimizationHandoff,
  isCurrent: () => boolean,
): Promise<void> {
  if (!isHandoffHydrationTarget(runtime)) {
    throw new TypeError('Optimization handoff hydration requires a live Web SDK.')
  }

  await hydrateOptimizationHandoff(runtime, handoff, { isCurrent })
}

function createProviderSdkBinding(props: OptimizationProviderProps): ProviderSdkBinding {
  return props.sdk === undefined ? createOwnedSdkBinding(props) : createInjectedSdkBinding(props)
}

function canUseInjectedSdkDuringInitialRender(props: OptimizationProviderProps): boolean {
  return props.sdk !== undefined && props.onStatesReady === undefined && props.handoff === undefined
}

function injectedSdkBacksInitialRender(props: OptimizationProviderProps): boolean {
  return props.sdk !== undefined && props.handoff === undefined
}

function createInitialRuntime(props: OptimizationProviderProps): WebOptimizationRuntime {
  if (props.handoff !== undefined) assertOptimizationCacheSafety(props.handoff)

  if (props.sdk !== undefined) {
    return injectedSdkBacksInitialRender(props)
      ? props.sdk
      : createWebSnapshotRuntime({ data: props.handoff?.state })
  }

  return createWebSnapshotRuntime({
    allowedEventTypes: props.allowedEventTypes ?? DEFAULT_WEB_ALLOWED_EVENT_TYPES,
    consent: props.defaults?.consent,
    data: props.handoff?.state,
    locale: props.locale,
    persistenceConsent: props.defaults?.persistenceConsent,
  })
}

function createPrefetchedManagedEntries(
  entries: readonly ManagedEntryHandoff[] | undefined,
): ReadonlyMap<string, ManagedEntryHandoff['baselineEntry']> | undefined {
  if (entries === undefined) return undefined

  const map = new Map<string, ManagedEntryHandoff['baselineEntry']>()
  for (const { baselineEntry, entryId, entryQuery, managedEntry } of entries) {
    map.set(
      getOptimizedEntrySourceKey(entryId, entryQuery ?? managedEntry?.entryQuery),
      baselineEntry,
    )
    if (managedEntry !== undefined) {
      map.set(getOptimizedEntrySourceKey(managedEntry), baselineEntry)
    }
  }

  return map
}

function preservesRoutePresentation(
  handoff: ContentOptimizationHandoff | undefined,
): handoff is ContentOptimizationHandoff {
  return handoff?.cache.scope === 'public-permutation' || handoff?.cache.scope === 'static'
}

function claimRouteHandoff(
  handoff: ContentOptimizationHandoff | undefined,
  claimedHandoffs: WeakSet<ContentOptimizationHandoff>,
): ContentOptimizationHandoff | undefined {
  if (handoff === undefined || claimedHandoffs.has(handoff)) return undefined

  claimedHandoffs.add(handoff)
  return handoff
}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement {
  const { children, handoff: currentHandoff } = props
  const initialPropsRef = useRef(props)
  const liveLocale = props.sdk === undefined ? props.locale : undefined
  const [state, setState] = useState<ProviderState>(() => ({
    error: undefined,
    isLive: injectedSdkBacksInitialRender(props),
    runtime: createInitialRuntime(props),
  }))
  const [settledHandoff, setSettledHandoff] = useState(currentHandoff)
  const [routePresentation, setRoutePresentation] = useState<RoutePresentation | undefined>(() =>
    currentHandoff === undefined
      ? undefined
      : {
          handoff: currentHandoff,
          isLiveRuntimeAuthoritative: true,
          isPending: false,
          routeKey: undefined,
          useSnapshot: preservesRoutePresentation(currentHandoff),
        },
  )
  const hasPendingHandoff = settledHandoff !== currentHandoff
  const activePresentation = hasPendingHandoff
    ? {
        handoff: currentHandoff,
        isLiveRuntimeAuthoritative: false,
        isPending: true,
        routeKey: routePresentation?.routeKey,
        useSnapshot: true,
      }
    : routePresentation
  const presentationHandoff = activePresentation?.handoff
  const usePresentationSnapshot = activePresentation?.useSnapshot === true
  const claimedHandoffsRef = useRef(new WeakSet<ContentOptimizationHandoff>())
  const hydratedHandoffRef = useRef(currentHandoff)
  const startedRouteOccurrenceRef = useRef<object | undefined>(undefined)
  const presentationSdk = useMemo(() => {
    if (!usePresentationSnapshot) return undefined
    if (presentationHandoff !== undefined) assertOptimizationCacheSafety(presentationHandoff)

    return createWebSnapshotRuntime({ data: presentationHandoff?.state })
  }, [presentationHandoff, usePresentationSnapshot])
  const startRoute = useMemo(() => {
    let previousRouteKey: string | undefined = undefined
    let occurrence: object = {}

    return (routeKey: string): void => {
      if (previousRouteKey !== routeKey) {
        previousRouteKey = routeKey
        occurrence = {}
      }

      const currentOccurrence = occurrence
      if (startedRouteOccurrenceRef.current === currentOccurrence) return
      startedRouteOccurrenceRef.current = currentOccurrence

      const handoff = claimRouteHandoff(currentHandoff, claimedHandoffsRef.current)

      setRoutePresentation((current) => ({
        handoff,
        isLiveRuntimeAuthoritative: isHydratedHandoff(handoff, hydratedHandoffRef.current),
        isPending: current?.routeKey === routeKey ? current.isPending : true,
        routeKey,
        useSnapshot: true,
      }))
    }
  }, [currentHandoff])
  const settleRoute = useCallback((routeKey: string, settlement: RouteSettlement): void => {
    setRoutePresentation((current) => {
      if (
        current?.routeKey !== routeKey ||
        settlement === 'superseded' ||
        (settlement === 'failed' && !current.isPending)
      ) {
        return current
      }

      const isLiveRuntimeAuthoritative =
        settlement === 'satisfied-with-response' || current.isLiveRuntimeAuthoritative

      return {
        ...current,
        isLiveRuntimeAuthoritative,
        isPending: false,
        useSnapshot:
          settlement === 'failed' ||
          !isLiveRuntimeAuthoritative ||
          preservesRoutePresentation(current.handoff),
      }
    })
  }, [])
  const prefetchedManagedEntries = useMemo(
    () => createPrefetchedManagedEntries(props.handoff?.entries),
    [props.handoff?.entries],
  )

  useLayoutEffect(() => {
    if (currentHandoff === undefined) {
      setRoutePresentation((current) =>
        current?.handoff === undefined
          ? current
          : {
              ...current,
              handoff: undefined,
              isLiveRuntimeAuthoritative: false,
              isPending: false,
              useSnapshot: true,
            },
      )
      setSettledHandoff(undefined)
    }
  }, [currentHandoff])

  useLayoutEffect(() => {
    const { current: initialProps } = initialPropsRef

    if (canUseInjectedSdkDuringInitialRender(initialProps)) {
      return
    }

    let cancelled = false
    let sdkBinding: ProviderSdkBinding | undefined = undefined
    let onStatesReadyCleanup: ProviderSdkBinding['cleanup'] = undefined

    function isCurrentSetup(): boolean {
      return !cancelled
    }

    function disposeOnce(): void {
      const cleanup = onStatesReadyCleanup
      onStatesReadyCleanup = undefined
      cleanup?.()

      const binding = sdkBinding
      sdkBinding = undefined
      disposeSdkBinding(binding)
    }

    function setInitializedState(): void {
      if (!isCurrentSetup() || sdkBinding === undefined) return

      try {
        onStatesReadyCleanup = getOnStatesReadyCleanup(sdkBinding, initialProps.onStatesReady)
        if (!isCurrentSetup()) {
          disposeOnce()
          return
        }

        setState({ error: undefined, isLive: true, runtime: sdkBinding.sdk })
      } catch (error: unknown) {
        setInitializationError(error)
      }
    }

    function setInitializationError(error: unknown): void {
      disposeOnce()
      if (cancelled) return

      setState({ error: toError(error), isLive: false, runtime: undefined })
    }

    try {
      sdkBinding = createProviderSdkBinding(initialProps)
      if (initialProps.handoff === undefined) {
        setInitializedState()
      } else {
        void hydrateProviderHandoff(sdkBinding.sdk, initialProps.handoff, isCurrentSetup).then(
          setInitializedState,
          setInitializationError,
        )
      }
    } catch (error: unknown) {
      setInitializationError(error)
    }

    return () => {
      cancelled = true
      disposeOnce()
    }
  }, [])

  useLayoutEffect(() => {
    const { handoff } = props
    const { runtime } = state

    if (!state.isLive || runtime === undefined || handoff === undefined || !hasPendingHandoff) {
      return
    }

    const nextHandoff = handoff
    let disposed = false

    function finishHandoff(outcome: 'failed' | 'hydrated', error?: unknown): void {
      if (disposed) return

      if (outcome === 'failed') {
        setState({ error: toError(error), isLive: true, runtime })
      }

      setSettledHandoff(nextHandoff)
      if (outcome === 'hydrated') hydratedHandoffRef.current = nextHandoff
      setRoutePresentation((current) => {
        const useSnapshot = outcome === 'failed' || preservesRoutePresentation(nextHandoff)
        if (current === undefined && !useSnapshot) return current

        return {
          handoff: nextHandoff,
          isLiveRuntimeAuthoritative: outcome === 'hydrated',
          isPending: current?.isPending ?? false,
          routeKey: current?.routeKey,
          useSnapshot,
        }
      })
    }

    void hydrateProviderHandoff(runtime, nextHandoff, () => !disposed).then(
      () => {
        finishHandoff('hydrated')
      },
      (error: unknown) => {
        finishHandoff('failed', error)
      },
    )

    return () => {
      disposed = true
    }
  }, [hasPendingHandoff, props.handoff, state.isLive, state.runtime])

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
    [prefetchedManagedEntries, state.error, state.isLive, state.runtime],
  )
  const isLiveRuntimeAuthoritative = hasAuthoritativeLiveRuntime(state.isLive, activePresentation)
  const routeTransitionContextValue = useMemo(
    () => ({
      isHandoffPending: hasPendingHandoff,
      isLiveRuntimeAuthoritative,
      isPresentationLive: state.isLive && activePresentation?.isPending !== true,
      presentationSdk,
      settleRoute,
      startRoute,
    }),
    [
      activePresentation?.isPending,
      hasPendingHandoff,
      isLiveRuntimeAuthoritative,
      presentationSdk,
      settleRoute,
      startRoute,
      state.isLive,
    ],
  )

  return (
    <OptimizationContext.Provider value={contextValue}>
      <OptimizationRouteTransitionContext.Provider value={routeTransitionContextValue}>
        <OptimizationHydrationContext.Provider value={props.hydration ?? props.handoff?.hydration}>
          {children}
        </OptimizationHydrationContext.Provider>
      </OptimizationRouteTransitionContext.Provider>
    </OptimizationContext.Provider>
  )
}
