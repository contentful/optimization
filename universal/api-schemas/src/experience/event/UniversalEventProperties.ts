import * as z from 'zod/mini'
import { App, Campaign, Channel, GeoLocation, Library, Page } from './properties'

/**
 * Zod schema describing universal properties shared by all analytics events.
 *
 * @remarks
 * These properties capture common metadata such as channel, context,
 * timestamps, and user identifiers.
 */
export const UniversalEventProperties = z.object({
  /**
   * Channel from which the event originated.
   *
   * @see Channel
   */
  channel: Channel,

  /**
   * Context object carrying environment and client metadata.
   */
  context: z.object({
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
     */
    gdpr: z.object({
      /**
       * Indicates whether the user has given consent.
       */
      isConsentGiven: z.boolean(),
    }),

    /**
     * Analytics library metadata.
     */
    library: Library,

    /**
     * Locale identifier of the event (e.g., `"en-US"`).
     */
    locale: z.string(),

    /**
     * Optional geo-location information associated with the event.
     */
    location: z.optional(GeoLocation),

    /**
     * Page context for events that occur within a web page.
     *
     * @remarks
     * May be populated even for events that are not explicitly page views.
     *
     * @privateRemarks
     * This may be removed from the APIs and the SDKs in the near future.
     */
    page: Page,

    /**
     * User agent string of the client, if available.
     */
    userAgent: z.optional(z.string()),
  }),

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
   * ISO 8601 datetime string.
   */
  originalTimestamp: z.iso.datetime(),

  /**
   * Timestamp when the event payload was sent.
   *
   * @remarks
   * ISO 8601 datetime string.
   */
  sentAt: z.iso.datetime(),

  /**
   * Timestamp when the event was recorded or processed.
   *
   * @remarks
   * ISO 8601 datetime string.
   */
  timestamp: z.iso.datetime(),

  /**
   * Identifier of the authenticated user, if known.
   */
  userId: z.optional(z.string()),
})

/**
 * TypeScript type inferred from {@link UniversalEventProperties}.
 */
export type UniversalEventProperties = z.infer<typeof UniversalEventProperties>
