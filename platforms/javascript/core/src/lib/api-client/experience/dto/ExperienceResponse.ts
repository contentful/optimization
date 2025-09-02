import { extend, object, type infer as zInfer } from 'zod/mini'
import { ChangeArray } from './change'
import { ExperienceArray, type ExperienceArrayType } from './experience'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

export const ExperienceData = object({
  profile: Profile,
  experiences: ExperienceArray,
  changes: ChangeArray,
})
export type ExperienceDataType = zInfer<typeof ExperienceData>

export const ExperienceResponse = extend(ResponseEnvelope, { data: ExperienceData })
export type ExperienceResponseType = zInfer<typeof ExperienceResponse>

/** This type is specifically for compatibility outside the API adapter */
export type OptimizationDataType = Omit<ExperienceDataType, 'experiences'> & {
  personalizations: ExperienceArrayType
}
