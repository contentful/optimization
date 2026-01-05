import * as z from 'zod/mini'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

/**
 * Zod schema describing the `data` property of a batch experience response.
 *
 * @remarks
 * A batch request may return zero or more profiles. When no profiles are
 * returned, `profiles` may be omitted or an empty array.
 */
export const BatchExperienceData = z.object({
  /**
   * Profiles evaluated or affected by the batch experience request.
   */
  profiles: z.optional(z.array(Profile)),
})

/**
 * TypeScript type inferred from {@link BatchExperienceData}.
 */
export type BatchExperienceData = z.infer<typeof BatchExperienceData>

/**
 * Zod schema describing a batch experience response from the Experience API.
 *
 * @remarks
 * Extends {@link ResponseEnvelope} with {@link BatchExperienceData} as the
 * `data` payload.
 */
export const BatchExperienceResponse = z.extend(ResponseEnvelope, { data: BatchExperienceData })

/**
 * TypeScript type inferred from {@link BatchExperienceResponse}.
 */
export type BatchExperienceResponse = z.infer<typeof BatchExperienceResponse>
