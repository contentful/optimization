import * as z from 'zod/mini'
import { InteractionEventProperties } from '../../experience/event'

/**
 * Zod schema describing a `component_hover` event used for entry hover tracking.
 *
 * @remarks
 * These events track hover interactions for entries within an optimized
 * experience.
 *
 * Extends {@link InteractionEventProperties}.
 *
 * @public
 */
export const HoverEvent = z.extend(InteractionEventProperties, {
  /**
   * Discriminator indicating that this is an entry hover event.
   */
  type: z.literal('component_hover'),
  /**
   * Monotonically increasing hover duration for the active hover.
   *
   * @remarks
   * This value is updated and re-emitted while the same hover remains active.
   */
  hoverDurationMs: z.number(),
  /**
   * UUID identifying a single active hover session.
   *
   * @remarks
   * Multiple events emitted for the same active hover share this identifier.
   */
  hoverId: z.string(),
})

/**
 * TypeScript type inferred from {@link HoverEvent}.
 *
 * @public
 */
export type HoverEvent = z.infer<typeof HoverEvent>
