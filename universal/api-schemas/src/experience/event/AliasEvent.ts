import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

/**
 * Zod schema describing an `alias` event.
 *
 * @remarks
 * Currently unused.
 *
 * Alias events are typically used to associate multiple identifiers
 * (for example, anonymous and authenticated IDs) with the same user.
 *
 * Extends {@link UniversalEventProperties} with a fixed `type` field.
 */
export const AliasEvent = z.extend(UniversalEventProperties, {
  /**
   * Discriminator indicating that this event is an alias event.
   */
  type: z.literal('alias'),
})

/**
 * TypeScript type inferred from {@link AliasEvent}.
 */
export type AliasEvent = z.infer<typeof AliasEvent>
