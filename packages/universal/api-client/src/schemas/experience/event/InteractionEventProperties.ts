import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

/**
 * Zod schema describing shared interaction event properties.
 *
 * @public
 */
export const InteractionEventProperties = z.extend(UniversalEventProperties, {
  /**
   * Type of tracked optimization target for the interaction event.
   *
   * - `'Entry'` — A content entry.
   * - `'Variable'` — A Custom Flag or other variable-backed optimization target.
   */
  componentType: z.union([z.literal('Entry'), z.literal('Variable')]),

  /**
   * Contentful entry ID or flag key corresponding to the interaction.
   */
  componentId: z.string(),

  /**
   * Identifier of the experience that rendered this entry or flag.
   *
   * @remarks
   * Optional; interactions can occur outside of a specific experiment/personalization.
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
