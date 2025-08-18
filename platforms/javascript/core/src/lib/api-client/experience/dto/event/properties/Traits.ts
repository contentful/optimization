import { json, type infer as zInfer } from 'zod/mini'

export const Traits = json()
export type Traits = zInfer<typeof Traits>
