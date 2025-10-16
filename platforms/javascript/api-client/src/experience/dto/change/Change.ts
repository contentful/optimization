import { z } from 'zod/mini'

export const ChangeType = ['Variable'] as const

const ChangeBase = z.object({
  key: z.string(),
  type: z.union([z.enum(ChangeType), z.string()]),
  meta: z.object({
    experienceId: z.string(),
    variantIndex: z.number(),
  }),
})

export const VariableChangeValue = z.union([
  z.string(),
  z.boolean(),
  z.null(),
  z.number(),
  z.record(z.string(), z.json()),
])

export const UnknownChange = z.extend(ChangeBase, {
  type: z.string(),
  value: z.unknown(),
})
export type UnknownChange = z.infer<typeof UnknownChange>

export const VariableChange = z.extend(ChangeBase, {
  type: z.literal('Variable'),
  value: VariableChangeValue,
})
export type VariableChange = z.infer<typeof VariableChange>

export type Json = z.infer<typeof z.json>
export type Flags = Record<string, Json>

export const Change = z.discriminatedUnion('type', [VariableChange])
export type Change = z.infer<typeof Change>

export const ChangeArray = z.array(Change)
export type ChangeArray = z.infer<typeof ChangeArray>
