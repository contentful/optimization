import { array, discriminatedUnion, type infer as zInfer } from 'zod/mini'
import { AliasEvent } from './AliasEvent'
import { ComponentViewEvent } from './ComponentViewEvent'
import { GroupEvent } from './GroupEvent'
import { IdentifyEvent } from './IdentifyEvent'
import { PageViewEvent } from './PageViewEvent'
import { ScreenEvent } from './ScreenEvent'
import { TrackEvent } from './TrackEvent'

export const Event = discriminatedUnion('type', [
  AliasEvent,
  ComponentViewEvent,
  GroupEvent,
  IdentifyEvent,
  PageViewEvent,
  ScreenEvent,
  TrackEvent,
])
export type EventType = zInfer<typeof Event>

export const EventArray = array(Event)
export type EventArrayType = zInfer<typeof EventArray>
