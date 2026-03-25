import * as z from 'zod/mini'
import { InteractionEventProperties } from '../../experience/event'

/**
 * Zod schema describing a `component_click` event used for entry click tracking.
 *
 * @remarks
 * These events track click interactions for entries within an optimized
 * experience.
 *
 * Extends {@link InteractionEventProperties}.
 *
 * @public
 */
export const ClickEvent = z.extend(InteractionEventProperties, {
  /**
   * Discriminator indicating that this is an entry click event.
   */
  type: z.literal('component_click'),
})

/**
 * TypeScript type inferred from {@link ClickEvent}.
 *
 * @public
 */
export type ClickEvent = z.infer<typeof ClickEvent>
