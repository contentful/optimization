import { catchall, json, object, optional, string, type infer as zInfer } from 'zod/mini'
import { Query } from './Query'

export const PageView = catchall(
  object({
    path: string(),
    query: Query,
    referrer: string(),
    search: string(),
    title: string(),
    url: string(),
    category: optional(string()),
  }),
  json(),
)

export type PageView = zInfer<typeof PageView>
