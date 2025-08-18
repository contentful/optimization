import { array, discriminatedUnion, type infer as zInfer } from 'zod/mini'
import { ComponentViewEvent } from './ComponentViewEvent'
import { AliasEvent } from './AliasEvent'
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
export type Event = zInfer<typeof Event>

export const EventArray = array(Event)
export type EventArray = zInfer<typeof EventArray>
