import * as z from 'zod/mini'

export const Library = z.object({
  name: z.string(),
  version: z.string(),
})

export type Library = z.infer<typeof Library>
