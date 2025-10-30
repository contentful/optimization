import * as z from 'zod/mini'

export const Dictionary = z.record(z.string(), z.string())
export type Dictionary = z.infer<typeof Dictionary>
