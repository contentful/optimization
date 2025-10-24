import * as z from 'zod/mini'
import { Entry, EntrySys } from './Entry'

export const MergeTagEntry = z.extend(Entry, {
  fields: z.object({
    nt_name: z.string(),
    nt_fallback: z.optional(z.string()),
    nt_mergetag_id: z.string(),
  }),
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
export type MergeTagEntry = z.infer<typeof MergeTagEntry>
