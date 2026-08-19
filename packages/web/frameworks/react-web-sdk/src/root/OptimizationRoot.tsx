import type {
  TrackCurrentPageOptions,
  TrackCurrentPageSkipOptions,
} from '@contentful/optimization-web'
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
import { InitialExperienceContext } from '../context/InitialExperienceContext'
import { useOptimizationContext } from '../hooks/useOptimization'
import {
  resolveInitialExperienceMaxWaitMs,
  runInitialExperience,
  type InitialExperienceOptions,
} from '../initial-experience/initialExperience'
import { createScopedLogger } from '../logger'
import { LiveUpdatesProvider } from '../provider/LiveUpdatesProvider'
import {
  OptimizationProvider,
  type OptimizationProviderConfigProps,
} from '../provider/OptimizationProvider'

interface OptimizationRootCommonProps {
  readonly liveUpdates?: boolean
}

interface OptimizationRootWithoutInitialExperienceProps {
  readonly initialExperience?: never
  readonly routeKey?: string
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly initialPagePayload?: AutoPagePayload
}

interface OptimizationRootWithInitialExperienceProps {
  readonly initialExperience: InitialExperienceOptions
  readonly routeKey: string
  readonly buildPagePayload: TrackCurrentPageOptions['buildPayload']
  readonly initialPagePayload?: never
}

export type OptimizationRootProps = OptimizationProviderConfigProps &
  OptimizationRootCommonProps &
  (OptimizationRootWithoutInitialExperienceProps | OptimizationRootWithInitialExperienceProps)

type DefaultOptimizationRootProps = OptimizationProviderConfigProps &
  OptimizationRootCommonProps &
  OptimizationRootWithoutInitialExperienceProps

type InitialExperienceOptimizationRootProps = OptimizationProviderConfigProps &
  OptimizationRootCommonProps &
  OptimizationRootWithInitialExperienceProps & {
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
    enabled: true,
    initialPageEvent: handoff.initialPageEvent,
    routeKey,
  })

  return null
}

type InitialHandoffPageEmitterProps = Parameters<typeof InitialHandoffPageEmitter>[0]

function MissingInitialPagePayloadWarning(): null {
  useEffect(() => {
    logger.warn(
      'OptimizationRoot handoff requested initial page emission without routeKey and buildPagePayload; skipping initial page event.',
    )
  }, [])

  return null
}

function resolveInitialPageEmitterProps({
  buildPagePayload,
  handoff,
  initialPagePayload,
  initialRouteKey,
  routeKey,
}: {
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly handoff?: ContentOptimizationHandoff
  readonly initialPagePayload?: AutoPagePayload
  readonly initialRouteKey?: string
  readonly routeKey?: string
}): InitialHandoffPageEmitterProps | undefined {
  if (handoff === undefined) return undefined

  const resolvedBuildPagePayload =
    buildPagePayload ?? (initialPagePayload === undefined ? undefined : () => initialPagePayload)

  if (routeKey !== undefined && resolvedBuildPagePayload !== undefined) {
    return { buildPagePayload: resolvedBuildPagePayload, handoff, routeKey }
  }

  if (
    handoff.initialPageEvent === 'skip' &&
    initialRouteKey !== undefined &&
    resolvedBuildPagePayload === undefined
  ) {
    return { handoff, routeKey: initialRouteKey }
  }

  return undefined
}

function shouldWarnMissingInitialPagePayload({
  buildPagePayload,
  handoff,
  initialPagePayload,
  routeKey,
}: {
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly handoff?: ContentOptimizationHandoff
  readonly initialPagePayload?: AutoPagePayload
  readonly routeKey?: string
}): boolean {
  return (
    handoff?.initialPageEvent === 'emit' &&
    (routeKey === undefined || (buildPagePayload === undefined && initialPagePayload === undefined))
  )
}

function DefaultOptimizationRoot({
  buildPagePayload,
  children,
  handoff,
  initialPagePayload,
  liveUpdates = false,
  routeKey,
  ...providerProps
}: DefaultOptimizationRootProps): ReactElement {
  const initialRouteKey = useRef<string | undefined>(undefined)
  initialRouteKey.current ??= routeKey
  const initialPageEmitterProps = resolveInitialPageEmitterProps({
    buildPagePayload,
    handoff,
    initialPagePayload,
    initialRouteKey: initialRouteKey.current,
    routeKey,
  })
  const shouldWarnMissingPayload = shouldWarnMissingInitialPagePayload({
    buildPagePayload,
    handoff,
    initialPagePayload,
    routeKey,
  })

  return (
    <OptimizationProvider {...providerProps} handoff={handoff}>
      {shouldWarnMissingPayload ? <MissingInitialPagePayloadWarning /> : null}
      {initialPageEmitterProps ? <InitialHandoffPageEmitter {...initialPageEmitterProps} /> : null}
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{children}</LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

interface InitialExperienceSequenceState {
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

function InitialExperienceSequence({
  buildPagePayload,
  children,
  handoff,
  initialExperience,
  initialRouteKey,
  maxWaitMs,
  routeKey,
}: PropsWithChildren<{
  readonly buildPagePayload: TrackCurrentPageOptions['buildPayload']
  readonly handoff?: ContentOptimizationHandoff
  readonly initialExperience: InitialExperienceOptions
  readonly initialRouteKey: string
  readonly maxWaitMs: number
  readonly routeKey: string
}>): ReactElement {
  const { error, isLive, sdk } = useOptimizationContext()
  const [sequenceState, setSequenceState] = useState<InitialExperienceSequenceState>({
    emitterRouteKey: initialRouteKey,
    isReady: false,
  })
  const buildPagePayloadRef = useRef(buildPagePayload)
  const currentRuntimeRef = useRef(sdk)
  const currentRuntimeIsLiveRef = useRef(isLive === true)
  const initialHandoffRef = useRef(handoff)
  const initialExperienceRef = useRef(initialExperience)
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
      await runInitialExperience(
        sequenceRuntime,
        initialExperienceRef.current,
        initialMaxWaitMsRef.current,
      )

      if (!isCurrentRuntime()) return

      const { current: attemptedRouteKey } = routeKeyRef
      const { current: initialHandoff } = initialHandoffRef
      const canSkipDirectPage =
        initialHandoff !== undefined &&
        error === undefined &&
        initialHandoff.initialPageEvent === 'skip' &&
        attemptedRouteKey === initialRouteKey
      const pageOptions: TrackCurrentPageOptions | TrackCurrentPageSkipOptions = canSkipDirectPage
        ? { initialPageEvent: 'skip', routeKey: attemptedRouteKey }
        : {
            buildPayload: buildPagePayloadRef.current,
            initialPageEvent: 'emit',
            routeKey: attemptedRouteKey,
          }

      try {
        await sequenceRuntime.trackCurrentPage(pageOptions)
      } catch (pageError: unknown) {
        logInitialPageError(pageError)
      }

      if (!isCurrentRuntime()) return

      const { current: currentRouteKey } = routeKeyRef
      lastObservedRouteKeyRef.current = currentRouteKey
      setSequenceState({ emitterRouteKey: attemptedRouteKey, isReady: true })
    })()
  }, [error, initialRouteKey, isLive, sdk])

  useAutoPageEmitter({
    buildPayload: buildLatestPagePayload,
    enabled: sequenceState.isReady,
    initialPageEvent: 'skip',
    routeKey: sequenceState.emitterRouteKey,
  })

  useEffect(() => {
    if (!sequenceState.isReady || lastObservedRouteKeyRef.current === routeKey) return

    lastObservedRouteKeyRef.current = routeKey
    setSequenceState({ emitterRouteKey: routeKey, isReady: true })
  }, [routeKey, sequenceState.isReady])

  return (
    <InitialExperienceContext.Provider value={sequenceState.isReady}>
      {children}
    </InitialExperienceContext.Provider>
  )
}

function InitialExperienceOptimizationRoot({
  buildPagePayload,
  children,
  handoff,
  initialExperience,
  liveUpdates = false,
  maxWaitMs,
  routeKey,
  ...providerProps
}: InitialExperienceOptimizationRootProps): ReactElement {
  const initialRouteKey = useRef(routeKey)

  return (
    <OptimizationProvider {...providerProps} handoff={handoff}>
      <InitialExperienceSequence
        buildPagePayload={buildPagePayload}
        handoff={handoff}
        initialExperience={initialExperience}
        initialRouteKey={initialRouteKey.current}
        maxWaitMs={maxWaitMs}
        routeKey={routeKey}
      >
        <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{children}</LiveUpdatesProvider>
      </InitialExperienceSequence>
    </OptimizationProvider>
  )
}

export function OptimizationRoot(props: OptimizationRootProps): ReactElement {
  if (props.initialExperience === undefined) {
    return <DefaultOptimizationRoot {...props} />
  }

  const maxWaitMs = resolveInitialExperienceMaxWaitMs(props.initialExperience.maxWaitMs)

  return <InitialExperienceOptimizationRoot {...props} maxWaitMs={maxWaitMs} />
}
