import { extend, object, type infer as zInfer } from 'zod/mini'
import { ChangeArray } from './change'
import { ExperienceArray } from './experience'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

export const ProfileData = object({
  profile: Profile,
  experiences: ExperienceArray,
  changes: ChangeArray,
})
export type ProfileData = zInfer<typeof ProfileData>

export const ProfileResponse = extend(ResponseEnvelope, { data: ProfileData })
export type ProfileResponse = zInfer<typeof ProfileResponse>
