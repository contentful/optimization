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
} from 'zod/mini'

export const ChangeType = ['Variable'] as const

const ChangeBase = object({
  key: string(),
  type: zEnum(ChangeType),
  meta: object({
    experienceId: string(),
    variantIndex: number(),
  }),
})

export const VariableChangeTypeSchema = union([
  string(),
  boolean(),
  number(),
  record(string(), json()),
])

export const VariableChange = extend(ChangeBase, {
  type: literal('Variable'),
  value: VariableChangeTypeSchema,
})

export const Change = discriminatedUnion('type', [VariableChange])
export type Change = zInfer<typeof Change>

export const ChangeArray = array(Change)
export type ChangeArray = zInfer<typeof ChangeArray>
