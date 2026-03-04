import type {
  ComponentViewBuilderArgs,
  IdentifyBuilderArgs,
  PageViewBuilderArgs,
  ScreenViewBuilderArgs,
  TrackBuilderArgs,
} from '@contentful/optimization-api-client'
import {
  ComponentViewEvent,
  IdentifyEvent,
  type OptimizationData,
  PageViewEvent,
  parseWithFriendlyError,
  type PartialProfile,
  ExperienceEvent as PersonalizationEvent,
  ScreenViewEvent,
  TrackEvent,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import PersonalizationBase from './PersonalizationBase'

const logger = createScopedLogger('Personalization')

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
   * @example
   * ```ts
   * const data = await personalization.identify({ userId: 'user-123', profile: { id: 'anon-1' } })
   * ```
   */
  async identify(
    payload: IdentifyBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData> {
    logger.info('Sending "identify" event')

    const { profile, ...builderArgs } = payload

    const event = parseWithFriendlyError(IdentifyEvent, this.builder.buildIdentify(builderArgs))

    return await this.upsertProfile(event, profile)
  }

  /**
   * Record a page view.
   *
   * @param payload - Page view builder arguments with an optional partial profile.
   * @returns The evaluated {@link OptimizationData} for this page view.
   * @example
   * ```ts
   * const data = await personalization.page({ properties: { title: 'Home' }, profile: { id: 'anon-1' } })
   * ```
   */
  async page(
    payload: PageViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData> {
    logger.info('Sending "page" event')

    const { profile, ...builderArgs } = payload

    const event = parseWithFriendlyError(PageViewEvent, this.builder.buildPageView(builderArgs))

    return await this.upsertProfile(event, profile)
  }

  /**
   * Record a screen view.
   *
   * @param payload - Screen view builder arguments with an optional partial profile.
   * @returns The evaluated {@link OptimizationData} for this screen view.
   * @example
   * ```ts
   * const data = await personalization.screen({ name: 'HomeScreen', profile: { id: 'anon-1' } })
   * ```
   */
  async screen(
    payload: ScreenViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData> {
    logger.info(`Sending "screen" event for "${payload.name}"`)

    const { profile, ...builderArgs } = payload

    const event = parseWithFriendlyError(ScreenViewEvent, this.builder.buildScreenView(builderArgs))

    return await this.upsertProfile(event, profile)
  }

  /**
   * Record a custom track event.
   *
   * @param payload - Track builder arguments with an optional partial profile.
   * @returns The evaluated {@link OptimizationData} for this event.
   * @example
   * ```ts
   * const data = await personalization.track({ event: 'purchase', profile: { id: 'anon-1' } })
   * ```
   */
  async track(payload: TrackBuilderArgs & { profile?: PartialProfile }): Promise<OptimizationData> {
    logger.info(`Sending "track" event "${payload.event}"`)

    const { profile, ...builderArgs } = payload

    const event = parseWithFriendlyError(TrackEvent, this.builder.buildTrack(builderArgs))

    return await this.upsertProfile(event, profile)
  }

  /**
   * Record a "sticky" component view.
   *
   * @param payload - Component view builder arguments with an optional partial profile.
   * @returns The evaluated {@link OptimizationData} for this component view.
   * @example
   * ```ts
   * const data = await personalization.trackComponentView({ componentId: 'hero', profile: { id: 'anon-1' } })
   * ```
   */
  async trackComponentView(
    payload: ComponentViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData> {
    logger.info('Sending "track personalization" event')

    const { profile, ...builderArgs } = payload

    const event = parseWithFriendlyError(
      ComponentViewEvent,
      this.builder.buildComponentView(builderArgs),
    )

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
    const intercepted = await this.interceptors.event.run(event)
    const validEvent = parseWithFriendlyError(PersonalizationEvent, intercepted)

    const data = await this.api.experience.upsertProfile({
      profileId: profile?.id,
      events: [validEvent],
    })

    return data
  }
}

export default PersonalizationStateless
