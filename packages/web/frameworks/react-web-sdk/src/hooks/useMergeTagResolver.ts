import { useMemo } from 'react'

import type { OptimizationSdk } from '../context/OptimizationContext'
import { useOptimizationContext } from './useOptimization'

/**
 * Helper methods for resolving Contentful merge tag entries against the current visitor profile.
 *
 * @public
 */
export interface UseMergeTagResolverResult {
  /**
   * Resolves a merge tag entry to the matching visitor profile value.
   */
  readonly getMergeTagValue: OptimizationSdk['getMergeTagValue']
}

/**
 * Returns merge-tag resolution helpers for React components.
 *
 * @remarks
 * SSR-safe: when the SDK is not yet ready the resolver returns `undefined`.
 *
 * @example
 * ```tsx
 * const { getMergeTagValue } = useMergeTagResolver()
 * const value = getMergeTagValue(mergeTagEntry)
 * ```
 *
 * @public
 */
export function useMergeTagResolver(): UseMergeTagResolverResult {
  const { sdk } = useOptimizationContext()

  return useMemo<UseMergeTagResolverResult>(
    () => ({
      getMergeTagValue: (embeddedEntryNodeTarget, profile) =>
        sdk?.getMergeTagValue(embeddedEntryNodeTarget, profile),
    }),
    [sdk],
  )
}
