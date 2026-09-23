import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

/**
 * Zod schema describing the supported kinds of ExO entities.
 *
 * @public
 */
export const ExoEntityKind = z.enum(['Experience', 'Fragment', 'InlineFragment', 'InlineComponent'])

/**
 * TypeScript type inferred from {@link ExoEntityKind}.
 *
 * @public
 */
export type ExoEntityKind = z.infer<typeof ExoEntityKind>

/**
 * Zod schema describing properties shared by ExO interaction events.
 *
 * @public
 */
export const ExoEventProperties = z.extend(UniversalEventProperties, {
  /** Identifier of the rendered ExO entity. */
  entityId: z.string(),

  /** Kind of ExO entity represented by this event. */
  entityKind: ExoEntityKind,

  /** Optional identifier of the entity's concrete content kind. */
  entityKindId: z.optional(z.string()),

  /** Contentful entry identifiers rendered by the entity. */
  entryIds: z.optional(z.array(z.string())),

  /** Identifier of the optimization that selected the entity variant, when available. */
  optimizationId: z.optional(z.string()),

  /** Parameter values used to render the entity. */
  parameters: z.optional(z.record(z.string(), z.json())),

  /** Identifier of the containing experience, when the entity is nested. */
  parentExperienceId: z.optional(z.string()),

  /** Identifier of the selected entity variant, when available. */
  variantId: z.optional(z.string()),

  /** Index of the selected variant when available. */
  variantIndex: z.optional(z.number()),
})

/**
 * TypeScript type inferred from {@link ExoEventProperties}.
 *
 * @public
 */
export type ExoEventProperties = z.infer<typeof ExoEventProperties>
