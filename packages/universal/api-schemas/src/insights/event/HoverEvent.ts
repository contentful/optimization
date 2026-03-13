import * as z from 'zod/mini'
import { InteractionEventProperties } from '../../experience/event'

/**
 * Zod schema describing a `component_hover` event.
 *
 * @remarks
 * Component hover events track hover interactions for individual components
 * such as entries or variables within a personalized experience.
 *
 * Extends {@link InteractionEventProperties}.
 *
 * @public
 */
export const HoverEvent = z.extend(InteractionEventProperties, {
  /**
   * Discriminator indicating that this event is a component hover.
   */
  type: z.literal('component_hover'),
  /**
   * Monotonically increasing hover duration for the active component hover.
   *
   * @remarks
   * This value is updated and re-emitted while the same hover remains active.
   */
  hoverDurationMs: z.number(),
  /**
   * UUID identifying a single active component hover session.
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
