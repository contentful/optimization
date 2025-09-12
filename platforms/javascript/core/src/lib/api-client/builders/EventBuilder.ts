import type {
  ComponentViewEvent,
  IdentifyEvent,
  PageViewEvent,
  TrackEvent,
} from '../experience/dto/event'
import type {
  App,
  Campaign,
  Channel,
  GeoLocation,
  Library,
  Page,
  PageView,
  Properties,
  Traits,
} from '../experience/dto/event/properties'
import type { UniversalEventProperties } from '../experience/dto/event/UniversalEventProperties'

export interface EventBuilderConfig {
  app?: App
  channel: Channel
  library: Library
}

export interface EventBuilderArgs {
  campaign?: Campaign
  locale: string
  location?: GeoLocation
  page: Page
  userAgent?: string
}

export interface ComponentViewBuilderArgs extends EventBuilderArgs {
  componentId: string
  experienceId?: string
  variantIndex: number
}

export interface IdentifyBuilderArgs extends EventBuilderArgs {
  traits: Traits
  userId: string
}

export interface PageViewBuilderArgs extends EventBuilderArgs {
  properties: PageView
}

export interface TrackBuilderArgs extends EventBuilderArgs {
  event: string
  properties: Properties
}

class EventBuilder {
  app: App
  channel: Channel
  library: Library

  constructor({ app, channel, library }: EventBuilderConfig) {
    this.app = app
    this.channel = channel
    this.library = library
  }

  buildUniversalEventProperties({
    campaign = {},
    locale,
    location = {},
    page,
    userAgent,
  }: EventBuilderArgs): UniversalEventProperties {
    const timestamp = new Date().toISOString()

    return {
      channel: this.channel,
      context: {
        app: this.app,
        campaign,
        gdpr: { isConsentGiven: true },
        library: this.library,
        locale,
        location,
        page,
        userAgent,
      },
      messageId: crypto.randomUUID(),
      originalTimestamp: timestamp,
      sentAt: timestamp,
      timestamp,
    }
  }

  buildComponentView({
    componentId,
    experienceId,
    variantIndex,
    ...universal
  }: ComponentViewBuilderArgs): ComponentViewEvent {
    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'component',
      component: 'Entry',
      componentId,
      experienceId,
      variantIndex,
    }
  }

  buildFlagView(args: ComponentViewBuilderArgs): ComponentViewEvent {
    return {
      ...this.buildComponentView(args),
      component: 'Variable',
    }
  }

  buildIdentify({ traits, userId, ...universal }: IdentifyBuilderArgs): IdentifyEvent {
    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'identify',
      traits,
      userId,
    }
  }

  buildPageView({ properties, ...universal }: PageViewBuilderArgs): PageViewEvent {
    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'page',
      properties,
    }
  }

  buildTrack({ event, properties, ...universal }: TrackBuilderArgs): TrackEvent {
    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'track',
      event,
      properties,
    }
  }
}

export default EventBuilder
