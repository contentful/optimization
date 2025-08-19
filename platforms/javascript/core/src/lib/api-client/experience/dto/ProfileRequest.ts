import { array, minLength, object, optional, string, type infer as zInfer } from 'zod/mini'
import { EventArray } from './event'

export const ProfileRequestOptions = object({
  features: optional(array(string())),
})
export type ProfileRequestOptions = zInfer<typeof ProfileRequestOptions>

export const ProfileRequestData = object({
  events: EventArray.check(minLength(1)),
  options: optional(ProfileRequestOptions),
})
export type ProfileRequestData = zInfer<typeof ProfileRequestData>
