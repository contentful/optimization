import { isEqual } from 'es-toolkit'
import type ApiClient from '../lib/api-client'
import type { OptimizationData } from '../lib/api-client'
import {
  ComponentViewEvent,
  IdentifyEvent,
  PageViewEvent,
  TrackEvent,
  type ExperienceEvent,
} from '../lib/api-client/experience/dto/event'
import type {
  ComponentViewBuilderArgs,
  EventBuilder,
  IdentifyBuilderArgs,
  PageViewBuilderArgs,
  TrackBuilderArgs,
} from '../lib/builders'
import { guardedBy } from '../lib/decorators'
import { logger } from '../lib/logger'
import ProductBase, { type ConsentGuard } from '../ProductBase'
import {
  batch,
  changes as changesSignal,
  consent,
  effect,
  event as eventSignal,
  profile as profileSignal,
  variants as variantsSignal,
} from '../signals'

class Personalization extends ProductBase<ExperienceEvent> implements ConsentGuard {
  constructor(api: ApiClient, builder: EventBuilder) {
    super(api, builder)

    effect(() => {
      logger.info(
        `[Personalization] Profile ${profileSignal.value && `with ID ${profileSignal.value.id}`} has been ${profileSignal.value ? 'set' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(
        `[Personalization] Variants have been ${variantsSignal.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(
        `[Personalization] Personalization ${consent.value ? 'will' : 'will not'} take effect due to consent (${consent.value})`,
      )
    })
  }

  onBlockedByConsent(name: string, args: unknown[]): void {
    logger.warn(
      `[Personalization] Event "${name}" was blocked due to lack of consent; args: ${JSON.stringify(args)}`,
    )
  }

  @guardedBy('hasNoConsent')
  async identify(args: IdentifyBuilderArgs & { anonymousId?: string }): Promise<OptimizationData> {
    logger.info('Sending "identify" event')

    const event = IdentifyEvent.parse(this.builder.buildIdentify(args))

    return await this.#upsertProfile(event)
  }

  @guardedBy('hasNoConsent')
  async page(args: PageViewBuilderArgs & { anonymousId?: string }): Promise<OptimizationData> {
    logger.info('Sending "page" event')

    const event = PageViewEvent.parse(this.builder.buildPageView(args))

    return await this.#upsertProfile(event)
  }

  @guardedBy('hasNoConsent')
  async track(args: TrackBuilderArgs & { anonymousId?: string }): Promise<OptimizationData> {
    logger.info(`Sending "track" event "${args.event}"`)

    const event = TrackEvent.parse(this.builder.buildTrack(args))

    return await this.#upsertProfile(event)
  }

  /** AKA sticky component view */
  @guardedBy('hasNoConsent')
  async trackPersonalization(
    args: ComponentViewBuilderArgs & { anonymousId?: string },
  ): Promise<OptimizationData> {
    logger.info(`Sending "track personalization" event`)

    const event = ComponentViewEvent.parse(this.builder.buildComponentView(args))

    return await this.#upsertProfile(event)
  }

  async #upsertProfile(event: ExperienceEvent, anonymousId?: string): Promise<OptimizationData> {
    const intercepted = await this.interceptor.event.run(event)

    eventSignal.value = intercepted

    const data = await this.api.experience.upsertProfile({
      profileId: anonymousId ?? profileSignal.value?.id,
      events: [intercepted],
    })

    await this.#updateOutputSignals(data)

    return data
  }

  async #updateOutputSignals(data: OptimizationData): Promise<void> {
    const intercepted = await this.interceptor.state.run(data)

    const { changes, variants: personalizations, profile } = intercepted

    batch(() => {
      if (!isEqual(changesSignal.value, changes)) changesSignal.value = changes
      if (!isEqual(variantsSignal.value, personalizations)) variantsSignal.value = personalizations
      if (!isEqual(profileSignal.value, profile)) profileSignal.value = profile
    })
  }
}

export default Personalization
