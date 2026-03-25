import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

/**
 * Zod schema describing shared interaction event properties.
 *
 * @public
 */
export const InteractionEventProperties = z.extend(UniversalEventProperties, {
  /**
   * Type of component for the interaction event.
   *
   * - `'Entry'` — A content entry component.
   * - `'Variable'` — A variable or inline value component.
   */
  componentType: z.union([z.literal('Entry'), z.literal('Variable')]),

  /**
   * Contentful entry ID corresponding to the interacted component.
   */
  componentId: z.string(),

  /**
   * Identifier of the experience that rendered this component.
   *
   * @remarks
   * Optional; interactions may occur outside of a specific experience/personalization.
   */
  experienceId: z.optional(z.string()),

  /**
   * Index of the variant associated with this interaction.
   *
   * @remarks
   * Typically corresponds to the index of the selected optimization entry.
   */
  variantIndex: z.number(),
})

/**
 * TypeScript type inferred from {@link InteractionEventProperties}.
 *
 * @public
 */
export type InteractionEventProperties = z.infer<typeof InteractionEventProperties>
