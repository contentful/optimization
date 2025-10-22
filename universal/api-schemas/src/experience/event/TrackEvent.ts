import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Properties } from './properties'

export const TrackEvent = z.extend(UniversalEventProperties, {
  type: z.literal('track'),
  event: z.string(),
  properties: Properties,
})
export type TrackEvent = z.infer<typeof TrackEvent>
