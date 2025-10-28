import {
  type App,
  Campaign,
  type Channel,
  type ComponentViewEvent,
  GeoLocation,
  type IdentifyEvent,
  type Library,
  Page,
  type PageViewEvent,
  Properties,
  type TrackEvent,
  Traits,
  type UniversalEventProperties,
} from '@contentful/optimization-api-schemas'
import { merge } from 'es-toolkit'
import * as z from 'zod/mini'

export interface EventBuilderConfig {
  app?: App
  channel: Channel
  library: Library
  getAnonymousId?: () => string | undefined
  getLocale?: () => string | undefined
  getPageProperties?: () => Page
  getUserAgent?: () => string | undefined
}

const UniversalEventBuilderArgs = z.object({
  campaign: z.optional(Campaign),
  locale: z.optional(z.string()),
  location: z.optional(GeoLocation),
  page: z.optional(Page),
  userAgent: z.optional(z.string()),
})
export type UniversalEventBuilderArgs = z.infer<typeof UniversalEventBuilderArgs>

const ComponentViewBuilderArgs = z.extend(UniversalEventBuilderArgs, {
  componentId: z.string(),
  experienceId: z.optional(z.string()),
  variantIndex: z.number(),
})
export type ComponentViewBuilderArgs = z.infer<typeof ComponentViewBuilderArgs>

const IdentifyBuilderArgs = z.extend(UniversalEventBuilderArgs, {
  traits: z.optional(Traits),
  userId: z.string(),
})
export type IdentifyBuilderArgs = z.infer<typeof IdentifyBuilderArgs>

const PageViewBuilderArgs = z.extend(UniversalEventBuilderArgs, {
  properties: z.optional(z.partial(Page)),
})
export type PageViewBuilderArgs = z.infer<typeof PageViewBuilderArgs>

const TrackBuilderArgs = z.extend(UniversalEventBuilderArgs, {
  event: z.string(),
  properties: z.optional(z.prefault(Properties, {})),
})
export type TrackBuilderArgs = z.infer<typeof TrackBuilderArgs>

export const DEFAULT_PAGE_PROPERTIES = {
  path: '',
  query: {},
  referrer: '',
  search: '',
  title: '',
  url: '',
}

class EventBuilder {
  app?: App
  channel: Channel
  library: Library
  getAnonymousId: () => string | undefined
  getLocale: () => string | undefined
  getPageProperties: () => Page
  getUserAgent: () => string | undefined

  constructor({
    app,
    channel,
    library,
    getAnonymousId,
    getLocale,
    getPageProperties,
    getUserAgent,
  }: EventBuilderConfig) {
    this.app = app
    this.channel = channel
    this.library = library
    this.getAnonymousId = getAnonymousId ?? (() => undefined)
    this.getLocale = getLocale ?? (() => 'en-US')
    this.getPageProperties = getPageProperties ?? (() => DEFAULT_PAGE_PROPERTIES)
    this.getUserAgent = getUserAgent ?? (() => undefined)
  }

  protected buildUniversalEventProperties({
    campaign = {},
    locale,
    location,
    page,
    userAgent,
  }: UniversalEventBuilderArgs): UniversalEventProperties {
    const timestamp = new Date().toISOString()

    return {
      channel: this.channel,
      context: {
        app: this.app,
        campaign,
        gdpr: { isConsentGiven: true },
        library: this.library,
        locale: locale ?? this.getLocale() ?? 'en-US',
        location,
        page: page ?? this.getPageProperties(),
        userAgent: userAgent ?? this.getUserAgent(),
      },
      messageId: crypto.randomUUID(),
      originalTimestamp: timestamp,
      sentAt: timestamp,
      timestamp,
    }
  }

  buildComponentView(args: ComponentViewBuilderArgs): ComponentViewEvent {
    const { componentId, experienceId, variantIndex, ...universal } =
      ComponentViewBuilderArgs.parse(args)

    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'component',
      componentType: 'Entry',
      componentId,
      experienceId,
      variantIndex,
    }
  }

  buildFlagView(args: ComponentViewBuilderArgs): ComponentViewEvent {
    return {
      ...this.buildComponentView(args),
      componentType: 'Variable',
    }
  }

  buildIdentify(args: IdentifyBuilderArgs): IdentifyEvent {
    const { traits = {}, userId, ...universal } = IdentifyBuilderArgs.parse(args)

    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'identify',
      traits,
      userId,
    }
  }

  buildPageView(args: PageViewBuilderArgs = {}): PageViewEvent {
    const { properties = {}, ...universal } = PageViewBuilderArgs.parse(args)

    const pageProperties = this.getPageProperties()

    const merged = merge(
      {
        ...pageProperties,
        title: pageProperties.title ?? DEFAULT_PAGE_PROPERTIES.title,
      },
      properties,
    )

    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'page',
      properties: merged,
    }
  }

  buildTrack(args: TrackBuilderArgs): TrackEvent {
    const { event, properties = {}, ...universal } = TrackBuilderArgs.parse(args)

    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'track',
      event,
      properties,
    }
  }
}

export default EventBuilder
