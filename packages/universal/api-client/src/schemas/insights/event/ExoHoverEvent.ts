import * as z from 'zod/mini'
import { ExoEventProperties } from '../../experience/event'

/**
 * Zod schema describing an `exo_node_hover` event.
 *
 * @public
 */
export const ExoHoverEvent = z.extend(ExoEventProperties, {
  type: z.literal('exo_node_hover'),
  hoverDurationMs: z.int().check(z.minimum(0)),
  hoverId: z.string(),
})

/**
 * TypeScript type inferred from {@link ExoHoverEvent}.
 *
 * @public
 */
export type ExoHoverEvent = z.infer<typeof ExoHoverEvent>
