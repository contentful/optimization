import * as z from 'zod/mini'
import { UniversalEventProperties } from '../../experience/event/UniversalEventProperties'

const EntityKind = z.union([
  z.literal('Experience'),
  z.literal('Fragment'),
  z.literal('InlineFragment'),
  z.literal('InlineComponent'),
])

/**
 * A resolved ancestor personalization layer carried on `exo_*` events.
 *
 * @public
 */
export const ExoNodeLayer = z.object({
  entityKind: EntityKind,
  entityId: z.string(),
  variantId: z.optional(z.string()),
  variantIndex: z.optional(z.number()),
  optimizationId: z.optional(z.string()),
})

/**
 * TypeScript type inferred from {@link ExoNodeLayer}.
 *
 * @public
 */
export type ExoNodeLayer = z.infer<typeof ExoNodeLayer>

/**
 * Zod schema describing an `exo_node_view` event used for XDA graph node
 * viewport tracking.
 *
 * @remarks
 * These events track the exposure of rendered XDA nodes in the browser
 * viewport. They are self-contained: all metadata required by the ingestor
 * is embedded in the payload and no server-side lookup is needed.
 *
 * Unlike {@link ViewEvent}, which is entry-centric, `NodeViewEvent` is
 * graph-node-centric and carries structural metadata resolved from the XDA
 * `extensions.sourceMap`.
 *
 * @public
 */
export const NodeViewEvent = z.extend(UniversalEventProperties, {
  /**
   * Stable anonymous user identifier for this event.
   */
  anonymousId: z.string(),

  /**
   * Discriminator identifying this as an XDA node view event.
   */
  type: z.literal('exo_node_view'),

  /**
   * `sys.id` of the Experience or Fragment that owns this node.
   */
  entityId: z.string(),

  /**
   * Structural kind of the owning entity.
   */
  entityKind: EntityKind,

  /**
   * Variant identifier selected for this node.
   *
   * @remarks
   * Resolved from `extensions.sourceMap.variants[].variantId`, falling back to
   * `extensions.sourceMap.variants[].id`.
   */
  variantId: z.string(),

  /**
   * Variant index selected for this node.
   *
   * @remarks
   * Resolved from `extensions.sourceMap.variants[].variantIndex`, falling back
   * to the selected `extensions.sourceMap.layers[].variants[]` reference. The
   * default variant is index `0`.
   */
  variantIndex: z.number(),

  /**
   * Ninetailed experience (optimization) ID associated with this node.
   */
  optimizationId: z.string(),

  /**
   * UUID identifying a single active view session for this node.
   *
   * @remarks
   * Multiple events emitted for the same active view share this identifier.
   */
  viewId: z.string(),

  /**
   * Monotonically increasing visible duration for the active view, in
   * milliseconds.
   *
   * @remarks
   * Updated and re-emitted while the same view remains active.
   */
  viewDurationMs: z.number(),

  /**
   * Composite entity-kind identifier, when the owning entity has a subtype.
   */
  entityKindId: z.optional(z.string()),

  /**
   * Contentful `sys.id` values of content entries associated with this node.
   */
  entryIds: z.optional(z.array(z.string())),

  /**
   * Arbitrary key-value parameters captured at view time.
   */
  parameters: z.optional(z.record(z.string(), z.unknown())),

  /**
   * `sys.id` of the parent Experience when this node is nested inside one.
   */
  parentExperienceId: z.optional(z.string()),
})

/**
 * TypeScript type inferred from {@link NodeViewEvent}.
 *
 * @public
 */
export type NodeViewEvent = z.infer<typeof NodeViewEvent>
