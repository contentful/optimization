import { object, string, type infer as zInfer } from 'zod/mini'
import { Query } from './Query'

export const Page = object({
  path: string(),
  query: Query,
  referrer: string(),
  search: string(),
  url: string(),
})
export type Page = zInfer<typeof Page>
