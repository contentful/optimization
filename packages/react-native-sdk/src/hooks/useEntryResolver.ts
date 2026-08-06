import type { EntryFor, ResolvedData } from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { useMemo } from 'react'
import { useOptimization } from '../context/OptimizationContext'
import type { OptimizationSdk } from '../OptimizationSdk'

interface ResolveEntry {
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
   * Resolves an entry and returns only the resolved entry. Use {@link resolveEntryData} when the
   * result controls rendering so empty variants can be omitted.
   */
  readonly resolveEntry: ResolveEntry
  /**
   * Resolves an entry and returns the full result needed to omit empty variants before rendering.
   */
  readonly resolveEntryData: OptimizationSdk['resolveOptimizedEntry']
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
 * const { resolveEntryData } = useEntryResolver()
 * const resolvedData = resolveEntryData(baselineEntry)
 *
 * return resolvedData.isEmptyVariant ? null : <Hero entry={resolvedData.entry} />
 * ```
 *
 * @public
 */
export function useEntryResolver(): UseEntryResolverResult {
  const sdk = useOptimization()

  return useMemo(() => {
    function resolveEntryData<
      S extends EntrySkeletonType = EntrySkeletonType,
      L extends LocaleCode = LocaleCode,
    >(
      entry: Entry<S, undefined, L>,
      selectedOptimizations?: SelectedOptimizationArray,
    ): ResolvedData<S, undefined, L>
    function resolveEntryData<
      S extends EntrySkeletonType,
      M extends ChainModifiers = ChainModifiers,
      L extends LocaleCode = LocaleCode,
    >(
      entry: Entry<S, M, L>,
      selectedOptimizations?: SelectedOptimizationArray,
    ): ResolvedData<S, M, L>
    function resolveEntryData<
      S extends EntrySkeletonType,
      M extends ChainModifiers,
      L extends LocaleCode,
    >(
      entry: Entry<S, M, L>,
      selectedOptimizations = sdk.states.selectedOptimizations.current,
    ): ResolvedData<S, M, L> {
      return sdk.resolveOptimizedEntry<S, M, L>(entry, selectedOptimizations)
    }

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
    function resolveEntry<
      S extends EntrySkeletonType,
      M extends ChainModifiers,
      L extends LocaleCode,
    >(entry: Entry<S, M, L>, selectedOptimizations?: SelectedOptimizationArray): EntryFor<S, M, L> {
      return resolveEntryData<S, M, L>(entry, selectedOptimizations).entry
    }

    return {
      resolveOptimizedEntry: resolveEntryData,
      resolveEntry,
      resolveEntryData,
    }
  }, [sdk])
}
