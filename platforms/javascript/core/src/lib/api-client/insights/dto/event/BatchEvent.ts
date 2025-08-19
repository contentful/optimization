import { array, object, type infer as zInfer } from 'zod/mini'
import { Profile } from '../../../experience/dto/profile'
import { EventArray } from './Event'

export const BatchEvent = object({
  profile: Profile,
  events: EventArray,
})
export type BatchEvent = zInfer<typeof BatchEvent>

export const BatchEventArray = array(BatchEvent)
export type BatchEventArray = zInfer<typeof BatchEventArray>
