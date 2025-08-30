import { extend, literal, string, type infer as zInfer } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Properties } from './properties'

export const TrackEvent = extend(UniversalEventProperties, {
  type: literal('track'),
  event: string(),
  properties: Properties,
})
export type TrackEventType = zInfer<typeof TrackEvent>
