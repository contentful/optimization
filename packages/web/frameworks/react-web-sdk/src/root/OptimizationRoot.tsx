import type { TrackCurrentPageOptions } from '@contentful/optimization-web'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from 'react'

import type { AutoPagePayload } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'
import {
  resolveBeforeInitialPageMaxWaitMs,
  runBeforeInitialPage,
  type BeforeInitialPageOptions,
} from '../before-initial-page/beforeInitialPage'
import { BeforeInitialPageContext } from '../context/BeforeInitialPageContext'
import { useOptimizationContext } from '../hooks/useOptimization'
import { createScopedLogger } from '../logger'
import { LiveUpdatesProvider } from '../provider/LiveUpdatesProvider'
import {
  OptimizationProvider,
  type OptimizationProviderConfigProps,
} from '../provider/OptimizationProvider'

interface OptimizationRootCommonProps {
  readonly liveUpdates?: boolean
}

interface OptimizationRootWithoutBeforeInitialPageProps {
  readonly beforeInitialPage?: never
  readonly routeKey?: string
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly initialPagePayload?: AutoPagePayload
}

interface OptimizationRootWithBeforeInitialPageProps {
  readonly beforeInitialPage: BeforeInitialPageOptions
  readonly routeKey: string
  readonly buildPagePayload: TrackCurrentPageOptions['buildPayload']
  readonly initialPagePayload?: never
}

export type OptimizationRootProps = OptimizationProviderConfigProps &
  OptimizationRootCommonProps &
  (OptimizationRootWithoutBeforeInitialPageProps | OptimizationRootWithBeforeInitialPageProps)

type BeforeInitialPageOptimizationRootProps = OptimizationProviderConfigProps &
  OptimizationRootCommonProps &
  OptimizationRootWithBeforeInitialPageProps & {
    readonly maxWaitMs: number
  }

const logger = createScopedLogger('React:OptimizationRoot')

function InitialHandoffPageEmitter({
  buildPagePayload,
  handoff,
  routeKey,
}: {
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly handoff: ContentOptimizationHandoff
  readonly routeKey: string
}): null {
  useAutoPageEmitter({
    buildPayload: buildPagePayload,
    enabled: handoff.replay?.routeKey === routeKey || buildPagePayload !== undefined,
    handoff,
    routeKey,
  })
  return null
}

function DefaultOptimizationRoot({
  beforeInitialPage: _beforeInitialPage,
  buildPagePayload,
  children,
  handoff,
  initialPagePayload,
  liveUpdates = false,
  routeKey,
  ...providerProps
}: OptimizationRootProps): ReactElement {
  const currentRouteKey =
    routeKey ??
    (typeof window === 'undefined'
      ? undefined
      : `${window.location.pathname}${window.location.search}`)
  const buildPayload =
    buildPagePayload ?? (initialPagePayload === undefined ? undefined : () => initialPagePayload)
  return (
    <OptimizationProvider {...providerProps} handoff={handoff} routeKey={currentRouteKey}>
      {handoff !== undefined && currentRouteKey !== undefined ? (
        <InitialHandoffPageEmitter
          handoff={handoff}
          routeKey={currentRouteKey}
          buildPagePayload={buildPayload}
        />
      ) : null}
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{children}</LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

interface BeforeInitialPageSequenceState {
  readonly emitterRouteKey: string
  readonly isReady: boolean
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function logInitialPageError(error: unknown): void {
  try {
    logger.error('OptimizationRoot failed to track the initial browser page.', toError(error))
  } catch {
    // Logging is best-effort and must not block readiness.
  }
}

function BeforeInitialPageSequence({
  buildPagePayload,
  children,
  beforeInitialPage,
  initialRouteKey,
  maxWaitMs,
  routeKey,
}: PropsWithChildren<{
  readonly buildPagePayload: TrackCurrentPageOptions['buildPayload']
  readonly beforeInitialPage: BeforeInitialPageOptions
  readonly initialRouteKey: string
  readonly maxWaitMs: number
  readonly routeKey: string
}>): ReactElement {
  const { isLive, sdk } = useOptimizationContext()
  const [sequenceState, setSequenceState] = useState<BeforeInitialPageSequenceState>({
    emitterRouteKey: initialRouteKey,
    isReady: false,
  })
  const buildPagePayloadRef = useRef(buildPagePayload)
  const currentRuntimeRef = useRef(sdk)
  const currentRuntimeIsLiveRef = useRef(isLive === true)
  const initialAttemptedRouteKeyRef = useRef<string | undefined>(undefined)
  const beforeInitialPageRef = useRef(beforeInitialPage)
  const initialMaxWaitMsRef = useRef(maxWaitMs)
  const lastObservedRouteKeyRef = useRef(routeKey)
  const mountedRef = useRef(false)
  const routeKeyRef = useRef(routeKey)
  const sequenceStartedRef = useRef(false)
  buildPagePayloadRef.current = buildPagePayload
  currentRuntimeRef.current = sdk
  currentRuntimeIsLiveRef.current = isLive === true
  routeKeyRef.current = routeKey

  const buildLatestPagePayload = useCallback<TrackCurrentPageOptions['buildPayload']>(
    (metadata) => buildPagePayloadRef.current(metadata),
    [],
  )

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (sequenceStartedRef.current || !isLive || sdk === undefined) return

    sequenceStartedRef.current = true
    const sequenceRuntime = sdk
    const isCurrentRuntime = (): boolean =>
      mountedRef.current &&
      currentRuntimeIsLiveRef.current &&
      currentRuntimeRef.current === sequenceRuntime

    void (async () => {
      await runBeforeInitialPage(
        sequenceRuntime,
        beforeInitialPageRef.current,
        initialMaxWaitMsRef.current,
      )

      if (!isCurrentRuntime()) return

      const { current: attemptedRouteKey } = routeKeyRef
      initialAttemptedRouteKeyRef.current = attemptedRouteKey
      try {
        await sequenceRuntime.trackCurrentPage({
          buildPayload: buildPagePayloadRef.current,
          routeKey: attemptedRouteKey,
        })
      } catch (pageError: unknown) {
        logInitialPageError(pageError)
      }

      if (!isCurrentRuntime()) return

      const { current: currentRouteKey } = routeKeyRef
      lastObservedRouteKeyRef.current = currentRouteKey
      setSequenceState({ emitterRouteKey: attemptedRouteKey, isReady: true })
    })()
  }, [isLive, sdk])

  useAutoPageEmitter({
    buildPayload: buildLatestPagePayload,
    enabled:
      sequenceState.isReady &&
      sequenceState.emitterRouteKey !== initialAttemptedRouteKeyRef.current,
    routeKey: sequenceState.emitterRouteKey,
  })

  useEffect(() => {
    if (!sequenceState.isReady || lastObservedRouteKeyRef.current === routeKey) return

    lastObservedRouteKeyRef.current = routeKey
    initialAttemptedRouteKeyRef.current = undefined
    setSequenceState({ emitterRouteKey: routeKey, isReady: true })
  }, [routeKey, sequenceState.isReady])

  return (
    <BeforeInitialPageContext.Provider value={sequenceState.isReady}>
      {children}
    </BeforeInitialPageContext.Provider>
  )
}

function BeforeInitialPageOptimizationRoot({
  buildPagePayload,
  children,
  handoff,
  beforeInitialPage,
  liveUpdates = false,
  maxWaitMs,
  routeKey,
  ...providerProps
}: BeforeInitialPageOptimizationRootProps): ReactElement {
  const initialRouteKey = useRef(routeKey)

  return (
    <OptimizationProvider {...providerProps} handoff={handoff} routeKey={routeKey}>
      <BeforeInitialPageSequence
        buildPagePayload={buildPagePayload}
        beforeInitialPage={beforeInitialPage}
        initialRouteKey={initialRouteKey.current}
        maxWaitMs={maxWaitMs}
        routeKey={routeKey}
      >
        <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{children}</LiveUpdatesProvider>
      </BeforeInitialPageSequence>
    </OptimizationProvider>
  )
}

export function OptimizationRoot(props: OptimizationRootProps): ReactElement {
  if (props.beforeInitialPage === undefined || props.handoff?.replay !== undefined) {
    return <DefaultOptimizationRoot {...props} />
  }

  const maxWaitMs = resolveBeforeInitialPageMaxWaitMs(props.beforeInitialPage.maxWaitMs)

  return <BeforeInitialPageOptimizationRoot {...props} maxWaitMs={maxWaitMs} />
}
