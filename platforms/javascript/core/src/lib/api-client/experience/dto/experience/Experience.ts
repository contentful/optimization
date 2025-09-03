import {
  array,
  boolean,
  number,
  object,
  optional,
  prefault,
  record,
  string,
  type infer as zInfer,
} from 'zod/mini'

export const Experience = object({
  experienceId: string(),
  variantIndex: number(),
  variants: record(string(), string()),
  sticky: optional(prefault(boolean(), false)),
})
export type Experience = zInfer<typeof Experience>

export const ExperienceArray = array(Experience)
export type ExperienceArray = zInfer<typeof ExperienceArray>
