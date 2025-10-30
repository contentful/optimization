import * as z from 'zod/mini'
import { Dictionary } from './Dictionary'

export const Page = z.catchall(
  z.object({
    path: z.string(),
    query: Dictionary,
    referrer: z.string(),
    search: z.string(),
    title: z.optional(z.string()),
    url: z.string(),
  }),
  z.json(),
)
export type Page = z.infer<typeof Page>
