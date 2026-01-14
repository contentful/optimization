import type { Entry } from 'contentful'
import * as z from 'zod/mini'
import { AudienceEntry } from './AudienceEntry'
import { CtflEntry, EntryFields, Link } from './CtflEntry'
import { PersonalizationConfig } from './PersonalizationConfig'

/**
 * Union of supported personalization types.
 *
 * @remarks
 * `nt_experiment` represents experiments (A/B tests), and `nt_personalization`
 * represents always-on personalized experiences.
 */
export const PersonalizationType = z.union([
  z.literal('nt_experiment'),
  z.literal('nt_personalization'),
])

/**
 * TypeScript type inferred from {@link PersonalizationType}.
 */
export type PersonalizationType = z.infer<typeof PersonalizationType>

/**
 * Zod schema describing the fields of a Personalization entry.
 *
 * @remarks
 * Extends the generic {@link EntryFields} with personalization-specific
 * properties such as name, description, type, config, audience, and variants.
 */
export const PersonalizationFields = z.extend(EntryFields, {
  /**
   * The name of the personalization (Short Text).
   */
  nt_name: z.string(),

  /**
   * The description of the personalization (Short Text).
   *
   * @remarks
   * Optional, may be `null` if no description is provided.
   */
  nt_description: z.optional(z.nullable(z.string())),

  /**
   * The type of the personalization (`nt_experiment` | `nt_personalization`).
   */
  nt_type: PersonalizationType,

  /**
   * The configuration of a {@link PersonalizationEntry } (JSON).
   *
   * @remarks
   * Accepts `null` or an explicit {@link PersonalizationConfig} and converts
   * falsy/undefined values into a default configuration.
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
   * The audience of the personalization (Audience).
   *
   * @remarks
   * Optional and nullable; when omitted or `null`, the personalization may apply
   * to all users.
   */
  nt_audience: z.optional(z.nullable(AudienceEntry)),

  /**
   * All used variants of the personalization (Contentful references to other Content Types).
   *
   * @remarks
   * Modeled as an array of untyped Contentful entries and defaults to an empty
   * array when omitted.
   */
  nt_variants: z.optional(z.prefault(z.array(z.custom<Entry>()), [])),

  /**
   * The personalization/experience ID related to this personalization entry.
   */
  nt_experience_id: z.string(),
})

/**
 * TypeScript type inferred from {@link PersonalizationFields}.
 */
export type PersonalizationFields = z.infer<typeof PersonalizationFields>

/**
 * Zod schema describing a Personalization entry, which is associated with a {@link PersonalizedEntry } via its `fields.nt_experiences`.
 */
export const PersonalizationEntry = z.extend(CtflEntry, {
  fields: PersonalizationFields,
})

/**
 * TypeScript type inferred from {@link PersonalizationEntry}.
 */
export type PersonalizationEntry = z.infer<typeof PersonalizationEntry>

/**
 * Zod schema describing a Personalization entry "skeleton".
 */
export const PersonalizationEntrySkeleton = z.extend(PersonalizationEntry, {
  contentTypeId: z.literal('nt_experience'),
})

/**
 * TypeScript type inferred from {@link PersonalizationEntrySkeleton}.
 */
export type PersonalizationEntrySkeleton = z.infer<typeof PersonalizationEntrySkeleton>

/**
 * Type guard for {@link PersonalizationEntry}.
 *
 * @param entry - Contentful entry or link to test.
 * @returns `true` if the value conforms to {@link PersonalizationEntry}, otherwise `false`.
 */
export function isPersonalizationEntry(entry: CtflEntry | Link): entry is PersonalizationEntry {
  return PersonalizationEntry.safeParse(entry).success
}

/**
 * Zod schema describing an array of personalization entries or links.
 *
 * @remarks
 * Each element may be a {@link Link} or a fully resolved {@link PersonalizationEntry}.
 */
export const PersonalizationEntryArray = z.array(z.union([Link, PersonalizationEntry]))

/**
 * TypeScript type inferred from {@link PersonalizationEntryArray}.
 */
export type PersonalizationEntryArray = z.infer<typeof PersonalizationEntryArray>
