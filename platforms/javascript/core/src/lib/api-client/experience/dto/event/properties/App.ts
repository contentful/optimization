import { optional, object, string, type infer as zInfer } from 'zod/mini'

export const App = optional(
  object({
    name: string(),
    version: string(),
  }),
)

export type AppType = zInfer<typeof App>
