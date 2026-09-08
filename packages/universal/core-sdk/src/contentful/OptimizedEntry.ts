import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from 'contentful'
import * as z from 'zod/mini'
import type { OptimizationEntryArray, OptimizationEntrySkeleton } from './OptimizationEntry'

/**
 * Zod schema describing the optimization-owned fields attached to an optimized entry.
 *
 * @public
 */
export const OptimizedEntryFields = z.object({
  /**
   * Optimization or experimentation experiences attached to this entry.
   */
  nt_experiences: z.array(z.unknown()),
})

/**
 * Runtime field values for an optimized Contentful entry.
 *
 * @public
 */
export interface OptimizedEntryFields<
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  nt_experiences: OptimizationEntryArray<M, L>
}

/**
 * Contentful SDK skeleton for an entry with attached Optimization experiences.
 *
 * @public
 */
export type OptimizedEntrySkeleton = EntrySkeletonType<{
  nt_experiences: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<OptimizationEntrySkeleton>>
}>

/**
 * Resolved Contentful entry with attached Optimization experiences.
 *
 * @public
 */
export type OptimizedEntry<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = Omit<Entry<S, M, L>, 'fields'> & {
  fields: Entry<S, M, L>['fields'] & OptimizedEntryFields<M, L>
}
