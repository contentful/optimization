import { array, minLength, object, optional, string, type infer as zInfer } from 'zod/mini'
import { EventArray } from './event'

export const ExperienceRequestOptions = object({
  features: optional(array(string())),
})
export type ExperienceRequestOptionsType = zInfer<typeof ExperienceRequestOptions>

export const ExperienceRequestData = object({
  events: EventArray.check(minLength(1)),
  options: optional(ExperienceRequestOptions),
})
export type ExperienceRequestDataType = zInfer<typeof ExperienceRequestData>
