import * as z from 'zod/mini'
import { ExoEventProperties } from '../../experience/event'

/**
 * Zod schema describing an `exo_node_click` event.
 *
 * @public
 */
export const ExoClickEvent = z.extend(ExoEventProperties, {
  type: z.literal('exo_node_click'),
})

/**
 * TypeScript type inferred from {@link ExoClickEvent}.
 *
 * @public
 */
export type ExoClickEvent = z.infer<typeof ExoClickEvent>
