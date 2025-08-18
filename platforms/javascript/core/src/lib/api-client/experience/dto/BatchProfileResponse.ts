import { array, extend, type infer as zInfer, optional, object } from 'zod/mini'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

export const BatchProfileData = object({ profiles: optional(array(Profile)) })
export type BatchProfileData = zInfer<typeof BatchProfileData>

export const BatchProfileResponse = extend(ResponseEnvelope, { data: BatchProfileData })
export type BatchProfileResponse = zInfer<typeof BatchProfileResponse>
