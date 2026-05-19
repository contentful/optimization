import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useMemo } from 'react'

import type { OptimizationSdk } from '../context/OptimizationContext'
import { useOptimization } from './useOptimization'

/**
 * Helper methods for resolving Contentful entries against selected optimizations.
 *
 * @public
 */
export interface UseEntryResolverResult {
  /**
   * Resolves an entry and returns the full SDK resolver payload.
   */
  readonly resolveOptimizedEntry: OptimizationSdk['resolveOptimizedEntry']
  /**
   * Resolves an entry and returns only the resolved entry.
   */
  readonly resolveEntry: (entry: Entry, selectedOptimizations?: SelectedOptimizationArray) => Entry
  /**
   * Resolves an entry and returns the resolved entry plus selected optimization metadata.
   */
  readonly resolveEntryData: (
    entry: Entry,
    selectedOptimizations?: SelectedOptimizationArray,
  ) => ResolvedData<EntrySkeletonType>
}

/**
 * Returns entry-resolution helpers for React components.
 *
 * @remarks
 * When `selectedOptimizations` is omitted, helpers use the current SDK
 * `states.selectedOptimizations` value.
 *
 * @example
 * ```tsx
 * const { resolveEntry } = useEntryResolver()
 * const resolvedEntry = resolveEntry(baselineEntry)
 * ```
 *
 * @public
 */
export function useEntryResolver(): UseEntryResolverResult {
  const sdk = useOptimization()

  return useMemo<UseEntryResolverResult>(
    () => ({
      resolveOptimizedEntry: (entry, selectedOptimizations) =>
        sdk.resolveOptimizedEntry(entry, selectedOptimizations),
      resolveEntry: (entry, selectedOptimizations) =>
        sdk.resolveOptimizedEntry(entry, selectedOptimizations).entry,
      resolveEntryData: (entry, selectedOptimizations) =>
        sdk.resolveOptimizedEntry(entry, selectedOptimizations),
    }),
    [sdk],
  )
}
