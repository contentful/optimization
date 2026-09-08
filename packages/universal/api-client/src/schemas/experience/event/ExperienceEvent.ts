import * as z from 'zod/mini'
import { AliasEvent } from './AliasEvent'
import { GroupEvent } from './GroupEvent'
import { IdentifyEvent } from './IdentifyEvent'
import { PageViewEvent } from './PageViewEvent'
import { ScreenViewEvent } from './ScreenViewEvent'
import { TrackEvent } from './TrackEvent'
import { ViewEvent } from './ViewEvent'

/**
 * Zod schema describing any supported Experience API event.
 *
 * @remarks
 * This discriminated union aggregates all event types used by the
 * personalization/experience tracking system.
 *
 * @public
 */
export const ExperienceEvent = z.discriminatedUnion('type', [
  AliasEvent,
  ViewEvent,
  GroupEvent,
  IdentifyEvent,
  PageViewEvent,
  ScreenViewEvent,
  TrackEvent,
])

/**
 * TypeScript type inferred from {@link ExperienceEvent}.
 *
 * @public
 */
export type ExperienceEvent = z.infer<typeof ExperienceEvent>

/**
 * Union of all possible `type` values for {@link ExperienceEvent}.
 *
 * @public
 */
export type ExperienceEventType = ExperienceEvent['type']

/**
 * Zod schema describing an array of {@link ExperienceEvent} items.
 *
 * @public
 */
export const ExperienceEventArray = z.array(ExperienceEvent)

/**
 * TypeScript type inferred from {@link ExperienceEventArray}.
 *
 * @public
 */
export type ExperienceEventArray = z.infer<typeof ExperienceEventArray>
