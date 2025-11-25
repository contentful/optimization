import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import * as z from 'zod/mini'

/**
 * Base Zod schema for entry fields.
 *
 * @remarks
 * This is modeled as a catch-all map from string keys to JSON-compatible values.
 * The strong typing ot consumer-specified Contentful Entry fields is not
 * validated by these schemas.
 */
export const EntryFields = z.catchall(z.object({}), z.json())

/**
 * TypeScript type inferred from {@link EntryFields}.
 */
export type EntryFields = z.infer<typeof EntryFields>

/**
 * Zod schema representing a generic Contentful Link object.
 *
 * @remarks
 * This is used for references to other Contentful resources where `linkType` is not constrained.
 */
export const Link = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.string(),
    id: z.string(),
  }),
})

/**
 * TypeScript type inferred from {@link Link}.
 */
export type Link = z.infer<typeof Link>

/**
 * Zod schema representing a Contentful ContentType link.
 */
export const ContentTypeLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('ContentType'),
    id: z.string(),
  }),
})

/**
 * TypeScript type inferred from {@link ContentTypeLink}.
 */
export type ContentTypeLink = z.infer<typeof ContentTypeLink>

/**
 * Zod schema representing a Contentful Environment link.
 */
export const EnvironmentLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Environment'),
    id: z.string(),
  }),
})

/**
 * TypeScript type inferred from {@link EnvironmentLink}.
 */
export type EnvironmentLink = z.infer<typeof EnvironmentLink>

/**
 * Zod schema representing a Contentful Space link.
 */
export const SpaceLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Space'),
    id: z.string(),
  }),
})

/**
 * TypeScript type inferred from {@link SpaceLink}.
 */
export type SpaceLink = z.infer<typeof SpaceLink>

/**
 * Zod schema representing a Contentful Tag link.
 */
export const TagLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Tag'),
    id: z.string(),
  }),
})

/**
 * TypeScript type inferred from {@link TagLink}.
 */
export type TagLink = z.infer<typeof TagLink>

/**
 * Zod schema describing the `sys` block for a Contentful entry.
 *
 * @remarks
 * This mirrors the structure of `Entry['sys']` from the Contentful SDK with
 * a subset of fields used by this library.
 */
export const EntrySys = z.object({
  type: z.literal('Entry'),
  contentType: ContentTypeLink,
  publishedVersion: z.number(),
  id: z.string(),
  createdAt: z.any(),
  updatedAt: z.any(),
  locale: z.optional(z.string()),
  revision: z.number(),
  space: SpaceLink,
  environment: EnvironmentLink,
})

/**
 * TypeScript type inferred from {@link EntrySys}.
 */
export type EntrySys = z.infer<typeof EntrySys>

/**
 * Zod schema describing a generic Contentful entry.
 *
 * @remarks
 * This model is intentionally loose: `fields` is any JSON-compliant object and
 * `metadata` is modeled as a catch-all object that must contain an array of
 * {@link TagLink} tags.
 */
export const CtflEntry = z.object({
  /**
   * The entry fields payload.
   */
  fields: EntryFields,

  /**
   * Contentful metadata, including tags.
   */
  metadata: z.catchall(
    z.object({
      tags: z.array(TagLink),
    }),
    z.json(),
  ),

  /**
   * System-managed properties describing the entry.
   */
  sys: EntrySys,
})

/**
 * TypeScript type inferred from {@link CtflEntry}.
 */
export type CtflEntry = z.infer<typeof CtflEntry>

/**
 * Type guard that checks whether the given value is a Contentful {@link Entry},
 * passing through the specified skeleton, chain modifiers, and locale.
 *
 * @typeParam S - The entry skeleton type.
 * @typeParam M - The chain modifiers type. Defaults to {@link ChainModifiers}.
 * @typeParam L - The locale code type. Defaults to {@link LocaleCode}.
 *
 * @param entry - The value to test.
 * @returns `true` if the object conforms to {@link CtflEntry} and can be treated
 * as a typed {@link Entry}, otherwise `false`.
 */
export function isEntry<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(entry: Entry | undefined): entry is Entry<S, M, L> {
  return CtflEntry.safeParse(entry).success
}
