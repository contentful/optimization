import { z } from 'zod/mini'
import { AliasEvent } from './AliasEvent'
import { ComponentViewEvent } from './ComponentViewEvent'
import { GroupEvent } from './GroupEvent'
import { IdentifyEvent } from './IdentifyEvent'
import { PageViewEvent } from './PageViewEvent'
import { ScreenEvent } from './ScreenEvent'
import { TrackEvent } from './TrackEvent'

export const ExperienceEvent = z.discriminatedUnion('type', [
  AliasEvent,
  ComponentViewEvent,
  GroupEvent,
  IdentifyEvent,
  PageViewEvent,
  ScreenEvent,
  TrackEvent,
])
export type ExperienceEvent = z.infer<typeof ExperienceEvent>

export const ExperienceEventArray = z.array(ExperienceEvent)
export type ExperienceEventArray = z.infer<typeof ExperienceEventArray>
