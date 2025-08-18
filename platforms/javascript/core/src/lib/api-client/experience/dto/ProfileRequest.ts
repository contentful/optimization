import { array, minLength, object, optional, string, unknown, type infer as zInfer } from 'zod/mini'

export const ProfileRequestOptions = object({
  features: optional(array(string())),
})
export type ProfileRequestOptions = zInfer<typeof ProfileRequestOptions>

export const ProfileRequestData = object({
  events: array(unknown()).check(minLength(1)),
  options: optional(ProfileRequestOptions),
})
export type ProfileRequestData = zInfer<typeof ProfileRequestData>
