import * as z from 'zod/mini'
import { ExperienceEventArray } from './event'
import { GeoLocation } from './event/properties/GeoLocation'

/**
 * Zod schema describing optional configuration for an experience request.
 *
 * @remarks
 * These options configure feature flags and the request location default when
 * evaluating experiences through singular profile requests.
 *
 * @public
 */
export const ExperienceRequestOptions = z.object({
  /**
   * Features or capabilities to enable for this request.
   */
  features: z.optional(z.array(z.string())),

  /**
   * Location default for singular profile requests. Event `context.location` fields override it.
   */
  location: z.optional(GeoLocation),
})

/**
 * TypeScript type inferred from {@link ExperienceRequestOptions}.
 *
 * @public
 */
export type ExperienceRequestOptions = z.infer<typeof ExperienceRequestOptions>

/**
 * Zod schema describing the data payload for an experience request.
 *
 * @remarks
 * Contains the list of events to be evaluated plus optional request
 * configuration.
 *
 * @public
 */
export const ExperienceRequestData = z.object({
  /**
   * Experience events for the Experience API to evaluate.
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
 *
 * @public
 */
export type ExperienceRequestData = z.infer<typeof ExperienceRequestData>
