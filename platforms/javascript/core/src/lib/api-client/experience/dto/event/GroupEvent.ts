import { extend, literal, type infer as zInfer } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

export const GroupEvent = extend(UniversalEventProperties, {
  type: literal('group'),
})
export type GroupEvent = zInfer<typeof GroupEvent>
