import { array, discriminatedUnion, type infer as zInfer } from 'zod/mini'
import { ComponentViewEvent } from '../../../experience/dto/event'

export const Event = discriminatedUnion('type', [ComponentViewEvent])
export type Event = zInfer<typeof Event>

export const EventArray = array(Event)
export type EventArray = zInfer<typeof EventArray>
