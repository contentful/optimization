import { z } from 'zod/mini'
import { Query } from './Query'

export const Page = z.object({
  category: z.optional(z.string()),
  path: z.string(),
  query: Query,
  referrer: z.string(),
  search: z.string(),
  title: z.string(),
  url: z.string(),
})
export type Page = z.infer<typeof Page>
