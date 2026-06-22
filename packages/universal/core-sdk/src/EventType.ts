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
 * Event admission selectors accepted by `allowedEventTypes`.
 *
 * @remarks
 * `EventType` values are API wire event types. Additional selector values,
 * such as `flag`, narrow consent admission without changing emitted payloads.
 *
 * @public
 */
export type AllowedEventType = EventType | 'flag'

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
