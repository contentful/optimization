import * as z from 'zod/mini'
import { ExperienceEventArray } from './event'

/**
 * Zod schema describing optional configuration for an experience request.
 *
 * @remarks
 * These options can be used to enable or filter specific features when
 * evaluating experiences.
 */
export const ExperienceRequestOptions = z.object({
  /**
   * Features or capabilities to enable for this request.
   */
  features: z.optional(z.array(z.string())),
})

/**
 * TypeScript type inferred from {@link ExperienceRequestOptions}.
 */
export type ExperienceRequestOptions = z.infer<typeof ExperienceRequestOptions>

/**
 * Zod schema describing the data payload for an experience request.
 *
 * @remarks
 * Contains the list of events to be evaluated plus optional request
 * configuration.
 */
export const ExperienceRequestData = z.object({
  /**
   * Experience events that should be evaluated by the Experience API.
   *
   * @remarks
   * Must contain at least one event.
   */
  events: ExperienceEventArray.check(z.minLength(1)),

  /**
   * Optional configuration for this experience request.
   */
  options: z.optional(ExperienceRequestOptions),
})

/**
 * TypeScript type inferred from {@link ExperienceRequestData}.
 */
export type ExperienceRequestData = z.infer<typeof ExperienceRequestData>
