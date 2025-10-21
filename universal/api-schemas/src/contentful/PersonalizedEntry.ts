import type { Entry as ContentfulEntry } from 'contentful'
import * as z from 'zod/mini'
import { Entry, EntryFields } from './Entry'
import { PersonalizationEntryArray } from './PersonalizationEntry'

export const PersonalizedEntry = z.extend(Entry, {
  fields: z.extend(EntryFields, {
    nt_experiences: PersonalizationEntryArray,
  }),
})
export type PersonalizedEntry = z.infer<typeof PersonalizedEntry>

export function isPersonalizedEntry(
  entry: ContentfulEntry | undefined,
): entry is PersonalizedEntry {
  return PersonalizedEntry.safeParse(entry).success
}
