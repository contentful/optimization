import { boolean, iso, object, optional, string } from 'zod/mini'
import { Campaign, Channel, GeoLocation, Page } from './properties'

export const UniversalEventProperties = object({
  channel: Channel,
  context: object({
    app: optional(
      object({
        name: string(),
        version: string(),
      }),
    ),
    campaign: Campaign,
    gdpr: object({
      isConsentGiven: boolean(),
    }),
    library: {
      name: string(),
      version: string(),
    },
    locale: string(),
    location: GeoLocation,
    page: Page,
    userAgent: optional(string()),
  }),
  messageId: string(),
  originalTimestamp: iso.datetime(),
  sentAt: iso.datetime(),
  timestamp: iso.datetime(),
  userId: optional(string()),
})
