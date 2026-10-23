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

interface InitialPageSequence {
  readonly beforeInitialPage: BeforeInitialPageOptions
  readonly maxWaitMs: number
}

const logger = createScopedLogger('React:OptimizationRoot')

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

function OptimizationPageSequence({
  buildPagePayload,
  children,
  enabled,
  handoff,
  initialSequence,
  routeKey,
}: PropsWithChildren<{
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly enabled: boolean
  readonly handoff?: ContentOptimizationHandoff
  readonly initialSequence?: InitialPageSequence
  readonly routeKey: string
}>): ReactElement {
  const { isLive, sdk } = useOptimizationContext()
  const [sequenceState, setSequenceState] = useState<BeforeInitialPageSequenceState>({
    emitterRouteKey: routeKey,
    isReady: initialSequence === undefined,
  })
  const buildPagePayloadRef = useRef(buildPagePayload)
  const currentRuntimeRef = useRef(sdk)
  const currentRuntimeIsLiveRef = useRef(isLive === true)
  const initialAttemptedRouteKeyRef = useRef<string | undefined>(undefined)
  const lastObservedRouteKeyRef = useRef(routeKey)
  const mountedRef = useRef(false)
  const routeKeyRef = useRef(routeKey)
  const sequenceStartedRef = useRef(false)
  const callbackSupersededRef = useRef(false)
  const supersedeCallbackRef = useRef<(() => void) | undefined>(undefined)
  buildPagePayloadRef.current = buildPagePayload
  currentRuntimeRef.current = sdk
  currentRuntimeIsLiveRef.current = isLive === true
  routeKeyRef.current = routeKey

  const buildLatestPagePayload = useCallback<TrackCurrentPageOptions['buildPayload']>(
    (metadata) => buildPagePayloadRef.current?.(metadata) ?? {},
    [],
  )

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (initialSequence === undefined || sequenceStartedRef.current || !isLive || sdk === undefined)
      return

    sequenceStartedRef.current = true
    const sequenceRuntime = sdk
    const { promise: callbackSuperseded, resolve } = Promise.withResolvers<undefined>()
    supersedeCallbackRef.current = () => {
      callbackSupersededRef.current = true
      resolve(undefined)
    }
    const isCurrentRuntime = (): boolean =>
      mountedRef.current &&
      !callbackSupersededRef.current &&
      currentRuntimeIsLiveRef.current &&
      currentRuntimeRef.current === sequenceRuntime

    void (async () => {
      await runBeforeInitialPage(
        sequenceRuntime,
        {
          ...initialSequence.beforeInitialPage,
          run: async (client) =>
            await Promise.race([initialSequence.beforeInitialPage.run(client), callbackSuperseded]),
        },
        initialSequence.maxWaitMs,
      )

      if (!isCurrentRuntime()) return

      const { current: attemptedRouteKey } = routeKeyRef
      initialAttemptedRouteKeyRef.current = attemptedRouteKey
      try {
        await sequenceRuntime.trackCurrentPage({
          buildPayload: buildPagePayloadRef.current ?? buildLatestPagePayload,
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
  }, [buildLatestPagePayload, initialSequence, isLive, sdk])

  useEffect(() => {
    if (
      handoff?.replay?.routeKey !== routeKey ||
      sequenceState.isReady ||
      initialAttemptedRouteKeyRef.current !== undefined
    )
      return

    supersedeCallbackRef.current?.()
    lastObservedRouteKeyRef.current = routeKey
    setSequenceState({ emitterRouteKey: routeKey, isReady: true })
  }, [handoff, routeKey, sequenceState.isReady])

  useAutoPageEmitter({
    buildPayload: initialSequence === undefined ? buildPagePayload : buildLatestPagePayload,
    enabled:
      enabled &&
      sequenceState.isReady &&
      (initialSequence === undefined ||
        (sequenceState.emitterRouteKey === routeKey &&
          sequenceState.emitterRouteKey !== initialAttemptedRouteKeyRef.current)),
    handoff,
    routeKey: initialSequence === undefined ? routeKey : sequenceState.emitterRouteKey,
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

function shouldEmitRootPage(
  routeKey: string | undefined,
  buildPayload: TrackCurrentPageOptions['buildPayload'] | undefined,
  beforeInitialPage: BeforeInitialPageOptions | undefined,
  handoff: ContentOptimizationHandoff | undefined,
): boolean {
  return (
    routeKey !== undefined &&
    (beforeInitialPage !== undefined || handoff !== undefined) &&
    (handoff?.replay?.routeKey === routeKey || buildPayload !== undefined)
  )
}

export function OptimizationRoot({
  buildPagePayload,
  children,
  handoff,
  beforeInitialPage,
  initialPagePayload,
  liveUpdates = false,
  routeKey,
  ...providerProps
}: OptimizationRootProps): ReactElement {
  const [initialSequence] = useState<InitialPageSequence | undefined>(() =>
    beforeInitialPage === undefined || handoff?.replay !== undefined
      ? undefined
      : {
          beforeInitialPage,
          maxWaitMs: resolveBeforeInitialPageMaxWaitMs(beforeInitialPage.maxWaitMs),
        },
  )
  const currentRouteKey =
    routeKey ??
    (typeof window === 'undefined'
      ? undefined
      : `${window.location.pathname}${window.location.search}`)
  const buildPayload =
    buildPagePayload ?? (initialPagePayload === undefined ? undefined : () => initialPagePayload)

  return (
    <OptimizationProvider {...providerProps} handoff={handoff} routeKey={currentRouteKey}>
      <OptimizationPageSequence
        buildPagePayload={buildPayload}
        enabled={shouldEmitRootPage(currentRouteKey, buildPayload, beforeInitialPage, handoff)}
        handoff={handoff}
        initialSequence={initialSequence}
        routeKey={currentRouteKey ?? '/'}
      >
        <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{children}</LiveUpdatesProvider>
      </OptimizationPageSequence>
    </OptimizationProvider>
  )
}
