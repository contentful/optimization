import { boolean, iso, object, optional, string, type infer as zInfer } from 'zod/mini'
import { App, Campaign, Channel, GeoLocation, Library, Page } from './properties'

export const UniversalEventProperties = object({
  channel: Channel,
  context: object({
    app: App,
    campaign: Campaign,
    gdpr: object({
      isConsentGiven: boolean(),
    }),
    library: Library,
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

export type UniversalEventProperties = zInfer<typeof UniversalEventProperties>
