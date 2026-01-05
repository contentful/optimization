import {
  type ComponentViewBuilderArgs,
  ComponentViewEvent,
  type IdentifyBuilderArgs,
  IdentifyEvent,
  type OptimizationData,
  type PageViewBuilderArgs,
  PageViewEvent,
  type PartialProfile,
  type ExperienceEvent as PersonalizationEvent,
  type TrackBuilderArgs,
  TrackEvent,
} from '@contentful/optimization-api-client'
import { logger } from 'logger'
import PersonalizationBase from './PersonalizationBase'

/**
 * Stateless personalization implementation that immediately validates and sends
 * a single event to the Experience API, upserting the profile as needed.
 *
 * @public
 * @remarks
 * Each public method constructs a strongly-typed event via the shared builder,
 * runs it through event interceptors, and performs a profile upsert using the
 * Experience API. If an anonymous ID is available from the builder, it will be
 * preferred as the `profileId` unless an explicit profile is provided.
 */
class PersonalizationStateless extends PersonalizationBase {
  /**
   * Identify the current profile/visitor to associate traits with a profile.
   *
   * @param payload - Identify builder arguments with an optional partial
   * profile to attach to the upsert request.
   * @returns The resulting {@link OptimizationData} for the identified user.
   */
  async identify(
    payload: IdentifyBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData> {
    logger.info('[Personalization] Sending "identify" event')

    const { profile, ...builderArgs } = payload

    const event = IdentifyEvent.parse(this.builder.buildIdentify(builderArgs))

    return await this.upsertProfile(event, profile)
  }

  /**
   * Record a page view.
   *
   * @param payload - Page view builder arguments with an optional partial profile.
   * @returns The evaluated {@link OptimizationData} for this page view.
   */
  async page(
    payload: PageViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData> {
    logger.info('[Personalization] Sending "page" event')

    const { profile, ...builderArgs } = payload

    const event = PageViewEvent.parse(this.builder.buildPageView(builderArgs))

    return await this.upsertProfile(event, profile)
  }

  /**
   * Record a custom track event.
   *
   * @param payload - Track builder arguments with an optional partial profile.
   * @returns The evaluated {@link OptimizationData} for this event.
   */
  async track(payload: TrackBuilderArgs & { profile?: PartialProfile }): Promise<OptimizationData> {
    logger.info(`[Personalization] Sending "track" event "${payload.event}"`)

    const { profile, ...builderArgs } = payload

    const event = TrackEvent.parse(this.builder.buildTrack(builderArgs))

    return await this.upsertProfile(event, profile)
  }

  /**
   * Record a "sticky" component view.
   *
   * @param payload - Component view builder arguments with an optional partial profile.
   * @returns The evaluated {@link OptimizationData} for this component view.
   */
  async trackComponentView(
    payload: ComponentViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData> {
    logger.info(`[Personalization] Sending "track personalization" event`)

    const { profile, ...builderArgs } = payload

    const event = ComponentViewEvent.parse(this.builder.buildComponentView(builderArgs))

    return await this.upsertProfile(event, profile)
  }

  /**
   * Intercept, validate, and upsert the profile with a single personalization
   * event.
   *
   * @param event - The {@link PersonalizationEvent} to submit.
   * @param profile - Optional partial profile. If omitted, the anonymous ID from
   * the builder (when present) is used as the `profileId`.
   * @returns The {@link OptimizationData} returned by the Experience API.
   * @internal
   */
  private async upsertProfile(
    event: PersonalizationEvent,
    profile?: PartialProfile,
  ): Promise<OptimizationData> {
    const intercepted = await this.interceptor.event.run(event)

    const data = await this.api.experience.upsertProfile({
      profileId: profile?.id,
      events: [intercepted],
    })

    return data
  }
}

export default PersonalizationStateless
