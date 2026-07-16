import {
  assertOptimizationCacheSafety,
  type ManagedEntryHandoff,
  type OptimizationCacheMetadata,
  type OptimizationData,
  type OptimizationHandoff,
  type PrivateRequestOptimizationCacheMetadata,
} from '@contentful/optimization-core'

function assertRequestHandoffCacheMetadata(
  cache: OptimizationCacheMetadata,
): asserts cache is PrivateRequestOptimizationCacheMetadata {
  if (cache.scope === 'private-request') return

  throw new TypeError(
    'Request handoffs must use private-request cache scope. Use public permutation handoffs for public cache scopes, or a non-request handoff for static output.',
  )
}

/**
 * Create a framework-neutral handoff from completed Node request optimization data.
 *
 * @remarks
 * This helper serializes data that a caller already received from a request-bound Experience call.
 * It does not emit page or analytics events.
 *
 * @public
 */
export function createRequestHandoffFromData(input: {
  readonly data?: OptimizationData
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly cache?: PrivateRequestOptimizationCacheMetadata
}): OptimizationHandoff {
  const cache: PrivateRequestOptimizationCacheMetadata = input.cache ?? { scope: 'private-request' }
  assertRequestHandoffCacheMetadata(cache)

  const handoff: OptimizationHandoff = {
    cache,
    ...(input.entries === undefined ? {} : { entries: input.entries }),
    ...(input.data === undefined
      ? {}
      : {
          state: {
            selectedOptimizations: input.data.selectedOptimizations,
            changes: input.data.changes,
            profile: input.data.profile,
          },
        }),
  }

  assertOptimizationCacheSafety(handoff)

  return handoff
}
