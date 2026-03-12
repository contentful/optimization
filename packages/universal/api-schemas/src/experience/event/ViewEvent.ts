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
export const ViewEvent = z.extend(InteractionEventProperties, {
  /**
   * Discriminator indicating that this event is a component view.
   */
  type: z.literal('component'),
  /**
   * Monotonically increasing visible duration for the active component view.
   *
   * @remarks
   * This value is updated and re-emitted while the same view remains active.
   */
  viewDurationMs: z.number(),
  /**
   * UUID identifying a single active component view session.
   *
   * @remarks
   * Multiple events emitted for the same active view share this identifier.
   */
  viewId: z.string(),
})

/**
 * TypeScript type inferred from {@link ViewEvent}.
 *
 * @public
 */
export type ViewEvent = z.infer<typeof ViewEvent>
