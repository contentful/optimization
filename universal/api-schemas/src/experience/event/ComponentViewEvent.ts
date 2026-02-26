import * as z from 'zod/mini'
import { InteractionEventProperties } from './InteractionEventProperties'

/**
 * Zod schema describing a `component` view event.
 *
 * @remarks
 * Component view events track exposure of individual components such as
 * entries or variables within a personalized experience.
 *
 * Extends {@link InteractionEventProperties}.
 *
 * @public
 */
export const ComponentViewEvent = z.extend(InteractionEventProperties, {
  /**
   * Discriminator indicating that this event is a component view.
   */
  type: z.literal('component'),
})

/**
 * TypeScript type inferred from {@link ComponentViewEvent}.
 *
 * @public
 */
export type ComponentViewEvent = z.infer<typeof ComponentViewEvent>
