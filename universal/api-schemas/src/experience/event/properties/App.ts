import * as z from 'zod/mini'

export const App = z.optional(
  z.object({
    name: z.string(),
    version: z.string(),
  }),
)

export type App = z.infer<typeof App>
