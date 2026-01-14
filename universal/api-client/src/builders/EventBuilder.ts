import {
  type App,
  Campaign,
  type Channel,
  type ComponentViewEvent,
  GeoLocation,
  type IdentifyEvent,
  type Library,
  Page,
  PageEventContext,
  type PageViewEvent,
  Properties,
  Screen,
  ScreenEventContext,
  type ScreenViewEvent,
  type TrackEvent,
  Traits,
  type UniversalEventProperties,
} from '@contentful/optimization-api-schemas'
import { merge } from 'es-toolkit'
import * as z from 'zod/mini'

/**
 * Configuration options for creating an {@link EventBuilder} instance.
 *
 * @public
 * @remarks
 * The configuration is typically provided by the host application to adapt
 * event payloads to the runtime environment (browser, framework, etc.).
 *
 * @example
 * ```ts
 * const builder = new EventBuilder({
 *   app: { name: 'my-app', version: '1.0.0' },
 *   channel: 'web',
 *   library: { name: '@contentful/optimization-sdk', version: '1.2.3' },
 *   getLocale: () => navigator.language,
 *   getPageProperties: () => ({
 *     path: window.location.pathname,
 *     url: window.location.href,
 *     title: document.title,
 *     query: {},
 *     referrer: document.referrer,
 *     search: window.location.search,
 *   }),
 * })
 * ```
 */
export interface EventBuilderConfig {
  /**
   * The application definition used to attribute events to a specific consumer app.
   *
   * @remarks
   * When not provided, events will not contain app metadata in their context.
   */
  app?: App

  /**
   * The channel that identifies where events originate from (e.g. web, mobile).
   *
   * @see {@link Channel}
   */
  channel: Channel

  /**
   * The client library metadata that is attached to all events.
   *
   * @remarks
   * This is typically used to record the library name and version.
   */
  library: Library

  /**
   * Function used to resolve the locale for outgoing events.
   *
   * @remarks
   * If not provided, the builder falls back to the default `'en-US'`. Locale
   * values supplied directly as arguments to event builder methods take
   * precedence.
   *
   * @returns The locale string (e.g. `'en-US'`), or `undefined` if unavailable.
   */
  getLocale?: () => string | undefined

  /**
   * Function that returns the current page properties.
   *
   * @remarks
   * Page properties are currently added to the context of all events, as well
   * as the `properties` of the page event. When specified, all properties of
   * the `Page` type are required, but may contain empty values.
   *
   * @returns A {@link Page} object containing information about the current page.
   * @see {@link Page}
   */
  getPageProperties?: () => Page

  /**
   * Function used to obtain the current user agent string when applicable.
   *
   * @returns A user agent string, or `undefined` if unavailable.
   */
  getUserAgent?: () => string | undefined
}

const UniversalEventBuilderArgs = z.object({
  campaign: z.optional(Campaign),
  locale: z.optional(z.string()),
  location: z.optional(GeoLocation),
  page: z.optional(Page),
  screen: z.optional(Screen),
  userAgent: z.optional(z.string()),
})

/**
 * Arguments used to construct the universal (shared) portion of all events.
 *
 * @public
 */
export type UniversalEventBuilderArgs = z.infer<typeof UniversalEventBuilderArgs>

const ComponentViewBuilderArgs = z.extend(UniversalEventBuilderArgs, {
  componentId: z.string(),
  experienceId: z.optional(z.string()),
  variantIndex: z.optional(z.number()),
  sticky: z.optional(z.boolean()),
})

/**
 * Arguments for constructing component view events.
 *
 * @public
 */
export type ComponentViewBuilderArgs = z.infer<typeof ComponentViewBuilderArgs>

const IdentifyBuilderArgs = z.extend(UniversalEventBuilderArgs, {
  traits: z.optional(Traits),
  userId: z.string(),
})

/**
 * Arguments for constructing identify events.
 *
 * @public
 * @remarks
 * Traits are merged by the API; only specified properties may be overwritten.
 */
export type IdentifyBuilderArgs = z.infer<typeof IdentifyBuilderArgs>

const PageViewBuilderArgs = z.extend(UniversalEventBuilderArgs, {
  properties: z.optional(z.partial(Page)),
})

/**
 * Arguments for constructing page view events.
 *
 * @public
 * @remarks
 * Any properties passed here are merged with the base page properties from
 * {@link EventBuilderConfig.getPageProperties}.
 */
export type PageViewBuilderArgs = z.infer<typeof PageViewBuilderArgs>

const ScreenViewBuilderArgs = z.extend(UniversalEventBuilderArgs, {
  name: z.string(),
  properties: Properties,
})

/**
 * Arguments for constructing screen view events.
 *
 * @public
 * @remarks
 * Any properties passed here are merged with the base screen properties from
 * {@link EventBuilderConfig.getScreenProperties}.
 */
export type ScreenViewBuilderArgs = z.infer<typeof ScreenViewBuilderArgs>

const TrackBuilderArgs = z.extend(UniversalEventBuilderArgs, {
  event: z.string(),
  properties: z.optional(z.prefault(Properties, {})),
})

/**
 * Arguments for constructing track events.
 *
 * @public
 */
export type TrackBuilderArgs = z.infer<typeof TrackBuilderArgs>

/**
 * Default page properties used when no explicit page information is available.
 *
 * @public
 *
 * @defaultValue
 * ```ts
 * {
 *   path: '',
 *   query: {},
 *   referrer: '',
 *   search: '',
 *   title: '',
 *   url: '',
 * }
 * ```
 *
 * @remarks
 * Values are required by the API; values may not be `undefined`. Empty values are valid.
 */
export const DEFAULT_PAGE_PROPERTIES = {
  path: '',
  query: {},
  referrer: '',
  search: '',
  title: '',
  url: '',
}

/**
 * Internal helper class for building analytics and personalization events.
 *
 * @remarks
 * This class coordinates configuration and argument validation to produce
 * strongly-typed event payloads compatible with
 * `@contentful/optimization-api-schemas`.
 *
 * @public
 */
class EventBuilder {
  /**
   * Application metadata attached to each event.
   *
   * @internal
   */
  app?: App

  /**
   * Channel value attached to each event.
   *
   * @internal
   */
  channel: Channel

  /**
   * Library metadata attached to each event.
   *
   * @internal
   */
  library: Library

  /**
   * Function that provides the locale when available.
   *
   * @internal
   */
  getLocale: () => string | undefined

  /**
   * Function that provides baseline page properties.
   *
   * @internal
   */
  getPageProperties: () => Page

  /**
   * Function that provides the user agent string when available.
   *
   * @internal
   */
  getUserAgent: () => string | undefined

  /**
   * Creates a new {@link EventBuilder} instance.
   *
   * @param config - Configuration used to customize event payloads.
   *
   * @internal
   * @remarks
   * Callers are expected to reuse a single instance when possible to avoid
   * repeatedly reconfiguring the builder.
   *
   * @example
   * ```ts
   * const builder = new EventBuilder({
   *   channel: 'web',
   *   library: { name: '@contentful/optimization-sdk', version: '1.0.0' },
   * })
   * ```
   */
  constructor(config: EventBuilderConfig) {
    const { app, channel, library, getLocale, getPageProperties, getUserAgent } = config
    this.app = app
    this.channel = channel
    this.library = library
    this.getLocale = getLocale ?? (() => 'en-US')
    this.getPageProperties = getPageProperties ?? (() => DEFAULT_PAGE_PROPERTIES)
    this.getUserAgent = getUserAgent ?? (() => undefined)
  }

  /**
   * Builds the universal event properties shared across all event types.
   *
   * @param args - Arguments overriding the default context values.
   * @returns A fully populated {@link UniversalEventProperties} object.
   *
   * @protected
   *
   * @remarks
   * This method is used internally by the specific event-builder methods
   * (e.g. {@link EventBuilder.buildPageView}).
   */
  protected buildUniversalEventProperties({
    campaign = {},
    locale,
    location,
    page,
    screen,
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
        screen,
        userAgent: userAgent ?? this.getUserAgent(),
      },
      messageId: crypto.randomUUID(),
      originalTimestamp: timestamp,
      sentAt: timestamp,
      timestamp,
    }
  }

  /**
   * Builds a component view event payload for a Contentful entry-based component.
   *
   * @param args - {@link ComponentViewBuilderArgs} arguments describing the component view.
   * @returns A {@link ComponentViewEvent} describing the view.
   *
   * @public
   *
   * @example
   * ```ts
   * const event = builder.buildComponentView({
   *   componentId: 'entry-123',
   *   experienceId: 'personalization-123',
   *   variantIndex: 1,
   * })
   * ```
   */
  buildComponentView(args: ComponentViewBuilderArgs): ComponentViewEvent {
    const { componentId, experienceId, variantIndex, ...universal } =
      ComponentViewBuilderArgs.parse(args)

    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'component',
      componentType: 'Entry',
      componentId,
      experienceId,
      variantIndex: variantIndex ?? 0,
    }
  }

  /**
   * Builds a component view event payload for a Custom Flag component.
   *
   * @param args - {@link ComponentViewBuilderArgs} arguments describing the Custom Flag view.
   * @returns A {@link ComponentViewEvent} describing the view.
   *
   * @public
   *
   * @remarks
   * This is a specialized variant of {@link EventBuilder.buildComponentView}
   * that sets `componentType` to `'Variable'`.
   *
   * @example
   * ```ts
   * const event = builder.buildFlagView({
   *   componentId: 'feature-flag-key',
   *   experienceId: 'personalization-123',
   * })
   * ```
   */
  buildFlagView(args: ComponentViewBuilderArgs): ComponentViewEvent {
    return {
      ...this.buildComponentView(args),
      componentType: 'Variable',
    }
  }

  /**
   * Builds an identify event payload to associate a user ID with traits.
   *
   * @param args - {@link IdentifyBuilderArgs} arguments describing the identified user.
   * @returns An {@link IdentifyEvent} payload.
   *
   * @public
   *
   * @remarks
   * - Traits are merged by the API; only specified properties may be overwritten.
   * - The User ID is consumer-specified and should not contain the value of any
   *   ID generated by the Experience API.
   *
   * @example
   * ```ts
   * const event = builder.buildIdentify({
   *   userId: 'user-123',
   *   traits: { plan: 'pro' },
   * })
   * ```
   */
  buildIdentify(args: IdentifyBuilderArgs): IdentifyEvent {
    const { traits = {}, userId, ...universal } = IdentifyBuilderArgs.parse(args)

    return {
      ...this.buildUniversalEventProperties(universal),
      type: 'identify',
      traits,
      userId,
    }
  }

  /**
   * Builds a page view event payload.
   *
   * @param args - Optional {@link PageViewBuilderArgs} overrides for the page view event.
   * @returns A {@link PageViewEvent} payload.
   *
   * @public
   *
   * @remarks
   * Page properties are created by merging:
   * 1. The base page properties from {@link EventBuilderConfig.getPageProperties}, and
   * 2. The partial `properties` argument passed in.
   *
   * The title always falls back to {@link DEFAULT_PAGE_PROPERTIES}.title when undefined.
   *
   * @example
   * ```ts
   * const event = builder.buildPageView({
   *   properties: {
   *     title: 'Homepage',
   *   },
   * })
   * ```
   */
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

    const {
      context: { screen: _, ...universalContext },
      ...universalProperties
    } = this.buildUniversalEventProperties(universal)

    const context = PageEventContext.parse(universalContext)

    return {
      ...universalProperties,
      context,
      type: 'page',
      properties: merged,
    }
  }

  /**
   * Builds a screen view event payload.
   *
   * @param args - {@link ScreenViewBuilderArgs} arguments for the screen view event.
   * @returns A {@link ScreenViewEvent} payload.
   *
   * @public
   *
   * @example
   * ```ts
   * const event = builder.buildScreenView({
   *   name: 'home',
   *   properties: {
   *     title: 'Home Screen',
   *   },
   * })
   * ```
   */
  buildScreenView(args: ScreenViewBuilderArgs): ScreenViewEvent {
    const { name, properties, ...universal } = ScreenViewBuilderArgs.parse(args)

    const {
      context: { page: _, ...universalContext },
      ...universalProperties
    } = this.buildUniversalEventProperties(universal)

    const context = ScreenEventContext.parse(universalContext)

    return {
      ...universalProperties,
      context,
      type: 'screen',
      name,
      properties,
    }
  }

  /**
   * Builds a track event payload for arbitrary user actions.
   *
   * @param args - {@link TrackBuilderArgs} arguments describing the tracked event.
   * @returns A {@link TrackEvent} payload.
   *
   * @public
   *
   * @example
   * ```ts
   * const event = builder.buildTrack({
   *   event: 'button_clicked',
   *   properties: { id: 'primary-cta', location: 'hero' },
   * })
   * ```
   */
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
