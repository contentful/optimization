import * as z from 'zod/mini'
import { UniversalEventProperties } from '../../experience/event'

/**
 * Zod schema describing the supported kinds of ExO entities.
 *
 * @public
 */
export const ExoNodeEntityKind = z.enum([
  'Experience',
  'Fragment',
  'InlineFragment',
  'InlineComponent',
])

/**
 * TypeScript type inferred from {@link ExoNodeEntityKind}.
 *
 * @public
 */
export type ExoNodeEntityKind = z.infer<typeof ExoNodeEntityKind>

/**
 * Zod schema describing properties shared by ExO node interaction events.
 *
 * @public
 */
export const ExoNodeEventProperties = z.extend(UniversalEventProperties, {
  /**
   * Identifier of the rendered ExO entity.
   */
  entityId: z.string(),

  /**
   * Kind of ExO entity represented by this event.
   */
  entityKind: ExoNodeEntityKind,

  /**
   * Optional identifier of the entity's concrete content kind.
   */
  entityKindId: z.optional(z.string()),

  /**
   * Contentful entry identifiers rendered by the entity.
   */
  entryIds: z.optional(z.array(z.string())),

  /**
   * Identifier of the optimization that selected the entity variant.
   */
  optimizationId: z.string(),

  /**
   * Parameter values used to render the entity.
   */
  parameters: z.optional(z.record(z.string(), z.json())),

  /**
   * Identifier of the containing experience, when the entity is nested.
   */
  parentExperienceId: z.optional(z.string()),

  /**
   * Identifier of the selected entity variant.
   */
  variantId: z.string(),

  /**
   * Index of the selected variant when available.
   */
  variantIndex: z.optional(z.number()),
})

/**
 * TypeScript type inferred from {@link ExoNodeEventProperties}.
 *
 * @public
 */
export type ExoNodeEventProperties = z.infer<typeof ExoNodeEventProperties>

/**
 * Zod schema describing an `exo_node_view` event.
 *
 * @public
 */
export const ExoNodeViewEvent = z.extend(ExoNodeEventProperties, {
  type: z.literal('exo_node_view'),
  viewDurationMs: z.int().check(z.minimum(0)),
  viewId: z.string(),
})

/**
 * TypeScript type inferred from {@link ExoNodeViewEvent}.
 *
 * @public
 */
export type ExoNodeViewEvent = z.infer<typeof ExoNodeViewEvent>

/**
 * Zod schema describing an `exo_node_click` event.
 *
 * @public
 */
export const ExoNodeClickEvent = z.extend(ExoNodeEventProperties, {
  type: z.literal('exo_node_click'),
})

/**
 * TypeScript type inferred from {@link ExoNodeClickEvent}.
 *
 * @public
 */
export type ExoNodeClickEvent = z.infer<typeof ExoNodeClickEvent>

/**
 * Zod schema describing an `exo_node_hover` event.
 *
 * @public
 */
export const ExoNodeHoverEvent = z.extend(ExoNodeEventProperties, {
  type: z.literal('exo_node_hover'),
  hoverDurationMs: z.int().check(z.minimum(0)),
  hoverId: z.string(),
})

/**
 * TypeScript type inferred from {@link ExoNodeHoverEvent}.
 *
 * @public
 */
export type ExoNodeHoverEvent = z.infer<typeof ExoNodeHoverEvent>
