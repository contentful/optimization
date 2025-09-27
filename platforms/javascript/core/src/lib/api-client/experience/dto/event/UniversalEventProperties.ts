import { z } from 'zod/mini'
import { App, Campaign, Channel, GeoLocation, Library, Page } from './properties'

export const UniversalEventProperties = z.object({
  channel: Channel,
  context: z.object({
    app: App,
    campaign: Campaign,
    gdpr: z.object({
      isConsentGiven: z.boolean(),
    }),
    library: Library,
    locale: z.string(),
    location: z.optional(GeoLocation),
    page: Page,
    userAgent: z.optional(z.string()),
  }),
  messageId: z.string(),
  originalTimestamp: z.iso.datetime(),
  sentAt: z.iso.datetime(),
  timestamp: z.iso.datetime(),
  userId: z.optional(z.string()),
})

export type UniversalEventProperties = z.infer<typeof UniversalEventProperties>
