import { z } from 'zod/mini'
import { Audience } from '../audience'
import { OptimizationEntryConfigComponent, OptimizationEntryType } from '../entry'

export const Distribution = z.object({
  index: z.number(),
  start: z.number(),
  end: z.number(),
})
export type Distribution = z.infer<typeof Distribution>

export const OptimizationConfig = z.object({
  id: z.string(),
  type: OptimizationEntryType,
  name: z.optional(z.string()),
  description: z.optional(z.string()),
  audience: z.optional(Audience),
  trafficAllocation: z.number(),
  distribution: z.array(Distribution),
  sticky: z.optional(z.boolean()),
  components: z.array(OptimizationEntryConfigComponent),
})
export type OptimizationConfig = z.infer<typeof OptimizationConfig>
