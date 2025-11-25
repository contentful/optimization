import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Traits } from './properties/Traits'

/**
 * Zod schema describing an `identify` event.
 *
 * @remarks
 * Identify events attach user traits to a known identity.
 *
 * Extends {@link UniversalEventProperties} with a `traits` payload.
 */
export const IdentifyEvent = z.extend(UniversalEventProperties, {
  /**
   * Discriminator indicating that this event is an identify event.
   */
  type: z.literal('identify'),

  /**
   * Traits describing the user.
   *
   * @see {@link Traits}
   */
  traits: Traits,
})

/**
 * TypeScript type inferred from {@link IdentifyEvent}.
 */
export type IdentifyEvent = z.infer<typeof IdentifyEvent>
