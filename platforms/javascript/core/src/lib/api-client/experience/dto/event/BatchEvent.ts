import { array, discriminatedUnion, extend, string, type infer as zInfer } from 'zod/mini'
import { AliasEvent } from './AliasEvent'
import { ComponentViewEvent } from './ComponentViewEvent'
import { GroupEvent } from './GroupEvent'
import { IdentifyEvent } from './IdentifyEvent'
import { PageViewEvent } from './PageViewEvent'
import { ScreenEvent } from './ScreenEvent'
import { TrackEvent } from './TrackEvent'

export const BatchEvent = discriminatedUnion('type', [
  extend(AliasEvent, { anonymousId: string() }),
  extend(ComponentViewEvent, { anonymousId: string() }),
  extend(GroupEvent, { anonymousId: string() }),
  extend(IdentifyEvent, { anonymousId: string() }),
  extend(PageViewEvent, { anonymousId: string() }),
  extend(ScreenEvent, { anonymousId: string() }),
  extend(TrackEvent, { anonymousId: string() }),
])
export type BatchEvent = zInfer<typeof BatchEvent>

export const BatchEventArray = array(BatchEvent)
export type BatchEventArray = zInfer<typeof BatchEventArray>
