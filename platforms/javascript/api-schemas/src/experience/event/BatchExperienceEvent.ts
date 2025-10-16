import { z } from 'zod/mini'
import { AliasEvent } from './AliasEvent'
import { ComponentViewEvent } from './ComponentViewEvent'
import { GroupEvent } from './GroupEvent'
import { IdentifyEvent } from './IdentifyEvent'
import { PageViewEvent } from './PageViewEvent'
import { ScreenEvent } from './ScreenEvent'
import { TrackEvent } from './TrackEvent'

const Anon = { anonymousId: z.string() }

export const BatchExperienceEvent = z.discriminatedUnion('type', [
  z.extend(AliasEvent, Anon),
  z.extend(ComponentViewEvent, Anon),
  z.extend(GroupEvent, Anon),
  z.extend(IdentifyEvent, Anon),
  z.extend(PageViewEvent, Anon),
  z.extend(ScreenEvent, Anon),
  z.extend(TrackEvent, Anon),
])
export type BatchExperienceEvent = z.infer<typeof BatchExperienceEvent>

export const BatchExperienceEventArray = z.array(BatchExperienceEvent)
export type BatchExperienceEventArray = z.infer<typeof BatchExperienceEventArray>
