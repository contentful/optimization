import { array, extend, type infer as zInfer, optional, object } from 'zod/mini'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

export const BatchExperienceData = object({ profiles: optional(array(Profile)) })
export type BatchExperienceData = zInfer<typeof BatchExperienceData>

export const BatchExperienceResponse = extend(ResponseEnvelope, { data: BatchExperienceData })
export type BatchExperienceResponse = zInfer<typeof BatchExperienceResponse>
