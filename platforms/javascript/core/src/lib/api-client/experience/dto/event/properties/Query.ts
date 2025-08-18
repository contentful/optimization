import { record, string, type infer as zInfer } from 'zod/mini'

export const Query = record(string(), string())
export type Query = zInfer<typeof Query>
