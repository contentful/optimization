import * as z from 'zod/mini'
import { InteractionEventProperties } from '../../experience/event'

/**
 * Zod schema describing a `component_click` event.
 *
 * @remarks
 * Component click events track click interactions for individual components
 * such as entries or variables within a personalized experience.
 *
 * Extends {@link InteractionEventProperties}.
 *
 * @public
 */
export const ClickEvent = z.extend(InteractionEventProperties, {
  /**
   * Discriminator indicating that this event is a component click.
   */
  type: z.literal('component_click'),
})

/**
 * TypeScript type inferred from {@link ClickEvent}.
 *
 * @public
 */
export type ClickEvent = z.infer<typeof ClickEvent>
