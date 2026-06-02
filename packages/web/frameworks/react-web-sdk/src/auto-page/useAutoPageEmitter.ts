import { useEffect } from 'react'
import { useOptimization } from '../hooks/useOptimization'
import type { AutoPagePayload } from './types'

let lastEmittedRouteKeyBySdk = new WeakMap<object, string>()

export interface AutoPageEmissionMetadata {
  readonly isInitialEmission: boolean
}

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
   * Builds the page event payload to emit. Called only when an emission would
   * actually happen (after the dedup check), so it never runs more than once
   * per route change. Receives `isInitialEmission` to pass through to
   * consumer callbacks if the adapter exposes one.
   */
  readonly buildPayload: (metadata: AutoPageEmissionMetadata) => AutoPagePayload
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

  useEffect(() => {
    if (!enabled) {
      return
    }

    const previousRouteKey = lastEmittedRouteKeyBySdk.get(sdk)

    if (previousRouteKey === routeKey) {
      return
    }

    const isInitialEmission = !lastEmittedRouteKeyBySdk.has(sdk)
    lastEmittedRouteKeyBySdk.set(sdk, routeKey)

    void sdk.page(buildPayload({ isInitialEmission }))
  }, [buildPayload, enabled, routeKey, sdk])
}

export function resetAutoPageEmitterState(): void {
  lastEmittedRouteKeyBySdk = new WeakMap<object, string>()
}
