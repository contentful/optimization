import * as z from 'zod/mini'
import { CtflEntry, EntryFields } from './CtflEntry'

/**
 * Zod schema describing the fields of an Audience entry.
 *
 * @remarks
 * Extends the base {@link EntryFields} with audience-specific properties.
 */
export const AudienceEntryFields = z.extend(EntryFields, {
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
 * TypeScript type inferred from {@link AudienceEntryFields}.
 */
export type AudienceEntryFields = z.infer<typeof AudienceEntryFields>

/**
 * Zod schema for a Contentful Audience entry, including system metadata.
 *
 * @remarks
 * Extends the generic {@link CtflEntry} with {@link AudienceEntryFields} as the `fields` payload.
 */
export const AudienceEntry = z.extend(CtflEntry, {
  fields: AudienceEntryFields,
})

/**
 * TypeScript type inferred from {@link AudienceEntry}.
 */
export type AudienceEntry = z.infer<typeof AudienceEntry>

/**
 * Zod "skeleton" schema for a Contentful Audience entry, including `contentTypeId`.
 */
export const AudienceEntrySkeleton = z.extend(AudienceEntry, {
  contentTypeId: z.literal('nt_audience'),
})

/**
 * TypeScript type inferred from {@link AudienceEntrySkeleton}.
 */
export type AudienceEntrySkeleton = z.infer<typeof AudienceEntrySkeleton>
