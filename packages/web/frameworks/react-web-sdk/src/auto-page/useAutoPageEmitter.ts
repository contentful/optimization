import { useEffect } from 'react'
import { useOptimization } from '../hooks/useOptimization'
import { composePagePayload } from './pagePayload'
import type { AutoPageEmissionContext, AutoPagePayloadOptions, AutoPageRouteState } from './types'

let lastEmittedRouteKeyBySdk = new WeakMap<object, string>()

function mergePagePayload<TRouteContext>(
  options: AutoPagePayloadOptions<TRouteContext>,
  context: AutoPageEmissionContext<TRouteContext>,
): ReturnType<typeof composePagePayload> {
  return composePagePayload(options.pagePayload, options.getPagePayload?.(context))
}

export interface UseAutoPageEmitterArgs<
  TRouteContext,
> extends AutoPagePayloadOptions<TRouteContext> {
  readonly enabled: boolean
  readonly route: AutoPageRouteState<TRouteContext>
}

export function useAutoPageEmitter<TRouteContext>({
  enabled,
  route,
  pagePayload,
  getPagePayload,
}: UseAutoPageEmitterArgs<TRouteContext>): void {
  const { sdk } = useOptimization()

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
        { pagePayload, getPagePayload },
        {
          ...route,
          isInitialEmission,
        },
      ),
    )
  }, [enabled, getPagePayload, pagePayload, route, sdk])
}

export function resetAutoPageEmitterState(): void {
  lastEmittedRouteKeyBySdk = new WeakMap<object, string>()
}
