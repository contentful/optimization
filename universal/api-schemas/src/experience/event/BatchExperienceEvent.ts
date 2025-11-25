import * as z from 'zod/mini'
import { AliasEvent } from './AliasEvent'
import { ComponentViewEvent } from './ComponentViewEvent'
import { GroupEvent } from './GroupEvent'
import { IdentifyEvent } from './IdentifyEvent'
import { PageViewEvent } from './PageViewEvent'
import { ScreenViewEvent } from './ScreenViewEvent'
import { TrackEvent } from './TrackEvent'

/**
 * Partial schema capturing an anonymous identifier.
 *
 * @remarks
 * This object is merged into each event type in a batch to associate the
 * event with an `anonymousId`.
 */
const Anon = { anonymousId: z.string() }

/**
 * Zod schema describing each valid experience/personalization event within a batch.
 *
 * @remarks
 * This is a discriminated union on the `type` field that supports all event
 * types used in batch ingestion, each extended with an `anonymousId`.
 */
export const BatchExperienceEvent = z.discriminatedUnion('type', [
  z.extend(AliasEvent, Anon),
  z.extend(ComponentViewEvent, Anon),
  z.extend(GroupEvent, Anon),
  z.extend(IdentifyEvent, Anon),
  z.extend(PageViewEvent, Anon),
  z.extend(ScreenViewEvent, Anon),
  z.extend(TrackEvent, Anon),
])

/**
 * TypeScript type inferred from {@link BatchExperienceEvent}.
 */
export type BatchExperienceEvent = z.infer<typeof BatchExperienceEvent>

/**
 * Zod schema describing an array of {@link BatchExperienceEvent} items.
 */
export const BatchExperienceEventArray = z.array(BatchExperienceEvent)

/**
 * TypeScript type inferred from {@link BatchExperienceEventArray}.
 */
export type BatchExperienceEventArray = z.infer<typeof BatchExperienceEventArray>
