import { useEffect, useLayoutEffect, useRef } from 'react'
import { useOptimizationRouteTransition } from '../context/OptimizationRouteTransitionContext'
import { useConsentState } from '../hooks/useConsentState'
import { useOptimization, useOptimizationContext } from '../hooks/useOptimization'
import type { AutoPagePayload } from './types'

export interface AutoPageEmissionMetadata {
  readonly isInitialEmission: boolean
}

export type InitialAutoPageEvent = 'emit' | 'skip'

export interface UseAutoPageEmitterArgs {
  /**
   * When `false` the emitter is inert. Adapters that depend on a router being
   * ready (e.g. Next.js Pages router) should gate on their readiness signal
   * here.
   */
  readonly enabled: boolean
  /**
   * Stable string identity for the current route. Consecutive emissions with
   * the same `routeKey` are deduplicated, which also suppresses StrictMode's
   * double-effect invocations.
   */
  readonly routeKey: string
  /**
   * Controls the first eligible route emission. SSR integrations can use
   * `skip` when the server already emitted the mounted route's page event.
   * Later client-side route changes still emit when a payload builder is
   * available.
   */
  readonly initialPageEvent?: InitialAutoPageEvent
  /**
   * Builds the page event payload to emit. Required for emitted routes and not
   * called for skip-only initial route marking.
   */
  readonly buildPayload?: (metadata: AutoPageEmissionMetadata) => AutoPagePayload
}

/**
 * Emit a page event when the route changes.
 *
 * The hook is intentionally narrow: it triggers emission through the active Web SDK singleton,
 * which owns current-page deduplication. Each router adapter is responsible for building the
 * finished payload and passing it through `buildPayload`. It does not subscribe to connectivity;
 * consumers retry current-page tracking explicitly after reconnecting.
 *
 * @internal
 */
export function useAutoPageEmitter({
  enabled,
  initialPageEvent = 'emit',
  routeKey,
  buildPayload,
}: UseAutoPageEmitterArgs): void {
  const sdk = useOptimization()
  const {
    states: { currentStateTracking, experienceRequestState },
  } = sdk
  const { isLive } = useOptimizationContext()
  const routeTransition = useOptimizationRouteTransition()
  const isHandoffPending = routeTransition?.isHandoffPending ?? false
  const settleRoute = routeTransition?.settleRoute
  const startRoute = routeTransition?.startRoute
  const consent = useConsentState()
  const skippedInitialRouteKey = useRef<string | null | undefined>(undefined)
  const routeOccurrence = useRef({ hasResponse: false, routeKey, startRoute })
  const canEmit = enabled && !isHandoffPending && isLive !== false

  useLayoutEffect(() => {
    const { current } = routeOccurrence
    if (current.routeKey !== routeKey || current.startRoute !== startRoute) {
      routeOccurrence.current = { hasResponse: false, routeKey, startRoute }
    }

    if (enabled) startRoute?.(routeKey)
  }, [enabled, routeKey, startRoute])

  useEffect(() => {
    if (!canEmit) {
      return
    }

    const { current: occurrence } = routeOccurrence

    if (skippedInitialRouteKey.current === undefined) {
      skippedInitialRouteKey.current = initialPageEvent === 'skip' ? routeKey : null
    }

    const currentInitialPageEvent = skippedInitialRouteKey.current === routeKey ? 'skip' : 'emit'

    if (skippedInitialRouteKey.current !== routeKey) {
      skippedInitialRouteKey.current = null
    }

    let active = true
    let currentStateTrackingSubscription:
      | ReturnType<typeof currentStateTracking.subscribe>
      | undefined = undefined
    let experienceRequestSubscription:
      | ReturnType<typeof experienceRequestState.subscribe>
      | undefined = undefined

    function settleAcceptedRoute(hasResponse: boolean): void {
      if (!active || settleRoute === undefined) return
      if (!hasResponse) {
        settleRoute(routeKey, 'satisfied')
        return
      }

      const {
        current: { status },
      } = experienceRequestState
      if (status !== 'pending') {
        settleRoute(routeKey, status === 'success' ? 'satisfied-with-response' : 'failed')
        return
      }

      experienceRequestSubscription = experienceRequestState.subscribe((state) => {
        const { status: terminalStatus } = state
        if (!active || terminalStatus === 'pending') return

        experienceRequestSubscription?.unsubscribe()
        settleRoute(routeKey, terminalStatus === 'success' ? 'satisfied-with-response' : 'failed')
      })
    }

    const request =
      currentInitialPageEvent === 'skip'
        ? sdk.trackCurrentPage({ initialPageEvent: 'skip', routeKey })
        : buildPayload === undefined
          ? undefined
          : sdk.trackCurrentPage({ buildPayload, initialPageEvent: 'emit', routeKey })

    if (request === undefined) return

    if (currentInitialPageEvent === 'emit') {
      void request.then(
        (result) => {
          if (result.accepted && routeOccurrence.current === occurrence) {
            occurrence.hasResponse = true
          }
        },
        () => undefined,
      )
    }

    void request.then(
      (result) => {
        if (!active) return

        if (!result.accepted) {
          if (result.reason === 'already-accepted') {
            settleAcceptedRoute(routeOccurrence.current === occurrence && occurrence.hasResponse)
          } else {
            settleRoute?.(routeKey, result.reason === 'superseded' ? 'superseded' : 'failed')
          }

          if (result.reason === 'not-allowed' && settleRoute !== undefined) {
            const {
              current: { generation: failedGeneration },
            } = currentStateTracking
            currentStateTrackingSubscription = currentStateTracking.subscribe((currentState) => {
              if (
                currentState.status !== 'accepted' ||
                currentState.key !== routeKey ||
                currentState.generation !== failedGeneration
              ) {
                return
              }

              currentStateTrackingSubscription?.unsubscribe()
              settleAcceptedRoute(true)
            })
          }
          return
        }

        settleAcceptedRoute(currentInitialPageEvent === 'emit')
      },
      () => {
        if (active) settleRoute?.(routeKey, 'failed')
      },
    )

    return () => {
      active = false
      currentStateTrackingSubscription?.unsubscribe()
      experienceRequestSubscription?.unsubscribe()
    }
  }, [
    buildPayload,
    canEmit,
    consent,
    currentStateTracking,
    experienceRequestState,
    initialPageEvent,
    routeKey,
    sdk,
    settleRoute,
    startRoute,
  ])
}
