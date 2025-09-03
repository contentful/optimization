import { extend, literal, type infer as zInfer } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

export const AliasEvent = extend(UniversalEventProperties, {
  type: literal('alias'),
})
export type AliasEvent = zInfer<typeof AliasEvent>
