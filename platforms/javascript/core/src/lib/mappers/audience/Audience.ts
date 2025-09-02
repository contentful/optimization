import { object, string, optional, type infer as zInfer, prefault } from 'zod/mini'

export const Audience = object({
  id: string(),

  name: optional(prefault(string(), '')),

  description: optional(prefault(string(), '')),
})
export type AudienceType = zInfer<typeof Audience>
