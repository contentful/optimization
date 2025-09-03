import { array, minLength, object, optional, string, type infer as zInfer } from 'zod/mini'
import { ExperienceEventArray } from './event'

export const ExperienceRequestOptions = object({
  features: optional(array(string())),
})
export type ExperienceRequestOptions = zInfer<typeof ExperienceRequestOptions>

export const ExperienceRequestData = object({
  events: ExperienceEventArray.check(minLength(1)),
  options: optional(ExperienceRequestOptions),
})
export type ExperienceRequestData = zInfer<typeof ExperienceRequestData>
