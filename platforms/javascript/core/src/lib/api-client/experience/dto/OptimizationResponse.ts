import { extend, object, type infer as zInfer } from 'zod/mini'
import { ChangeArray } from './change'
import { ExperienceArray } from './experience'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

export const OptimizationData = object({
  profile: Profile,
  experiences: ExperienceArray,
  changes: ChangeArray,
})
export type OptimizationDataType = zInfer<typeof OptimizationData>

export const OptimizationResponse = extend(ResponseEnvelope, { data: OptimizationData })
export type OptimizationResponseType = zInfer<typeof OptimizationResponse>
