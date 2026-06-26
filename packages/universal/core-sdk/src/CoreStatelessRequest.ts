import {
  BatchInsightsEventArray,
  ExperienceEvent as ExperienceEventSchema,
  InsightsEvent as InsightsEventSchema,
  parseWithFriendlyError,
  type ExperienceEvent as ExperienceEventPayload,
  type InsightsEvent as InsightsEventPayload,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type CoreStateless from './CoreStateless'
import type { CoreStatelessInsightsOptions, CoreStatelessRequestOptions } from './CoreStateless'
import { PartialProfile, type OptimizationData } from './api-schemas'
import type {
  AllowedEventType,
  ClickBuilderArgs,
  EventEmissionResult,
  FlagViewBuilderArgs,
  HoverBuilderArgs,
  IdentifyBuilderArgs,
  PageViewBuilderArgs,
  ScreenViewBuilderArgs,
  TrackBuilderArgs,
  UniversalEventBuilderArgs,
  ViewBuilderArgs,
} from './events'
import { normalizeExplicitLocale } from './locale'

const coreLogger = createScopedLogger('CoreStateless')

const TRACK_CLICK_PROFILE_ERROR =
  'CoreStatelessRequest.trackClick() requires a request-bound profile id for Insights delivery.'
const TRACK_HOVER_PROFILE_ERROR =
  'CoreStatelessRequest.trackHover() requires a request-bound profile id for Insights delivery.'
const TRACK_FLAG_VIEW_PROFILE_ERROR =
  'CoreStatelessRequest.trackFlagView() requires a request-bound profile id for Insights delivery.'
const NON_STICKY_TRACK_VIEW_PROFILE_ERROR =
  'CoreStatelessRequest.trackView() requires a request-bound profile id when `payload.sticky` is not `true`.'
const STICKY_TRACK_VIEW_PROFILE_ERROR =
  'CoreStatelessRequest.trackView() could not derive a profile from the sticky Experience response. Bind `profile.id` with forRequest() if you need a fallback.'

/**
 * Request-scoped consent accepted by stateless request clients.
 *
 * @public
 */
export type CoreStatelessRequestConsent =
  | boolean
  | {
      /** Whether events may be emitted for this request. */
      events?: boolean
      /** Whether profile continuity may be persisted by the host application. */
      persistence?: boolean
    }

/**
 * Options used to bind stateless SDK calls to an incoming request.
 *
 * @public
 */
export interface CoreStatelessForRequestOptions {
  /** Request-scoped event and persistence consent. */
  consent: CoreStatelessRequestConsent
  /** Request-scoped SDK locale used for Experience API requests and default event context. */
  locale?: string
  /** Profile already known for the request, such as an anonymous ID from a cookie. */
  profile?: PartialProfile
  /** Universal event context shared by event calls made through this request object. */
  eventContext?: UniversalEventBuilderArgs
  /** Experience API options shared by Experience calls made through this request object. */
  experienceOptions?: CoreStatelessRequestOptions
  /** Insights API options shared by Insights calls made through this request object. */
  insightsOptions?: CoreStatelessInsightsOptions
}

/**
 * Payload accepted by request-bound Experience methods.
 *
 * @typeParam TPayload - Event-builder arguments for the specific method.
 *
 * @public
 */
export type StatelessExperiencePayload<TPayload> = TPayload

/**
 * Payload accepted by request-bound Insights methods.
 *
 * @typeParam TPayload - Event-builder arguments for the specific method.
 *
 * @public
 */
export type StatelessInsightsPayload<TPayload> = TPayload

/**
 * Sticky request-bound view-tracking payload.
 *
 * @public
 */
export type StatelessStickyTrackViewPayload = ViewBuilderArgs & {
  sticky: true
}

/**
 * Non-sticky request-bound view-tracking payload.
 *
 * @public
 */
export type StatelessNonStickyTrackViewPayload = Omit<ViewBuilderArgs, 'sticky'> & {
  sticky?: false | undefined
}

const requireInsightsProfile = (
  profile: PartialProfile | undefined,
  errorMessage: string,
): PartialProfile => {
  if (profile?.id !== undefined) return profile

  throw new Error(errorMessage)
}

const withRequestEventConsent = <TEvent extends ExperienceEventPayload | InsightsEventPayload>(
  event: TEvent,
  isConsentGiven: boolean,
): TEvent => ({
  ...event,
  context: {
    ...event.context,
    gdpr: {
      ...event.context.gdpr,
      isConsentGiven,
    },
  },
})

type RequestExperienceMethod = 'identify' | 'page' | 'screen' | 'track'

/**
 * Request-bound stateless Optimization Core event client.
 *
 * @public
 */
export class CoreStatelessRequest {
  private readonly core: CoreStateless
  private currentProfile: PartialProfile | undefined
  private readonly requestEventConsent: boolean | undefined
  private readonly eventContext: UniversalEventBuilderArgs
  private readonly experienceOptions: CoreStatelessRequestOptions | undefined
  private readonly insightsOptions: CoreStatelessInsightsOptions | undefined
  readonly canPersistProfile: boolean

  constructor(core: CoreStateless, options: CoreStatelessForRequestOptions) {
    const { consent, eventContext, experienceOptions, insightsOptions, locale, profile } = options
    const isBooleanConsent = typeof consent === 'boolean'
    const requestLocale = normalizeExplicitLocale(locale)

    this.core = core
    this.currentProfile = profile
    this.requestEventConsent = isBooleanConsent ? consent : consent.events
    this.canPersistProfile = (isBooleanConsent ? consent : consent.persistence) === true
    this.eventContext =
      requestLocale === undefined
        ? (eventContext ?? {})
        : { ...eventContext, locale: requestLocale }
    this.experienceOptions =
      requestLocale === undefined
        ? experienceOptions
        : { ...experienceOptions, locale: requestLocale }
    this.insightsOptions = insightsOptions
  }

  /**
   * Current request profile, updated after Experience responses.
   */
  get profile(): PartialProfile | undefined {
    return this.currentProfile
  }

  async identify(
    payload: StatelessExperiencePayload<IdentifyBuilderArgs>,
  ): Promise<EventEmissionResult> {
    return await this.sendExperienceEvent(
      'identify',
      [payload],
      this.core.eventBuilder.buildIdentify(this.withEventContext(payload)),
    )
  }

  async page(
    payload: StatelessExperiencePayload<PageViewBuilderArgs> = {},
  ): Promise<EventEmissionResult> {
    return await this.sendExperienceEvent(
      'page',
      [payload],
      this.core.eventBuilder.buildPageView(this.withEventContext(payload)),
    )
  }

  async screen(
    payload: StatelessExperiencePayload<ScreenViewBuilderArgs>,
  ): Promise<EventEmissionResult> {
    return await this.sendExperienceEvent(
      'screen',
      [payload],
      this.core.eventBuilder.buildScreenView(this.withEventContext(payload)),
    )
  }

  async track(payload: StatelessExperiencePayload<TrackBuilderArgs>): Promise<EventEmissionResult> {
    return await this.sendExperienceEvent(
      'track',
      [payload],
      this.core.eventBuilder.buildTrack(this.withEventContext(payload)),
    )
  }

  async trackView(
    payload: StatelessStickyTrackViewPayload | StatelessNonStickyTrackViewPayload,
  ): Promise<EventEmissionResult> {
    if (!this.hasConsent('component')) {
      this.reportBlockedEvent('trackView', [payload])
      return { accepted: false }
    }

    const builderArgs = this.withEventContext(payload)
    let result: EventEmissionResult = { accepted: true }
    let { currentProfile: insightsProfile } = this

    if (payload.sticky) {
      const data = await this.sendAllowedExperienceEvent(
        this.core.eventBuilder.buildView(builderArgs),
      )
      const { profile } = data
      result = { accepted: true, data }
      insightsProfile = profile
    }

    await this.sendAllowedInsightsEvent(
      this.core.eventBuilder.buildView(builderArgs),
      requireInsightsProfile(
        insightsProfile,
        payload.sticky ? STICKY_TRACK_VIEW_PROFILE_ERROR : NON_STICKY_TRACK_VIEW_PROFILE_ERROR,
      ),
    )

    return result
  }

  async trackClick(payload: StatelessInsightsPayload<ClickBuilderArgs>): Promise<void> {
    if (!this.hasConsent('component_click')) {
      this.reportBlockedEvent('trackClick', [payload])
      return
    }

    await this.sendAllowedInsightsEvent(
      this.core.eventBuilder.buildClick(this.withEventContext(payload)),
      requireInsightsProfile(this.currentProfile, TRACK_CLICK_PROFILE_ERROR),
    )
  }

  async trackHover(payload: StatelessInsightsPayload<HoverBuilderArgs>): Promise<void> {
    if (!this.hasConsent('component_hover')) {
      this.reportBlockedEvent('trackHover', [payload])
      return
    }

    await this.sendAllowedInsightsEvent(
      this.core.eventBuilder.buildHover(this.withEventContext(payload)),
      requireInsightsProfile(this.currentProfile, TRACK_HOVER_PROFILE_ERROR),
    )
  }

  async trackFlagView(payload: StatelessInsightsPayload<FlagViewBuilderArgs>): Promise<void> {
    if (!this.hasConsent('flag', 'component')) {
      this.reportBlockedEvent('trackFlagView', [payload])
      return
    }

    await this.sendAllowedInsightsEvent(
      this.core.eventBuilder.buildFlagView(this.withEventContext(payload)),
      requireInsightsProfile(this.currentProfile, TRACK_FLAG_VIEW_PROFILE_ERROR),
    )
  }

  private withEventContext<TPayload extends UniversalEventBuilderArgs>(
    payload: TPayload,
  ): TPayload {
    return {
      ...this.eventContext,
      ...payload,
    }
  }

  private hasConsent(...eventTypes: AllowedEventType[]): boolean {
    return (
      this.requestEventConsent === true ||
      eventTypes.some((eventType) => this.core.allowedEventTypes.includes(eventType))
    )
  }

  private async sendExperienceEvent(
    method: RequestExperienceMethod,
    args: readonly unknown[],
    event: ExperienceEventPayload,
  ): Promise<EventEmissionResult> {
    if (!this.hasConsent(method)) {
      this.reportBlockedEvent(method, args)
      return { accepted: false }
    }

    const data = await this.sendAllowedExperienceEvent(event)

    return { accepted: true, data }
  }

  private async sendAllowedExperienceEvent(
    event: ExperienceEventPayload,
  ): Promise<OptimizationData> {
    const intercepted = await this.core.interceptors.event.run(
      withRequestEventConsent(event, this.requestEventConsent === true),
    )
    const validEvent = parseWithFriendlyError(ExperienceEventSchema, intercepted)
    const result = await this.core.api.experience.upsertProfile(
      {
        profileId: this.currentProfile?.id,
        events: [validEvent],
      },
      this.experienceOptions,
    )

    const { profile } = result
    this.currentProfile = profile

    return result
  }

  private async sendAllowedInsightsEvent(
    event: InsightsEventPayload,
    profile: PartialProfile,
  ): Promise<void> {
    const intercepted = await this.core.interceptors.event.run(
      withRequestEventConsent(event, this.requestEventConsent === true),
    )
    const validEvent = parseWithFriendlyError(InsightsEventSchema, intercepted)
    const batchEvent: BatchInsightsEventArray = parseWithFriendlyError(BatchInsightsEventArray, [
      { profile: parseWithFriendlyError(PartialProfile, profile), events: [validEvent] },
    ])

    if (this.insightsOptions === undefined) {
      await this.core.api.insights.sendBatchEvents(batchEvent)
      return
    }

    await this.core.api.insights.sendBatchEvents(batchEvent, this.insightsOptions)
  }

  private reportBlockedEvent(method: string, args: readonly unknown[]): void {
    try {
      this.core.onEventBlocked?.({ reason: 'consent', method, args })
    } catch (error) {
      coreLogger.warn(`onEventBlocked callback failed for method "${method}"`, error)
    }
  }
}
