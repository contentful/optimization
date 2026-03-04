import * as z from 'zod/mini'
import { BatchExperienceEventArray } from './event'
import { ExperienceRequestOptions } from './ExperienceRequest'

/**
 * Zod schema describing the data payload for a batch experience request.
 *
 * @remarks
 * Batch events require an `anonymousId` on each event and must contain at
 * least one event.
 */
export const BatchExperienceRequestData = z.object({
  /**
   * Batch experience events that should be evaluated by the Experience API.
   *
   * @remarks
   * Must contain at least one event.
   */
  events: BatchExperienceEventArray.check(z.minLength(1)),

  /**
   * Optional configuration for this experience request.
   */
  options: z.optional(ExperienceRequestOptions),
})

/**
 * TypeScript type inferred from {@link BatchExperienceRequestData}.
 */
export type BatchExperienceRequestData = z.infer<typeof BatchExperienceRequestData>
