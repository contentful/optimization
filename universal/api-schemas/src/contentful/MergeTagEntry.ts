import * as z from 'zod/mini'
import { CtflEntry, EntrySys } from './CtflEntry'

/**
 * Zod schema for a Merge Tag Contentful entry.
 *
 * @remarks
 * Extends {@link CtflEntry} with merge-tag-specific fields and constrains the
 * `contentType` to the `nt_mergetag` content type.
 */
export const MergeTagEntry = z.extend(CtflEntry, {
  fields: z.object({
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
  }),

  /**
   * System fields extended to constrain the content type to `nt_mergetag`.
   */
  sys: z.extend(EntrySys, {
    contentType: z.object({
      sys: z.object({
        type: z.literal('Link'),
        linkType: z.literal('ContentType'),
        id: z.literal('nt_mergetag'),
      }),
    }),
  }),
})

/**
 * TypeScript type inferred from {@link MergeTagEntry}.
 */
export type MergeTagEntry = z.infer<typeof MergeTagEntry>
