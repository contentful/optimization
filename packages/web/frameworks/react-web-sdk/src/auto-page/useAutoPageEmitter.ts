import { useEffect } from 'react'
import { useOptimization } from '../hooks/useOptimization'
import { composePagePayload } from './pagePayload'
import type {
  AutoPageEmissionContext,
  AutoPagePayload,
  AutoPagePayloadOptions,
  AutoPageRouteState,
} from './types'

let lastEmittedRouteKeyBySdk = new WeakMap<object, string>()

function mergePagePayload<TRouteContext>(
  defaultPayload: AutoPagePayload | undefined,
  options: AutoPagePayloadOptions<TRouteContext>,
  context: AutoPageEmissionContext<TRouteContext>,
): ReturnType<typeof composePagePayload> {
  return composePagePayload(defaultPayload, options.pagePayload, options.getPagePayload?.(context))
}

export interface UseAutoPageEmitterArgs<
  TRouteContext,
> extends AutoPagePayloadOptions<TRouteContext> {
  readonly enabled: boolean
  readonly route: AutoPageRouteState<TRouteContext>
  /**
   * Tracker-supplied baseline payload merged below consumer-provided
   * `pagePayload` and `getPagePayload`. Router adapters use this to forward
   * authoritative URL data sourced from the router's own state, so the
   * downstream Web SDK does not have to read a possibly-stale
   * `window.location` at emission time.
   *
   * @internal
   */
  readonly defaultPayload?: AutoPagePayload
}

export function useAutoPageEmitter<TRouteContext>({
  enabled,
  route,
  defaultPayload,
  pagePayload,
  getPagePayload,
}: UseAutoPageEmitterArgs<TRouteContext>): void {
  const sdk = useOptimization()

  useEffect(() => {
    if (!enabled) {
      return
    }

    const isInitialEmission = !lastEmittedRouteKeyBySdk.has(sdk)
    const previousRouteKey = lastEmittedRouteKeyBySdk.get(sdk)

    if (previousRouteKey === route.routeKey) {
      return
    }

    lastEmittedRouteKeyBySdk.set(sdk, route.routeKey)

    void sdk.page(
      mergePagePayload(
        defaultPayload,
        { pagePayload, getPagePayload },
        {
          ...route,
          isInitialEmission,
        },
      ),
    )
  }, [defaultPayload, enabled, getPagePayload, pagePayload, route, sdk])
}

export function resetAutoPageEmitterState(): void {
  lastEmittedRouteKeyBySdk = new WeakMap<object, string>()
}
