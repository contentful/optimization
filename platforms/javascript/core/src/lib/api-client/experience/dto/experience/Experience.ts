import { boolean, number, object, prefault, record, string, type infer as zInfer } from 'zod/mini'

export const Experience = object({
  experienceId: string(),
  variantIndex: number(),
  variants: record(string(), string()),
  sticky: prefault(boolean(), false),
})
export type Experience = zInfer<typeof Experience>
