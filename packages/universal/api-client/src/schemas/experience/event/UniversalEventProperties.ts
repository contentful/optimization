import * as z from 'zod/mini'
import { App, Campaign, Channel, GeoLocation, Library, Page, Screen } from './properties'

/**
 * Zod schema describing universal event context properties shared by all
 * analytics events.
 *
 * @remarks
 * The `page` and `screen` properties are optional, but we recommend omitting
 * them for event types that are not `page` or `screen`.
 *
 * @public
 */
export const UniversalEventContext = z.object({
  /**
   * Application-level metadata.
   */
  app: App,

  /**
   * Campaign attribution metadata.
   */
  campaign: Campaign,

  /**
   * GDPR-related consent information.
   *
   * @remarks
   * Optional and informational: the Experience and Insights APIs do not read it.
   * Consent is enforced by the SDK before events are sent.
   */
  gdpr: z.optional(
    z.object({
      /**
       * Indicates whether the user has given consent.
       */
      isConsentGiven: z.boolean(),
    }),
  ),

  /**
   * Analytics library metadata.
   */
  library: Library,

  /**
   * Locale identifier of the event (e.g., `"en-US"`).
   *
   * @defaultValue `"en-US"`
   */
  locale: z.optional(z.prefault(z.string(), 'en-US')),

  /**
   * Optional geo-location information associated with the event.
   */
  location: z.optional(GeoLocation),

  /**
   * User agent string of the client, if available.
   */
  userAgent: z.optional(z.string()),
})

/**
 * TypeScript type inferred from {@link UniversalEventContext}.
 *
 * @public
 */
export type UniversalEventContext = z.infer<typeof UniversalEventContext>

/**
 * Zod schema describing universal properties shared by all analytics events.
 *
 * @remarks
 * These properties capture common metadata such as channel, context,
 * timestamps, and user identifiers.
 *
 * @public
 */
export const UniversalEventProperties = z.object({
  /**
   * Channel from which the event originated.
   *
   * @see {@link Channel}
   */
  channel: Channel,

  /**
   * Context object carrying environment and client metadata.
   */
  context: z.extend(UniversalEventContext, {
    page: z.optional(Page),
    screen: z.optional(Screen),
  }),

  /**
   * Anonymous identifier of the visitor, if the caller supplies one.
   *
   * @remarks
   * Optional. The Experience API profile endpoints derive it from the request
   * route, and batch ingestion requires it (see {@link BatchExperienceEvent}).
   */
  anonymousId: z.optional(z.string()),

  /**
   * Unique identifier for this message.
   *
   * @remarks
   * Used to deduplicate events across retries and transports.
   */
  messageId: z.string(),

  /**
   * Timestamp when the event originally occurred.
   *
   * @remarks
   * Any date string the Experience API can parse; the SDK sends ISO 8601.
   */
  originalTimestamp: z.string(),

  /**
   * Timestamp when the event payload was sent.
   *
   * @remarks
   * Any date string the Experience API can parse; the SDK sends ISO 8601.
   */
  sentAt: z.string(),

  /**
   * Timestamp when the event was recorded or processed.
   *
   * @remarks
   * Any date string the Experience API can parse; the SDK sends ISO 8601.
   */
  timestamp: z.string(),

  /**
   * Identifier of the authenticated user, if known.
   */
  userId: z.optional(z.string()),
})

/**
 * TypeScript type inferred from {@link UniversalEventProperties}.
 *
 * @public
 */
export type UniversalEventProperties = z.infer<typeof UniversalEventProperties>
