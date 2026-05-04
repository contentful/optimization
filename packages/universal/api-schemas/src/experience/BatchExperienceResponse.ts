import * as z from 'zod/mini'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

/**
 * Zod schema describing the `data` property of a batch experience response.
 *
 * @remarks
 * A batch request can return zero or more profiles. When no profiles are
 * returned, `profiles` can be omitted or an empty array.
 *
 * @public
 */
export const BatchExperienceResponseData = z.object({
  /**
   * Profiles evaluated or affected by the batch experience request.
   */
  profiles: z.optional(z.array(Profile)),
})

/**
 * TypeScript type inferred from {@link BatchExperienceResponseData}.
 *
 * @public
 */
export type BatchExperienceResponseData = z.infer<typeof BatchExperienceResponseData>

/**
 * Zod schema describing a batch experience response from the Experience API.
 *
 * @remarks
 * Extends {@link ResponseEnvelope} with {@link BatchExperienceResponseData} as the
 * `data` payload.
 *
 * @public
 */
export const BatchExperienceResponse = z.extend(ResponseEnvelope, {
  data: BatchExperienceResponseData,
})

/**
 * TypeScript type inferred from {@link BatchExperienceResponse}.
 *
 * @public
 */
export type BatchExperienceResponse = z.infer<typeof BatchExperienceResponse>
