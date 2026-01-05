import type { Entry } from 'contentful'
import * as z from 'zod/mini'
import { CtflEntry, EntryFields } from './CtflEntry'
import { PersonalizationEntryArray } from './PersonalizationEntry'

/**
 * Zod schema describing a Contentful entry that has attached personalizations.
 *
 * @remarks
 * Extends {@link CtflEntry} and adds `nt_experiences` to the `fields` object.
 */
export const PersonalizedEntry = z.extend(CtflEntry, {
  fields: z.extend(EntryFields, {
    /**
     * Personalization or experimentation experiences attached to this entry.
     */
    nt_experiences: PersonalizationEntryArray,
  }),
})

/**
 * TypeScript type inferred from {@link PersonalizedEntry}.
 */
export type PersonalizedEntry = z.infer<typeof PersonalizedEntry>

/**
 * Type guard for {@link PersonalizedEntry}.
 *
 * @param entry - Contentful entry to test.
 * @returns `true` if the entry conforms to {@link PersonalizedEntry}, otherwise `false`.
 */
export function isPersonalizedEntry(entry: Entry | undefined): entry is PersonalizedEntry {
  return PersonalizedEntry.safeParse(entry).success
}
