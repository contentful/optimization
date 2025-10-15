import { z } from 'zod/mini'
import { ExperienceEventArray } from './event'

export const ExperienceRequestOptions = z.object({
  features: z.optional(z.array(z.string())),
})
export type ExperienceRequestOptions = z.infer<typeof ExperienceRequestOptions>

export const ExperienceRequestData = z.object({
  events: ExperienceEventArray.check(z.minLength(1)),
  options: z.optional(ExperienceRequestOptions),
})
export type ExperienceRequestData = z.infer<typeof ExperienceRequestData>
