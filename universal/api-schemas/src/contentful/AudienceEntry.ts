import * as z from 'zod/mini'
import { CtflEntry, EntryFields } from './CtflEntry'

export const AudienceEntryFields = z.extend(EntryFields, {
  /**
   * The internal id of the audience (Short Text)
   */
  nt_audience_id: z.string(),

  /**
   * The name of the audience (Short Text)
   */
  nt_name: z.optional(z.string()),

  /**
   * The description of the audience (Short Text)
   */
  nt_description: z.optional(z.string()),
})
export type AudienceEntryFields = z.infer<typeof AudienceEntryFields>

export const AudienceEntry = z.extend(CtflEntry, {
  fields: AudienceEntryFields,
})
export type AudienceEntry = z.infer<typeof AudienceEntry>
