import * as z from 'zod/mini'
import { AliasEvent } from './AliasEvent'
import { ComponentViewEvent } from './ComponentViewEvent'
import { GroupEvent } from './GroupEvent'
import { IdentifyEvent } from './IdentifyEvent'
import { PageViewEvent } from './PageViewEvent'
import { ScreenViewEvent } from './ScreenViewEvent'
import { TrackEvent } from './TrackEvent'

/**
 * Zod schema describing any supported experience/personalization event.
 *
 * @remarks
 * This discriminated union aggregates all event types used by the
 * personalization/experience tracking system.
 */
export const ExperienceEvent = z.discriminatedUnion('type', [
  AliasEvent,
  ComponentViewEvent,
  GroupEvent,
  IdentifyEvent,
  PageViewEvent,
  ScreenViewEvent,
  TrackEvent,
])

/**
 * TypeScript type inferred from {@link ExperienceEvent}.
 */
export type ExperienceEvent = z.infer<typeof ExperienceEvent>

/**
 * Union of all possible `type` values for {@link ExperienceEvent}.
 */
export type ExperienceEventType = ExperienceEvent['type']

/**
 * Zod schema describing an array of {@link ExperienceEvent} items.
 */
export const ExperienceEventArray = z.array(ExperienceEvent)

/**
 * TypeScript type inferred from {@link ExperienceEventArray}.
 */
export type ExperienceEventArray = z.infer<typeof ExperienceEventArray>
