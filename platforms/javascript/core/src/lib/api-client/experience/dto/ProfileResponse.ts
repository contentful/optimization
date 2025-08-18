import { array, extend, object, type infer as zInfer } from 'zod/mini'
import { Change } from './change'
import { Experience } from './experience'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

export const ProfileData = object({
  profile: Profile,
  experiences: array(Experience),
  changes: array(Change),
})
export type ProfileData = zInfer<typeof ProfileData>

export const ProfileResponse = extend(ResponseEnvelope, { data: ProfileData })
export type ProfileResponse = zInfer<typeof ProfileResponse>
