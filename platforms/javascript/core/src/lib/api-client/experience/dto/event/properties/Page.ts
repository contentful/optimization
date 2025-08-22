import { object, optional, string, type infer as zInfer } from 'zod/mini'
import { Query } from './Query'

export const Page = object({
  category: optional(string()),
  path: string(),
  query: Query,
  referrer: string(),
  search: string(),
  url: string(),
})
export type PageType = zInfer<typeof Page>
