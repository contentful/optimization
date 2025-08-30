import { json, record, string, type infer as zInfer } from 'zod/mini'

export const Properties = record(string(), json())
export type PropertiesType = zInfer<typeof Properties>
