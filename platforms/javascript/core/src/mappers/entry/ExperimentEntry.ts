import { z } from 'zod/mini'
import { OptimizationEntry } from './OptimizationEntry'

export const ExperimentEntry = z.extend(OptimizationEntry, {
  nt_type: z.literal('nt_experiment'),
})
export type ExperimentEntry = z.infer<typeof ExperimentEntry>
