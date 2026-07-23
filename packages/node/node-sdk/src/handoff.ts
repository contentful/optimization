import {
  getOptimizationCacheSafetyWarnings,
  type ManagedEntryHandoff,
  type OptimizationCacheMetadata,
  type OptimizationData,
  type OptimizationHandoff,
} from '@contentful/optimization-core'

function assertRequestHandoffCacheSafety(handoff: OptimizationHandoff): void {
  const profileWarning = getOptimizationCacheSafetyWarnings(handoff).find(
    (warning) => warning.code === 'profile-state-in-public-cache',
  )

  if (profileWarning === undefined) return

  throw new TypeError(
    `${profileWarning.message} Request handoffs with profile state must use private-request cache scope.`,
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
  readonly cache?: OptimizationCacheMetadata
}): OptimizationHandoff {
  const handoff: OptimizationHandoff = {
    cache: input.cache ?? { scope: 'private-request' },
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

  assertRequestHandoffCacheSafety(handoff)

  return handoff
}
