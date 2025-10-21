import * as z from 'zod/mini'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

export const BatchExperienceData = z.object({ profiles: z.optional(z.array(Profile)) })
export type BatchExperienceData = z.infer<typeof BatchExperienceData>

export const BatchExperienceResponse = z.extend(ResponseEnvelope, { data: BatchExperienceData })
export type BatchExperienceResponse = z.infer<typeof BatchExperienceResponse>
