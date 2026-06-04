import type {
  ExperienceEventType,
  InsightsEventType,
} from '@contentful/optimization-api-client/api-schemas'

/**
 * Union of all event type keys that Optimization Core can emit.
 *
 * @public
 */
export type EventType = InsightsEventType | ExperienceEventType

/**
 * Default Core event types allowed before event consent is granted.
 *
 * @remarks
 * Core fails closed by default. Runtime SDKs set their own defaults for the
 * event types valid in that runtime.
 *
 * @public
 */
export const DEFAULT_ALLOWED_EVENT_TYPES: EventType[] = []
