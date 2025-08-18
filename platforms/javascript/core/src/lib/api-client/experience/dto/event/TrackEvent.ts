import { extend, json, literal, record, string, type infer as zInfer } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

export const TrackEvent = extend(UniversalEventProperties, {
  type: literal('track'),
  event: string(),
  properties: record(string(), json()),
})
export type TrackEvent = zInfer<typeof TrackEvent>
