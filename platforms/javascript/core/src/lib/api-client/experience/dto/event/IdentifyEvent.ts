import { extend, literal, type infer as zInfer } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Traits } from './properties/Traits'

export const IdentifyEvent = extend(UniversalEventProperties, {
  type: literal('identify'),
  traits: Traits,
})
export type IdentifyEventType = zInfer<typeof IdentifyEvent>
