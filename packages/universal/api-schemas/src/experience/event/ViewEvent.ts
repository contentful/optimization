import * as z from 'zod/mini'
import { InteractionEventProperties } from './InteractionEventProperties'

/**
 * Zod schema describing a `component` view event used for entry and flag exposure tracking.
 *
 * @remarks
 * These events track exposure of entries and variable-backed optimization
 * targets within an optimized experience.
 *
 * Extends {@link InteractionEventProperties}.
 *
 * @public
 */
export const ViewEvent = z.extend(InteractionEventProperties, {
  /**
   * Discriminator indicating that this is an entry or flag view event.
   */
  type: z.literal('component'),
  /**
   * Monotonically increasing visible duration for the active view.
   *
   * @remarks
   * This value is updated and re-emitted while the same view remains active.
   */
  viewDurationMs: z.optional(z.number()),
  /**
   * UUID identifying a single active view session.
   *
   * @remarks
   * Multiple events emitted for the same active view share this identifier.
   */
  viewId: z.optional(z.string()),
})

/**
 * TypeScript type inferred from {@link ViewEvent}.
 *
 * @public
 */
export type ViewEvent = z.infer<typeof ViewEvent>
