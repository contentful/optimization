import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

/**
 * Zod schema describing a `component` view event.
 *
 * @remarks
 * Component view events track exposure of individual components such as
 * entries or variables within a personalized experience.
 *
 * Extends {@link UniversalEventProperties}.
 */
export const ComponentViewEvent = z.extend(UniversalEventProperties, {
  /**
   * Discriminator indicating that this event is a component view.
   */
  type: z.literal('component'),

  /**
   * Type of component that was viewed.
   *
   * - `'Entry'` — A content entry component.
   * - `'Variable'` — A variable or inline value component.
   */
  componentType: z.union([z.literal('Entry'), z.literal('Variable')]),

  /**
   * Contentful entry ID corresponding to the component that was viewed.
   */
  componentId: z.string(),

  /**
   * Identifier of the experience that rendered this component.
   *
   * @remarks
   * Optional; component views may occur outside of a specific experience/personalization.
   */
  experienceId: z.optional(z.string()),

  /**
   * Index of the variant associated with this component view.
   *
   * @remarks
   * Typically corresponds to the index of the selected personalization entry.
   */
  variantIndex: z.number(),
})

/**
 * TypeScript type inferred from {@link ComponentViewEvent}.
 */
export type ComponentViewEvent = z.infer<typeof ComponentViewEvent>
