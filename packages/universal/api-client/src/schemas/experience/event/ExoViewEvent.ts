import * as z from 'zod/mini'
import { ExoEventProperties } from './ExoEventProperties'

/**
 * Zod schema describing an `exo_node_view` event.
 *
 * @public
 */
export const ExoViewEvent = z.extend(ExoEventProperties, {
  type: z.literal('exo_node_view'),
  viewDurationMs: z.int().check(z.minimum(0)),
  viewId: z.string(),
})

/**
 * TypeScript type inferred from {@link ExoViewEvent}.
 *
 * @public
 */
export type ExoViewEvent = z.infer<typeof ExoViewEvent>
