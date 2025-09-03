import { extend, optional, string, type infer as zInfer } from 'zod/mini'
import { EntryFields, Entry } from './Entry'

export const AudienceEntryFields = extend(EntryFields, {
  /**
   * The internal id of the audience (Short Text)
   */
  nt_audience_id: string(),

  /**
   * The name of the audience (Short Text)
   */
  nt_name: optional(string()),

  /**
   * The description of the audience (Short Text)
   */
  nt_description: optional(string()),
})
export type AudienceEntryFields = zInfer<typeof AudienceEntryFields>

export const AudienceEntry = extend(Entry, {
  fields: AudienceEntryFields,
})
export type AudienceEntry = zInfer<typeof AudienceEntry>
