import * as z from 'zod/mini'
import { PartialProfile } from '../../experience/profile'
import { InsightsEventArray } from './InsightsEvent'

/**
 * Zod schema describing a batched Insights event payload.
 *
 * @remarks
 * Combines a {@link PartialProfile} with one or more Insights events
 * to be sent to the Contentful Insights API.
 */
export const BatchInsightsEvent = z.object({
  /**
   * Partial profile information used to associate events with a user.
   *
   * @see PartialProfile
   */
  profile: PartialProfile,

  /**
   * Insights events that should be recorded for this profile.
   *
   * @see InsightsEventArray
   */
  events: InsightsEventArray,
})

/**
 * TypeScript type inferred from {@link BatchInsightsEvent}.
 */
export type BatchInsightsEvent = z.infer<typeof BatchInsightsEvent>

/**
 * Zod schema describing an array of {@link BatchInsightsEvent} items.
 *
 * @remarks
 * Useful when sending multiple profile/event batches in a single request.
 */
export const BatchInsightsEventArray = z.array(BatchInsightsEvent)

/**
 * TypeScript type inferred from {@link BatchInsightsEventArray}.
 */
export type BatchInsightsEventArray = z.infer<typeof BatchInsightsEventArray>
