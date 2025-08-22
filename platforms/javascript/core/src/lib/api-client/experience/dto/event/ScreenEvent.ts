import { extend, literal, type infer as zInfer } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

export const ScreenEvent = extend(UniversalEventProperties, {
  type: literal('screen'),
})
export type ScreenEventType = zInfer<typeof ScreenEvent>
