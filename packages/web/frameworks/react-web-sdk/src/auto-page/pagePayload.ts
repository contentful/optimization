import { isRecord } from '@contentful/optimization-web/api-schemas'
import type { AutoPageEmissionContext, AutoPagePayload, AutoPagePayloadOptions } from './types'

function mergeRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(override)) {
    const { [key]: previous } = result

    result[key] = isRecord(previous) && isRecord(value) ? mergeRecords(previous, value) : value
  }

  return result
}

/**
 * Compose page payload layers from lowest to highest precedence.
 *
 * Each subsequent layer deep-merges over the previous one; later arguments win
 * on key conflicts. `undefined` layers are skipped.
 *
 * @internal
 */
export function composePagePayload(
  ...layers: ReadonlyArray<AutoPagePayload | undefined>
): AutoPagePayload {
  return layers.reduce<Record<string, unknown>>(
    (accumulator, layer) => (layer ? mergeRecords(accumulator, layer) : accumulator),
    {},
  ) as AutoPagePayload
}

/**
 * Compose the final auto-page-tracker payload from the three sources of truth:
 *
 * 1. The router-derived payload (URL data sourced from the router's React state).
 * 2. The consumer-supplied static `pagePayload` prop.
 * 3. The consumer-supplied dynamic `getPagePayload` callback evaluated against
 *    the current emission context.
 *
 * Later sources deep-merge over earlier ones. Adapters use this helper to
 * build the finished payload they hand to `useAutoPageEmitter`.
 *
 * @internal
 */
export function buildAutoPagePayload<TRouteContext>(
  routerPayload: AutoPagePayload,
  consumerOptions: AutoPagePayloadOptions<TRouteContext>,
  context: AutoPageEmissionContext<TRouteContext>,
): AutoPagePayload {
  return composePagePayload(
    routerPayload,
    consumerOptions.pagePayload,
    consumerOptions.getPagePayload?.(context),
  )
}
