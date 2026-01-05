import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Properties } from './properties'

/**
 * Zod schema describing a custom `track` event.
 *
 * @remarks
 * Track events capture arbitrary user actions that do not fit into
 * the more specific event types (page, screen, identify, etc.).
 *
 * Extends {@link UniversalEventProperties}.
 */
export const TrackEvent = z.extend(UniversalEventProperties, {
  /**
   * Discriminator indicating that this event is a track event.
   */
  type: z.literal('track'),

  /**
   * Name of the event being tracked.
   */
  event: z.string(),

  /**
   * Additional properties describing the event.
   */
  properties: Properties,
})

/**
 * TypeScript type inferred from {@link TrackEvent}.
 */
export type TrackEvent = z.infer<typeof TrackEvent>
