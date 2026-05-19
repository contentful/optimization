import type { ResolvedData } from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useMemo } from 'react'
import type ContentfulOptimization from '../ContentfulOptimization'
import { useOptimization } from '../context/OptimizationContext'

/**
 * Helper methods for resolving Contentful entries against selected optimizations.
 *
 * @public
 */
export interface UseEntryResolverResult {
  /**
   * Resolves an entry and returns the full SDK resolver payload.
   */
  readonly resolveOptimizedEntry: (
    entry: Entry,
    selectedOptimizations?: SelectedOptimizationArray,
  ) => ResolvedData<EntrySkeletonType>
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

function resolveEntryData(
  sdk: ContentfulOptimization,
  entry: Entry,
  selectedOptimizations = sdk.states.selectedOptimizations.current,
): ResolvedData<EntrySkeletonType> {
  return sdk.resolveOptimizedEntry(entry, selectedOptimizations)
}

/**
 * Returns entry-resolution helpers for React Native components.
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

  return useMemo(
    () => ({
      resolveOptimizedEntry: (
        entry: Entry,
        selectedOptimizations = sdk.states.selectedOptimizations.current,
      ) => sdk.resolveOptimizedEntry(entry, selectedOptimizations),
      resolveEntry: (entry, selectedOptimizations) =>
        resolveEntryData(sdk, entry, selectedOptimizations).entry,
      resolveEntryData: (entry, selectedOptimizations) =>
        resolveEntryData(sdk, entry, selectedOptimizations),
    }),
    [sdk],
  )
}
