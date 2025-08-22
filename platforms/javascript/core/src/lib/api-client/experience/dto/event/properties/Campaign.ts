import { object, optional, string, type infer as zInfer } from 'zod/mini'

export const Campaign = object({
  name: optional(string()),
  source: optional(string()),
  medium: optional(string()),
  term: optional(string()),
  content: optional(string()),
})
export type CampaignType = zInfer<typeof Campaign>
