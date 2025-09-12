import { z } from 'zod/mini'

export const Audience = z.object({
  id: z.string(),

  name: z.optional(z.prefault(z.string(), '')),

  description: z.optional(z.prefault(z.string(), '')),
})
export type Audience = z.infer<typeof Audience>
