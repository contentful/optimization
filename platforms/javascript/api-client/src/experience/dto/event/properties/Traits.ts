import { z } from 'zod/mini'

export const Traits = z.record(z.string(), z.json())
export type Traits = z.infer<typeof Traits>
