import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from 'contentful'
import * as z from 'zod/mini'

/**
 * Zod schema for optimization-owned Merge Tag fields.
 *
 * @public
 */
export const MergeTagEntryFields = z.object({
  /**
   * Human-readable name of the merge tag.
   */
  nt_name: z.string(),

  /**
   * Fallback value to use when the merge tag cannot be resolved.
   */
  nt_fallback: z.optional(z.string()),

  /**
   * Internal identifier of the merge tag.
   */
  nt_mergetag_id: z.string(),
})

/**
 * Runtime field values inferred from {@link MergeTagEntryFields}.
 *
 * @public
 */
export type MergeTagEntryFields = z.infer<typeof MergeTagEntryFields>

/**
 * Contentful SDK skeleton for the `nt_mergetag` content type.
 *
 * @public
 */
export type MergeTagEntrySkeleton = EntrySkeletonType<
  {
    nt_name: EntryFieldTypes.Symbol
    nt_fallback: EntryFieldTypes.Symbol
    nt_mergetag_id: EntryFieldTypes.Symbol
  },
  'nt_mergetag'
>

/**
 * Resolved Contentful Merge Tag entry.
 *
 * @public
 */
export type MergeTagEntry<
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = Omit<Entry<MergeTagEntrySkeleton, M, L>, 'fields'> & {
  fields: MergeTagEntryFields
}
