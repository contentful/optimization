import type { SelectedOptimizationArray } from '@contentful/optimization-api-client/api-schemas'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import type { ResolvedData } from './resolvers'

/**
 * Baseline and resolved-entry metadata for optimized-entry render surfaces.
 *
 * @public
 */
export interface OptimizedEntryMetadata<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  /** Entry supplied by the caller or fetched before optimization resolution. */
  readonly baselineEntry: Entry<S, M, L>
  /** ID of the baseline entry supplied by the caller or fetched before optimization resolution. */
  readonly baselineEntryId: string
  /** Baseline or resolved variant entry. */
  readonly entry: Entry<S, M, L>
  /** ID of the baseline or resolved variant entry. */
  readonly entryId: string
  /** Opaque runtime-owned optimization context ID for entry interaction tracking. */
  readonly optimizationContextId: string | undefined
  /** Full resolved entry payload returned by the optimization resolver. */
  readonly resolvedData: ResolvedData<S, M, L>
  /** Selected optimization metadata, if a matching optimization was selected. */
  readonly selectedOptimization: ResolvedData<S, M, L>['selectedOptimization']
  /** Selected optimizations used to resolve this entry, when available. */
  readonly selectedOptimizations: SelectedOptimizationArray | undefined
}
