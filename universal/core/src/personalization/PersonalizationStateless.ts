import {
  type ComponentViewBuilderArgs,
  ComponentViewEvent,
  type IdentifyBuilderArgs,
  IdentifyEvent,
  type OptimizationData,
  type PageViewBuilderArgs,
  PageViewEvent,
  type ExperienceEvent as PersonalizationEvent,
  type Profile,
  type TrackBuilderArgs,
  TrackEvent,
} from '@contentful/optimization-api-client'
import { logger } from 'logger'
import PersonalizationBase from './PersonalizationBase'

class PersonalizationStateless extends PersonalizationBase {
  async identify(
    args: IdentifyBuilderArgs & { profile?: Profile },
  ): Promise<OptimizationData | undefined> {
    logger.info('[Personalization] Sending "identify" event')

    const { profile } = args

    const event = IdentifyEvent.parse(this.builder.buildIdentify(args))

    return await this.#upsertProfile(event, profile)
  }

  async page(args: PageViewBuilderArgs & { profile?: Profile }): Promise<OptimizationData> {
    logger.info('[Personalization] Sending "page" event')

    const { profile } = args

    const event = PageViewEvent.parse(this.builder.buildPageView(args))

    return await this.#upsertProfile(event, profile)
  }

  async track(args: TrackBuilderArgs & { profile?: Profile }): Promise<OptimizationData> {
    logger.info(`[Personalization] Sending "track" event "${args.event}"`)

    const { profile } = args

    const event = TrackEvent.parse(this.builder.buildTrack(args))

    return await this.#upsertProfile(event, profile)
  }

  async trackComponentView(
    args: ComponentViewBuilderArgs & { profile?: Profile },
  ): Promise<OptimizationData> {
    logger.info(`[Personalization] Sending "track personalization" event`)

    const { profile } = args

    const event = ComponentViewEvent.parse(this.builder.buildComponentView(args))

    return await this.#upsertProfile(event, profile)
  }

  async #upsertProfile(event: PersonalizationEvent, profile?: Profile): Promise<OptimizationData> {
    const intercepted = await this.interceptor.event.run(event)

    const anonymousId = this.builder.getAnonymousId()
    if (anonymousId) logger.info('[Personalization] Anonymous ID found:', anonymousId)

    const data = await this.api.experience.upsertProfile({
      profileId: anonymousId ?? profile?.id,
      events: [intercepted],
    })

    return data
  }
}

export default PersonalizationStateless
