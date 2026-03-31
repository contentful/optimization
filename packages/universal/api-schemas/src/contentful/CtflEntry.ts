import * as z from 'zod/mini'

/**
 * Base Zod schema for entry fields.
 *
 * @remarks
 * This is modeled as a catch-all map from string keys to JSON-compatible values.
 * The strong typing ot consumer-specified Contentful Entry fields is not
 * validated by these schemas.
 *
 * @public
 */
export const EntryFields = z.catchall(z.object({}), z.json())

/**
 * TypeScript type inferred from {@link EntryFields}.
 *
 * @public
 */
export type EntryFields = z.infer<typeof EntryFields>

/**
 * Zod schema representing a generic Contentful Link object.
 *
 * @remarks
 * This is used for references to other Contentful resources where `linkType` is not constrained.
 *
 * @public
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
 *
 * @public
 */
export type Link = z.infer<typeof Link>

/**
 * Zod schema representing a Contentful ContentType link.
 *
 * @public
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
 *
 * @public
 */
export type ContentTypeLink = z.infer<typeof ContentTypeLink>

/**
 * Zod schema representing a Contentful Environment link.
 *
 * @public
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
 *
 * @public
 */
export type EnvironmentLink = z.infer<typeof EnvironmentLink>

/**
 * Zod schema representing a Contentful Space link.
 *
 * @public
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
 *
 * @public
 */
export type SpaceLink = z.infer<typeof SpaceLink>

/**
 * Zod schema representing a Contentful Taxonomy Concept link.
 *
 * @internal
 */
export const TaxonomyConceptLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('TaxonomyConcept'),
    id: z.string(),
  }),
})

/**
 * TypeScript type inferred from {@link TaxonomyConceptLink}.
 *
 * @public
 */
export type TaxonomyConceptLink = z.infer<typeof TaxonomyConceptLink>

/**
 * Zod schema representing a Contentful Tag link.
 *
 * @public
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
 *
 * @public
 */
export type TagLink = z.infer<typeof TagLink>

/**
 * Zod schema describing the `sys` block for a Contentful entry.
 *
 * @remarks
 * This mirrors the structure of `Entry['sys']` from the Contentful SDK with
 * a subset of fields used by this library.
 *
 * @public
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
 *
 * @public
 */
export type EntrySys = z.infer<typeof EntrySys>

/**
 * Zod schema describing a generic Contentful entry.
 *
 * @remarks
 * This model is intentionally loose: `fields` is any JSON-compliant object and
 * `metadata` is modeled as a catch-all object that must contain an array of
 * {@link TagLink} tags.
 *
 * @public
 */
export const CtflEntry = z.object({
  /**
   * The entry fields payload.
   */
  fields: EntryFields,

  /**
   * Contentful metadata, including tags.
   */
  metadata: z.object({
    tags: z.array(TagLink),
    concepts: z.optional(z.array(TaxonomyConceptLink)),
  }),

  /**
   * System-managed properties describing the entry.
   */
  sys: EntrySys,
})

/**
 * TypeScript type inferred from {@link CtflEntry}.
 *
 * @public
 */
export type CtflEntry = z.infer<typeof CtflEntry>
