import { z } from 'zod/mini'
import { AudienceEntry } from './AudienceEntry'
import { Entry, EntryFields, Link } from './Entry'
import { PersonalizationConfig } from './PersonalizationConfig'

export const PersonalizationType = z.union([
  z.literal('nt_experiment'),
  z.literal('nt_personalization'),
])
export type PersonalizationType = z.infer<typeof PersonalizationType>

export const PersonalizationFields = z.extend(EntryFields, {
  /**
   * The name of the experience (Short Text)
   */
  nt_name: z.string(),

  /**
   * The description of the experience (Short Text)
   */
  nt_description: z.optional(z.nullable(z.string())),

  /**
   * The type if the experience (nt_experiment | nt_personalization)
   */
  nt_type: PersonalizationType,

  /**
   * The config of the experience (JSON)
   */
  nt_config: z.pipe(
    z.optional(z.prefault(z.nullable(PersonalizationConfig), null)),
    z.transform<PersonalizationConfig | null>(
      (v) =>
        v ?? {
          traffic: 0,
          distribution: [0.5, 0.5],
          components: [],
          sticky: false,
        },
    ),
  ),

  /**
   * The audience of the experience (Audience)
   */
  nt_audience: z.optional(z.nullable(AudienceEntry)),

  /**
   * All used variants of the experience (Contentful references to other Content Types)
   */
  nt_variants: z.optional(z.prefault(z.array(Entry), [])),
})
export type PersonalizationFields = z.infer<typeof PersonalizationFields>

export const PersonalizationEntry = z.extend(Entry, {
  fields: PersonalizationFields,
})
export type PersonalizationEntry = z.infer<typeof PersonalizationEntry>

export function isPersonalizationEntry(entry: Entry | Link): entry is PersonalizationEntry {
  return PersonalizationEntry.safeParse(entry).success
}

export const PersonalizationEntryArray = z.array(z.union([Link, PersonalizationEntry]))
export type PersonalizationEntryArray = z.infer<typeof PersonalizationEntryArray>
