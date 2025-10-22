import * as z from 'zod/mini'

export const Campaign = z.object({
  name: z.optional(z.string()),
  source: z.optional(z.string()),
  medium: z.optional(z.string()),
  term: z.optional(z.string()),
  content: z.optional(z.string()),
})
export type Campaign = z.infer<typeof Campaign>
