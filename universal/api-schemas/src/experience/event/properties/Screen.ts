import * as z from 'zod/mini'
import { Dictionary } from './Dictionary'

export const Screen = z.catchall(
  z.object({
    name: z.string(),
    facets: z.optional(Dictionary),
    route: z.optional(z.string()),
    title: z.optional(z.string()),
  }),
  z.json(),
)
export type Screen = z.infer<typeof Screen>
