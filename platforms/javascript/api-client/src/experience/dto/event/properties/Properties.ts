import { z } from 'zod/mini'

export const Properties = z.record(z.string(), z.json())
export type Properties = z.infer<typeof Properties>
