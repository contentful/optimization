import { json, record, string, type infer as zInfer } from 'zod/mini'

export const Traits = record(string(), json())
export type TraitsType = zInfer<typeof Traits>
