import { z } from 'zod/mini'
import { Audience } from '../audience'
import {
  Entry,
  EntryReplacementVariant,
  InlineVariableComponent,
  OptimizationEntryType,
} from '../entry'

export const Distribution = z.object({
  index: z.number(),
  start: z.number(),
  end: z.number(),
})
export type Distribution = z.infer<typeof Distribution>

export const EntryVariantComponent = z.object({
  type: z.optional(z.literal('EntryVariant')),
  baseline: EntryReplacementVariant,
  variants: z.array(Entry),
})
export type EntryVariantComponent = z.infer<typeof EntryVariantComponent>

export function isEntryVariantComponent(
  component: OptimizationConfigComponent,
): component is EntryVariantComponent {
  return component.type === 'EntryVariant' || component.type === undefined
}

export const OptimizationConfigComponent = z.union([EntryVariantComponent, InlineVariableComponent])
export type OptimizationConfigComponent = z.infer<typeof OptimizationConfigComponent>

export const OptimizationConfig = z.object({
  id: z.string(),
  type: OptimizationEntryType,
  name: z.optional(z.string()),
  description: z.optional(z.string()),
  audience: z.optional(Audience),
  trafficAllocation: z.number(),
  distribution: z.array(Distribution),
  sticky: z.optional(z.boolean()),
  components: z.array(OptimizationConfigComponent),
})
export type OptimizationConfig = z.infer<typeof OptimizationConfig>
