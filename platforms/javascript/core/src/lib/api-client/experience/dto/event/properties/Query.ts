import { record, string, type infer as zInfer } from 'zod/mini'

export const Query = record(string(), string())
export type QueryType = zInfer<typeof Query>
