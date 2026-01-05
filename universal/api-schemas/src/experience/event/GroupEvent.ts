import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

/**
 * Zod schema describing a `group` event.
 *
 * @remarks
 * Currently unused.
 *
 * Group events typically associate a user with an organization, account,
 * or other grouping construct.
 *
 * Extends {@link UniversalEventProperties}.
 */
export const GroupEvent = z.extend(UniversalEventProperties, {
  /**
   * Discriminator indicating that this event is a group event.
   */
  type: z.literal('group'),
})

/**
 * TypeScript type inferred from {@link GroupEvent}.
 */
export type GroupEvent = z.infer<typeof GroupEvent>
