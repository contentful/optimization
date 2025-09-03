import { array, discriminatedUnion, type infer as zInfer } from 'zod/mini'
import { AliasEvent } from './AliasEvent'
import { ComponentViewEvent } from './ComponentViewEvent'
import { GroupEvent } from './GroupEvent'
import { IdentifyEvent } from './IdentifyEvent'
import { PageViewEvent } from './PageViewEvent'
import { ScreenEvent } from './ScreenEvent'
import { TrackEvent } from './TrackEvent'

export const ExperienceEvent = discriminatedUnion('type', [
  AliasEvent,
  ComponentViewEvent,
  GroupEvent,
  IdentifyEvent,
  PageViewEvent,
  ScreenEvent,
  TrackEvent,
])
export type ExperienceEvent = zInfer<typeof ExperienceEvent>

export const ExperienceEventArray = array(ExperienceEvent)
export type ExperienceEventArray = zInfer<typeof ExperienceEventArray>
