import { json, record, string, type infer as zInfer } from 'zod/mini'

export const Properties = record(string(), json())
export type Properties = zInfer<typeof Properties>
