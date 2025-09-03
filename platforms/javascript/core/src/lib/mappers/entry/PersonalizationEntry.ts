import { z } from 'zod/mini'
import { OptimizationEntry } from './OptimizationEntry'

export const PersonalizationEntry = z.extend(OptimizationEntry, {
  nt_type: z.literal('nt_personalization'),
})
export type PersonalizationEntry = z.infer<typeof PersonalizationEntry>
