import type {
  ComponentViewEventType,
  IdentifyEventType,
  PageViewEventType,
  TrackEventType,
} from '../api-client/experience/dto/event'
import type {
  AppType,
  CampaignType,
  ChannelType,
  GeoLocationType,
  LibraryType,
  PageType,
  PageViewType,
  PropertiesType,
  TraitsType,
} from '../api-client/experience/dto/event/properties'
import type { UniversalEventPropertiesType } from '../api-client/experience/dto/event/UniversalEventProperties'

export interface EventBuilderConfig {
  app?: AppType
  channel: ChannelType
  library: LibraryType
}

export interface EventBuilderArgs {
  campaign?: CampaignType
  locale: string
  location?: GeoLocationType
  page: PageType
  userAgent?: string
}

export interface ComponentViewBuilderArgs extends EventBuilderArgs {
  componentId: string
  experienceId?: string
  variantIndex: number
}

export interface IdentifyBuilderArgs extends EventBuilderArgs {
  traits: TraitsType
  userId: string
}

export interface PageViewBuilderArgs extends EventBuilderArgs {
  properties: PageViewType
}

export interface TrackBuilderArgs extends EventBuilderArgs {
  event: string
  properties: PropertiesType
}

class EventBuilder {
  app: AppType
  channel: ChannelType
  library: LibraryType

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
  }: EventBuilderArgs): UniversalEventPropertiesType {
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
  }: ComponentViewBuilderArgs): ComponentViewEventType {
    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'component',
      componentType: 'Entry',
      componentId,
      experienceId,
      variantIndex,
    }
  }

  buildFlagView(args: ComponentViewBuilderArgs): ComponentViewEventType {
    return {
      ...this.buildComponentView(args),
      componentType: 'Variable',
    }
  }

  buildIdentify({ traits, userId, ...universal }: IdentifyBuilderArgs): IdentifyEventType {
    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'identify',
      traits,
      userId,
    }
  }

  buildPageView({ properties, ...universal }: PageViewBuilderArgs): PageViewEventType {
    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'page',
      properties,
    }
  }

  buildTrack({ event, properties, ...universal }: TrackBuilderArgs): TrackEventType {
    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'track',
      event,
      properties,
    }
  }
}

export default EventBuilder
