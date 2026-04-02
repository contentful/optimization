import type {
  ApiClientConfig,
  ExperienceApiClientRequestOptions,
} from '@contentful/optimization-api-client'
import {
  BatchInsightsEventArray,
  ExperienceEvent as ExperienceEventSchema,
  InsightsEvent as InsightsEventSchema,
  parseWithFriendlyError,
  type ExperienceEvent as ExperienceEventPayload,
  type InsightsEvent as InsightsEventPayload,
} from '@contentful/optimization-api-client/api-schemas'
import type { CoreStatelessApiConfig } from './CoreApiConfig'
import CoreBase, { type CoreConfig } from './CoreBase'
import { PartialProfile, type OptimizationData } from './api-schemas'
import type {
  ClickBuilderArgs,
  EventBuilderConfig,
  FlagViewBuilderArgs,
  HoverBuilderArgs,
  IdentifyBuilderArgs,
  PageViewBuilderArgs,
  ScreenViewBuilderArgs,
  TrackBuilderArgs,
  ViewBuilderArgs,
} from './events'

/**
 * Request-bound Experience API options for stateless runtimes.
 *
 * @public
 */
export interface CoreStatelessRequestOptions extends Pick<
  ExperienceApiClientRequestOptions,
  'ip' | 'locale' | 'plainText' | 'preflight'
> {}

/**
 * Configuration for stateless Optimization Core runtimes.
 *
 * @public
 * @remarks
 * This configuration extends {@link CoreConfig} but allows partial overrides
 * of the event-builder configuration. SDKs commonly inject their own library
 * metadata or channel definitions.
 */
export interface CoreStatelessConfig extends CoreConfig {
  /**
   * Unified API configuration for stateless environments.
   */
  api?: CoreStatelessApiConfig

  /**
   * Overrides for the event builder configuration. Omits methods that are only
   * useful in stateful environments.
   */
  eventBuilder?: Omit<EventBuilderConfig, 'getLocale' | 'getPageProperties' | 'getUserAgent'>
}

type StatelessExperiencePayload<TPayload> = TPayload & { profile?: PartialProfile }
type StatelessInsightsPayload<TPayload> = TPayload & { profile: PartialProfile }
type StatelessStickyTrackViewPayload = ViewBuilderArgs & {
  profile?: PartialProfile
  sticky: true
}
type StatelessNonStickyTrackViewPayload = Omit<ViewBuilderArgs, 'sticky'> & {
  profile: PartialProfile
  sticky?: false | undefined
}

const TRACK_CLICK_PROFILE_ERROR =
  'CoreStateless.trackClick() requires `payload.profile.id` for Insights delivery.'
const TRACK_HOVER_PROFILE_ERROR =
  'CoreStateless.trackHover() requires `payload.profile.id` for Insights delivery.'
const TRACK_FLAG_VIEW_PROFILE_ERROR =
  'CoreStateless.trackFlagView() requires `payload.profile.id` for Insights delivery.'
const NON_STICKY_TRACK_VIEW_PROFILE_ERROR =
  'CoreStateless.trackView() requires `payload.profile.id` when `payload.sticky` is not `true`.'
const STICKY_TRACK_VIEW_PROFILE_ERROR =
  'CoreStateless.trackView() could not derive a profile from the sticky Experience response. Pass `payload.profile.id` explicitly if you need a fallback.'

const hasDefinedValues = (record: Record<string, unknown>): boolean =>
  Object.values(record).some((value) => value !== undefined)

const requireInsightsProfile = (
  profile: PartialProfile | undefined,
  errorMessage: string,
): PartialProfile => {
  if (profile !== undefined) return profile

  throw new Error(errorMessage)
}

const createStatelessExperienceApiConfig = (
  api: CoreStatelessConfig['api'] | undefined,
): ApiClientConfig['experience'] => {
  if (api === undefined) return undefined

  const experienceConfig = {
    baseUrl: api.experienceBaseUrl,
    enabledFeatures: api.enabledFeatures,
  }

  return hasDefinedValues(experienceConfig) ? experienceConfig : undefined
}

const createStatelessInsightsApiConfig = (
  api: CoreStatelessConfig['api'] | undefined,
): ApiClientConfig['insights'] => {
  if (api?.insightsBaseUrl === undefined) return undefined

  return {
    baseUrl: api.insightsBaseUrl,
  }
}

/**
 * Core runtime for stateless environments.
 *
 * @public
 * Built on top of `CoreBase`. Event-emitting methods are exposed directly on
 * the stateless instance and accept request-scoped Experience options as a
 * separate final argument.
 * @remarks
 * The runtime itself is stateless, but event methods still perform outbound
 * Experience and Insights API calls. Cache Contentful delivery data in the
 * host application, not the results of those calls.
 */
class CoreStateless extends CoreBase<CoreStatelessConfig> {
  constructor(config: CoreStatelessConfig) {
    super(config, {
      experience: createStatelessExperienceApiConfig(config.api),
      insights: createStatelessInsightsApiConfig(config.api),
    })
  }

  async identify(
    payload: StatelessExperiencePayload<IdentifyBuilderArgs>,
    requestOptions?: CoreStatelessRequestOptions,
  ): Promise<OptimizationData> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      this.eventBuilder.buildIdentify(builderArgs),
      profile,
      requestOptions,
    )
  }

  async page(
    payload: StatelessExperiencePayload<PageViewBuilderArgs> = {},
    requestOptions?: CoreStatelessRequestOptions,
  ): Promise<OptimizationData> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      this.eventBuilder.buildPageView(builderArgs),
      profile,
      requestOptions,
    )
  }

  async screen(
    payload: StatelessExperiencePayload<ScreenViewBuilderArgs>,
    requestOptions?: CoreStatelessRequestOptions,
  ): Promise<OptimizationData> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      this.eventBuilder.buildScreenView(builderArgs),
      profile,
      requestOptions,
    )
  }

  async track(
    payload: StatelessExperiencePayload<TrackBuilderArgs>,
    requestOptions?: CoreStatelessRequestOptions,
  ): Promise<OptimizationData> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      this.eventBuilder.buildTrack(builderArgs),
      profile,
      requestOptions,
    )
  }

  async trackView(
    payload: StatelessStickyTrackViewPayload | StatelessNonStickyTrackViewPayload,
    requestOptions?: CoreStatelessRequestOptions,
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload
    let result: OptimizationData | undefined = undefined
    let insightsProfile: PartialProfile | undefined = profile

    if (payload.sticky) {
      result = await this.sendExperienceEvent(
        this.eventBuilder.buildView(builderArgs),
        profile,
        requestOptions,
      )
      const { profile: responseProfile } = result
      insightsProfile = responseProfile
    }

    await this.sendInsightsEvent(
      this.eventBuilder.buildView(builderArgs),
      requireInsightsProfile(
        insightsProfile,
        payload.sticky ? STICKY_TRACK_VIEW_PROFILE_ERROR : NON_STICKY_TRACK_VIEW_PROFILE_ERROR,
      ),
    )

    return result
  }

  async trackClick(
    payload: StatelessInsightsPayload<ClickBuilderArgs>,
    _requestOptions?: CoreStatelessRequestOptions,
  ): Promise<void> {
    const { profile, ...builderArgs } = payload

    await this.sendInsightsEvent(
      this.eventBuilder.buildClick(builderArgs),
      requireInsightsProfile(profile, TRACK_CLICK_PROFILE_ERROR),
    )
  }

  async trackHover(
    payload: StatelessInsightsPayload<HoverBuilderArgs>,
    _requestOptions?: CoreStatelessRequestOptions,
  ): Promise<void> {
    const { profile, ...builderArgs } = payload

    await this.sendInsightsEvent(
      this.eventBuilder.buildHover(builderArgs),
      requireInsightsProfile(profile, TRACK_HOVER_PROFILE_ERROR),
    )
  }

  async trackFlagView(
    payload: StatelessInsightsPayload<FlagViewBuilderArgs>,
    _requestOptions?: CoreStatelessRequestOptions,
  ): Promise<void> {
    const { profile, ...builderArgs } = payload

    await this.sendInsightsEvent(
      this.eventBuilder.buildFlagView(builderArgs),
      requireInsightsProfile(profile, TRACK_FLAG_VIEW_PROFILE_ERROR),
    )
  }

  private async sendExperienceEvent(
    event: ExperienceEventPayload,
    profile?: PartialProfile,
    requestOptions?: CoreStatelessRequestOptions,
  ): Promise<OptimizationData> {
    const intercepted = await this.interceptors.event.run(event)
    const validEvent = parseWithFriendlyError(ExperienceEventSchema, intercepted)

    return await this.api.experience.upsertProfile(
      {
        profileId: profile?.id,
        events: [validEvent],
      },
      requestOptions,
    )
  }

  private async sendInsightsEvent(
    event: InsightsEventPayload,
    profile: PartialProfile,
  ): Promise<void> {
    const intercepted = await this.interceptors.event.run(event)
    const validEvent = parseWithFriendlyError(InsightsEventSchema, intercepted)
    const batchEvent: BatchInsightsEventArray = parseWithFriendlyError(BatchInsightsEventArray, [
      { profile: parseWithFriendlyError(PartialProfile, profile), events: [validEvent] },
    ])

    await this.api.insights.sendBatchEvents(batchEvent)
  }
}

export default CoreStateless
