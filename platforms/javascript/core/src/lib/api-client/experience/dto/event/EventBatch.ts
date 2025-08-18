import { array, object, type infer as zInfer } from 'zod/mini'
import { Profile } from '../profile'
import { EventArray } from './Event'

export const EventBatch = object({
  profile: Profile,
  events: EventArray,
})
export type EventBatch = zInfer<typeof EventBatch>

export const EventBatchArray = array(EventBatch)
export type EventBatchArray = zInfer<typeof EventBatchArray>
