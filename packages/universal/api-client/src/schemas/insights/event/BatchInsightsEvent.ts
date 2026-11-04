import * as z from 'zod/mini'
import { Profile } from '../../experience/profile'
import { InsightsEventArray } from './InsightsEvent'

/**
 * Zod schema describing a batched Insights event payload.
 *
 * @remarks
 * Combines a {@link Profile} with one or more Insights events
 * to be sent to the Contentful Insights API.
 *
 * @public
 */
export const BatchInsightsEvent = z.object({
  /**
   * Complete profile snapshot used to associate events with a user.
   *
   * @see {@link Profile}
   */
  profile: Profile,

  /**
   * Insights events to record for this profile.
   *
   * @see {@link InsightsEventArray}
   */
  events: InsightsEventArray,
})

/**
 * TypeScript type inferred from {@link BatchInsightsEvent}.
 *
 * @public
 */
export type BatchInsightsEvent = z.infer<typeof BatchInsightsEvent>

/**
 * Zod schema describing an array of {@link BatchInsightsEvent} items.
 *
 * @remarks
 * Useful when sending multiple profile/event batches in a single request.
 *
 * @public
 */
export const BatchInsightsEventArray = z.array(BatchInsightsEvent)

/**
 * TypeScript type inferred from {@link BatchInsightsEventArray}.
 *
 * @public
 */
export type BatchInsightsEventArray = z.infer<typeof BatchInsightsEventArray>
