import { useEffect } from 'react'
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
  /** @deprecated This legacy input is inert. */
  readonly initialPageEvent?: InitialAutoPageEvent
  /** Builds the page event payload. Omit it to use the legacy empty payload. */
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
  routeKey,
  buildPayload,
}: UseAutoPageEmitterArgs): void {
  const sdk = useOptimization()
  const consent = useConsentState()

  useEffect(() => {
    if (!enabled) {
      return
    }

    let active = true
    void sdk
      .trackCurrentPage({
        buildPayload,
        isCurrent: () => active,
        routeKey,
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [buildPayload, consent, enabled, routeKey, sdk])
}
