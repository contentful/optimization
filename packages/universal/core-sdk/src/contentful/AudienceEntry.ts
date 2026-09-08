import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from 'contentful'
import * as z from 'zod/mini'

/**
 * Zod schema describing the optimization-owned fields of an Audience entry.
 *
 * @public
 */
export const AudienceEntryFields = z.object({
  /**
   * The internal id of the audience (Short Text).
   *
   * @remarks
   * This usually corresponds to a stable identifier used by the personalization system.
   */
  nt_audience_id: z.string(),

  /**
   * The name of the audience (Short Text).
   *
   * @remarks
   * Optional field used for display purposes in tools and UI.
   */
  nt_name: z.optional(z.string()),

  /**
   * The description of the audience (Short Text).
   *
   * @remarks
   * Optional field intended for internal documentation and operator context.
   */
  nt_description: z.optional(z.string()),
})

/**
 * Runtime field values inferred from {@link AudienceEntryFields}.
 *
 * @public
 */
export type AudienceEntryFields = z.infer<typeof AudienceEntryFields>

/**
 * Contentful SDK skeleton for the `nt_audience` content type.
 *
 * @public
 */
export type AudienceEntrySkeleton = EntrySkeletonType<
  {
    nt_audience_id: EntryFieldTypes.Symbol
    nt_name: EntryFieldTypes.Symbol
    nt_description: EntryFieldTypes.Symbol
  },
  'nt_audience'
>

/**
 * Resolved Contentful Audience entry.
 *
 * @public
 */
export type AudienceEntry<
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = Omit<Entry<AudienceEntrySkeleton, M, L>, 'fields'> & {
  fields: AudienceEntryFields
}
