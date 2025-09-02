import {
  array,
  boolean,
  discriminatedUnion,
  enum as zEnum,
  extend,
  json,
  literal,
  number,
  object,
  record,
  string,
  type infer as zInfer,
  union,
  nullable,
} from 'zod/mini'

export const ChangeType = ['Variable'] as const

const ChangeBase = object({
  key: string(),
  type: union([zEnum(ChangeType), string()]),
  meta: object({
    experienceId: string(),
    variantIndex: number(),
  }),
})

export const VariableChangeValue = nullable(
  union([string(), boolean(), number(), record(string(), json())]),
)

const UnknownChange = extend(ChangeBase, {
  type: string(),
  value: VariableChangeValue,
})

export const VariableChange = extend(ChangeBase, {
  type: literal('Variable'),
  value: VariableChangeValue,
})
export type VariableChange = zInfer<typeof VariableChange>

export type Json = zInfer<typeof json>
export type Flags = Record<string, Json>

export const Change = discriminatedUnion('type', [VariableChange, UnknownChange])
export type Change = zInfer<typeof Change>

export const ChangeArray = array(Change)
export type ChangeArray = zInfer<typeof ChangeArray>
