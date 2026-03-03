import * as z from 'zod/mini'
import { CtflEntry, EntryFields } from './CtflEntry'
import { PersonalizationEntryArray } from './PersonalizationEntry'

/**
 * Zod schema describing a Contentful entry that has attached personalizations.
 *
 * @remarks
 * Extends {@link CtflEntry} and adds `nt_experiences` to the `fields` object.
 *
 * @public
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
 *
 * @public
 */
export type PersonalizedEntry = z.infer<typeof PersonalizedEntry>
