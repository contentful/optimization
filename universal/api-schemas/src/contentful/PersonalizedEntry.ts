import type { Entry } from 'contentful'
import * as z from 'zod/mini'
import { CtflEntry, EntryFields } from './CtflEntry'
import { PersonalizationEntryArray } from './PersonalizationEntry'

export const PersonalizedEntry = z.extend(CtflEntry, {
  fields: z.extend(EntryFields, {
    nt_experiences: PersonalizationEntryArray,
  }),
})
export type PersonalizedEntry = z.infer<typeof PersonalizedEntry>

export function isPersonalizedEntry(entry: Entry | undefined): entry is PersonalizedEntry {
  return PersonalizedEntry.safeParse(entry).success
}
