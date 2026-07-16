import { useEffect, useRef } from 'react'
import { useOptimization } from '../hooks/useOptimization'
import { useConsentState } from '../hooks/useOptimizationState'
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
 * The hook is intentionally narrow: it owns dedup and emission only. Each
 * router adapter is responsible for building the finished payload and passing
 * it through `buildPayload`.
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
  const consent = useConsentState()
  const skippedInitialRouteKey = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (skippedInitialRouteKey.current === undefined) {
      skippedInitialRouteKey.current = initialPageEvent === 'skip' ? routeKey : null
    }

    const currentInitialPageEvent = skippedInitialRouteKey.current === routeKey ? 'skip' : 'emit'

    if (skippedInitialRouteKey.current !== routeKey) {
      skippedInitialRouteKey.current = null
    }

    if (currentInitialPageEvent === 'skip') {
      void sdk.trackCurrentPage({ initialPageEvent: 'skip', routeKey }).catch(() => undefined)
      return
    }

    if (buildPayload === undefined) return

    void sdk
      .trackCurrentPage({
        buildPayload,
        initialPageEvent: 'emit',
        routeKey,
      })
      .catch(() => undefined)
  }, [buildPayload, consent, enabled, initialPageEvent, routeKey, sdk])
}

export function resetAutoPageEmitterState(): void {
  // Current-page state is owned by each Web SDK instance.
}
