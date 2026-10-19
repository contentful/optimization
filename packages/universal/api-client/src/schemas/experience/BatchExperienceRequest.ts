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
   * Batch experience events for the Experience API to evaluate.
   *
   * @remarks
   * Must contain at least one event.
   */
  events: BatchExperienceEventArray.check(z.minLength(1)),

  /**
   * Optional feature configuration. Batch locations belong in each event's `context.location`.
   */
  options: z.optional(z.omit(ExperienceRequestOptions, { location: true })),
})

/**
 * TypeScript type inferred from {@link BatchExperienceRequestData}.
 */
export type BatchExperienceRequestData = z.infer<typeof BatchExperienceRequestData>
