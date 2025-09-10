import { z } from 'zod/mini'

export const EntryReplacementVariant = z.object({
  id: z.string(),
  hidden: z.prefault(z.boolean(), false),
})
export type EntryReplacementVariant = z.infer<typeof EntryReplacementVariant>

export const EntryReplacementComponent = z.object({
  type: z.optional(z.literal('EntryReplacement')),
  baseline: EntryReplacementVariant,
  variants: z.array(EntryReplacementVariant),
})
export type EntryReplacementComponent = z.infer<typeof EntryReplacementComponent>

export function isEntryReplacementComponent(
  component: OptimizationEntryConfigComponent,
): component is EntryReplacementComponent {
  return component.type === 'EntryReplacement' || component.type === undefined
}

export const InlineVariableVariant = z.object({
  value: z.union([z.string(), z.boolean(), z.null(), z.number(), z.record(z.string(), z.json())]),
})

export const InlineVariableComponentValueType = z.enum(['Boolean', 'Number', 'Object', 'String'])

export const InlineVariableComponent = z.object({
  type: z.literal('InlineVariable'),
  key: z.string(),
  valueType: InlineVariableComponentValueType,
  baseline: InlineVariableVariant,
  variants: z.array(InlineVariableVariant),
})
export type InlineVariableComponent = z.infer<typeof InlineVariableComponent>

export function isInlineVariableComponent(
  component: OptimizationEntryConfigComponent,
): component is InlineVariableComponent {
  return component.type === 'InlineVariable'
}

export const OptimizationEntryConfigComponent = z.discriminatedUnion('type', [
  EntryReplacementComponent,
  InlineVariableComponent,
])
export type OptimizationEntryConfigComponent = z.infer<typeof OptimizationEntryConfigComponent>

export const OptimizationEntryConfig = z.object({
  distribution: z.optional(z.prefault(z.array(z.number()), [0.5, 0.5])),
  traffic: z.optional(z.prefault(z.number(), 0)),
  components: z.optional(
    z.prefault(z.array(OptimizationEntryConfigComponent), [
      {
        type: 'EntryReplacement',
        baseline: { id: '' },
        variants: [{ id: '' }],
      },
    ]),
  ),
  sticky: z.optional(z.prefault(z.boolean(), false)),
})
export type OptimizationEntryConfig = z.infer<typeof OptimizationEntryConfig>
