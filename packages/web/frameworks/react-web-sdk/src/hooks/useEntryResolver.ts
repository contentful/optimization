import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { EntryFor } from '@contentful/optimization-web/core-sdk'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
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
  readonly resolveEntry: {
    <S extends EntrySkeletonType = EntrySkeletonType, L extends LocaleCode = LocaleCode>(
      entry: Entry<S, undefined, L>,
      selectedOptimizations?: SelectedOptimizationArray,
    ): EntryFor<S, undefined, L>
    <
      S extends EntrySkeletonType,
      M extends ChainModifiers = ChainModifiers,
      L extends LocaleCode = LocaleCode,
    >(
      entry: Entry<S, M, L>,
      selectedOptimizations?: SelectedOptimizationArray,
    ): EntryFor<S, M, L>
  }
  /**
   * Resolves an entry and returns the resolved entry plus selected optimization metadata.
   */
  readonly resolveEntryData: OptimizationSdk['resolveOptimizedEntry']
}

function createResolveEntry(sdk: OptimizationSdk): UseEntryResolverResult['resolveEntry'] {
  function resolveEntry<
    S extends EntrySkeletonType = EntrySkeletonType,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, undefined, L>,
    selectedOptimizations?: SelectedOptimizationArray,
  ): EntryFor<S, undefined, L>
  function resolveEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(entry: Entry<S, M, L>, selectedOptimizations?: SelectedOptimizationArray): EntryFor<S, M, L>
  function resolveEntry(entry: Entry, selectedOptimizations?: SelectedOptimizationArray): Entry {
    return sdk.resolveOptimizedEntry(entry, selectedOptimizations).entry
  }

  return resolveEntry
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

  return useMemo<UseEntryResolverResult>(() => {
    const resolveOptimizedEntry = sdk.resolveOptimizedEntry.bind(sdk)

    return {
      resolveOptimizedEntry,
      resolveEntry: createResolveEntry(sdk),
      resolveEntryData: resolveOptimizedEntry,
    }
  }, [sdk])
}
