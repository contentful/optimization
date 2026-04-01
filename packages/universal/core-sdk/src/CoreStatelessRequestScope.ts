import {
  BatchInsightsEventArray,
  ExperienceEvent as ExperienceEventSchema,
  InsightsEvent as InsightsEventSchema,
  parseWithFriendlyError,
  type ExperienceEvent as ExperienceEventPayload,
  type InsightsEvent as InsightsEventPayload,
} from '@contentful/optimization-api-client/api-schemas'
import { PartialProfile, type OptimizationData } from './api-schemas'
import type CoreStateless from './CoreStateless'
import type { CoreStatelessRequestOptions } from './CoreStateless'
import type {
  ClickBuilderArgs,
  FlagViewBuilderArgs,
  HoverBuilderArgs,
  IdentifyBuilderArgs,
  PageViewBuilderArgs,
  ScreenViewBuilderArgs,
  TrackBuilderArgs,
  ViewBuilderArgs,
} from './events'

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
  'CoreStateless.forRequest().trackClick() requires `payload.profile.id` for Insights delivery.'
const TRACK_HOVER_PROFILE_ERROR =
  'CoreStateless.forRequest().trackHover() requires `payload.profile.id` for Insights delivery.'
const TRACK_FLAG_VIEW_PROFILE_ERROR =
  'CoreStateless.forRequest().trackFlagView() requires `payload.profile.id` for Insights delivery.'
const NON_STICKY_TRACK_VIEW_PROFILE_ERROR =
  'CoreStateless.forRequest().trackView() requires `payload.profile.id` when `payload.sticky` is not `true`.'
const STICKY_TRACK_VIEW_PROFILE_ERROR =
  'CoreStateless.forRequest().trackView() could not derive a profile from the sticky Experience response. Pass `payload.profile.id` explicitly if you need a fallback.'

const requireInsightsProfile = (
  profile: PartialProfile | undefined,
  errorMessage: string,
): PartialProfile => {
  if (profile !== undefined) return profile

  throw new Error(errorMessage)
}

/**
 * Stateless request scope created by {@link CoreStateless.forRequest}.
 *
 * @public
 */
export class CoreStatelessRequestScope {
  private readonly core: CoreStateless
  private readonly options: Readonly<CoreStatelessRequestOptions>

  constructor(core: CoreStateless, options: CoreStatelessRequestOptions = {}) {
    this.core = core
    this.options = Object.freeze({ ...options })
  }

  async identify(
    payload: StatelessExperiencePayload<IdentifyBuilderArgs>,
  ): Promise<OptimizationData> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      this.core.eventBuilder.buildIdentify(builderArgs),
      profile,
    )
  }

  async page(
    payload: StatelessExperiencePayload<PageViewBuilderArgs> = {},
  ): Promise<OptimizationData> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      this.core.eventBuilder.buildPageView(builderArgs),
      profile,
    )
  }

  async screen(
    payload: StatelessExperiencePayload<ScreenViewBuilderArgs>,
  ): Promise<OptimizationData> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      this.core.eventBuilder.buildScreenView(builderArgs),
      profile,
    )
  }

  async track(payload: StatelessExperiencePayload<TrackBuilderArgs>): Promise<OptimizationData> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(this.core.eventBuilder.buildTrack(builderArgs), profile)
  }

  /**
   * Record an entry view in a stateless runtime.
   *
   * @remarks
   * Non-sticky entry views require `payload.profile.id` for Insights delivery.
   * Sticky entry views may omit `profile`, because the returned Experience
   * profile is reused for the paired Insights event.
   */
  async trackView(
    payload: StatelessStickyTrackViewPayload | StatelessNonStickyTrackViewPayload,
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload
    let result: OptimizationData | undefined = undefined
    let insightsProfile: PartialProfile | undefined = profile

    if (payload.sticky) {
      result = await this.sendExperienceEvent(
        this.core.eventBuilder.buildView(builderArgs),
        profile,
      )
      const { profile: responseProfile } = result
      insightsProfile = responseProfile
    }

    await this.sendInsightsEvent(
      this.core.eventBuilder.buildView(builderArgs),
      requireInsightsProfile(
        insightsProfile,
        payload.sticky ? STICKY_TRACK_VIEW_PROFILE_ERROR : NON_STICKY_TRACK_VIEW_PROFILE_ERROR,
      ),
    )

    return result
  }

  /**
   * Record an entry click in a stateless runtime.
   *
   * @remarks
   * Stateless Insights delivery requires `payload.profile.id`.
   */
  async trackClick(payload: StatelessInsightsPayload<ClickBuilderArgs>): Promise<void> {
    const { profile, ...builderArgs } = payload

    await this.sendInsightsEvent(
      this.core.eventBuilder.buildClick(builderArgs),
      requireInsightsProfile(profile, TRACK_CLICK_PROFILE_ERROR),
    )
  }

  /**
   * Record an entry hover in a stateless runtime.
   *
   * @remarks
   * Stateless Insights delivery requires `payload.profile.id`.
   */
  async trackHover(payload: StatelessInsightsPayload<HoverBuilderArgs>): Promise<void> {
    const { profile, ...builderArgs } = payload

    await this.sendInsightsEvent(
      this.core.eventBuilder.buildHover(builderArgs),
      requireInsightsProfile(profile, TRACK_HOVER_PROFILE_ERROR),
    )
  }

  /**
   * Record a Custom Flag view in a stateless runtime.
   *
   * @remarks
   * Stateless Insights delivery requires `payload.profile.id`.
   */
  async trackFlagView(payload: StatelessInsightsPayload<FlagViewBuilderArgs>): Promise<void> {
    const { profile, ...builderArgs } = payload

    await this.sendInsightsEvent(
      this.core.eventBuilder.buildFlagView(builderArgs),
      requireInsightsProfile(profile, TRACK_FLAG_VIEW_PROFILE_ERROR),
    )
  }

  private async sendExperienceEvent(
    event: ExperienceEventPayload,
    profile?: PartialProfile,
  ): Promise<OptimizationData> {
    const intercepted = await this.core.interceptors.event.run(event)
    const validEvent = parseWithFriendlyError(ExperienceEventSchema, intercepted)

    return await this.core.api.experience.upsertProfile(
      {
        profileId: profile?.id,
        events: [validEvent],
      },
      this.options,
    )
  }

  private async sendInsightsEvent(
    event: InsightsEventPayload,
    profile: PartialProfile,
  ): Promise<void> {
    const intercepted = await this.core.interceptors.event.run(event)
    const validEvent = parseWithFriendlyError(InsightsEventSchema, intercepted)
    const batchEvent: BatchInsightsEventArray = parseWithFriendlyError(BatchInsightsEventArray, [
      { profile: parseWithFriendlyError(PartialProfile, profile), events: [validEvent] },
    ])

    await this.core.api.insights.sendBatchEvents(batchEvent)
  }
}
