import { z } from 'zod/mini'
import { Query } from './Query'

export const Page = z.catchall(
  z.object({
    path: z.string(),
    query: Query,
    referrer: z.string(),
    search: z.string(),
    title: z.optional(z.string()),
    url: z.string(),
  }),
  z.json(),
)
export type Page = z.infer<typeof Page>
