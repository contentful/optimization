import { logger } from '../lib/logger'
import type ApiClient from '../lib/api-client'
import type { OptimizationDataType } from '../lib/api-client'
import type {
  ComponentViewBuilderArgs,
  EventBuilder,
  IdentifyBuilderArgs,
  PageViewBuilderArgs,
  TrackBuilderArgs,
} from '../lib/builders'
import { guardedBy } from '../lib/decorators'
import {
  batch,
  changes as changesSignal,
  consent,
  effect,
  experiences as experiencesSignal,
  profile as profileSignal,
} from '../signals'
import { isEqual } from 'es-toolkit'
import {
  ComponentViewEvent,
  IdentifyEvent,
  PageViewEvent,
  TrackEvent,
  type EventType,
} from '../lib/api-client/experience/dto/event'
import ProductBase, { type ConsentGuard } from '../ProductBase'

class Personalization extends ProductBase<EventType> implements ConsentGuard {
  constructor(api: ApiClient, builder: EventBuilder) {
    super(api, builder)

    effect(() => {
      logger.info(
        `[Personalization] Profile ${profileSignal.value && `with ID ${profileSignal.value.id}`} has been ${profileSignal.value ? 'set' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(
        `[Personalization] Experiences have been ${experiencesSignal.value?.length ? 'populated' : 'cleared'}`,
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
  async identify(
    args: IdentifyBuilderArgs & { anonymousId?: string },
  ): Promise<OptimizationDataType> {
    logger.info('Sending "identify" event')

    const event = IdentifyEvent.parse(this.builder.buildIdentify(args))

    return await this.#upsertProfile(event)
  }

  @guardedBy('hasNoConsent')
  async page(args: PageViewBuilderArgs & { anonymousId?: string }): Promise<OptimizationDataType> {
    logger.info('Sending "page" event')

    const event = PageViewEvent.parse(this.builder.buildPageView(args))

    return await this.#upsertProfile(event)
  }

  @guardedBy('hasNoConsent')
  async track(args: TrackBuilderArgs & { anonymousId?: string }): Promise<OptimizationDataType> {
    logger.info(`Sending "track" event "${args.event}"`)

    const event = TrackEvent.parse(this.builder.buildTrack(args))

    return await this.#upsertProfile(event)
  }

  /** AKA sticky component view */
  @guardedBy('hasNoConsent')
  async trackPersonalization(
    args: ComponentViewBuilderArgs & { anonymousId?: string },
  ): Promise<OptimizationDataType> {
    logger.info(`Sending "track personalization" event`)

    const event = ComponentViewEvent.parse(this.builder.buildComponentView(args))

    return await this.#upsertProfile(event)
  }

  async #upsertProfile(event: EventType, anonymousId?: string): Promise<OptimizationDataType> {
    const intercepted = await this.interceptor.event.run(event)

    const data = await this.api.experience.upsertProfile({
      profileId: anonymousId ?? profileSignal.value?.id,
      events: [intercepted],
    })

    await this.#updateSignals(data)

    return data
  }

  async #updateSignals(data: OptimizationDataType): Promise<void> {
    const intercepted = await this.interceptor.state.run(data)

    const { changes, experiences, profile } = intercepted

    batch(() => {
      if (!isEqual(changesSignal.value, changes)) changesSignal.value = changes
      if (!isEqual(experiencesSignal.value, experiences)) experiencesSignal.value = experiences
      if (!isEqual(profileSignal.value, profile)) profileSignal.value = profile
    })
  }
}

export default Personalization
