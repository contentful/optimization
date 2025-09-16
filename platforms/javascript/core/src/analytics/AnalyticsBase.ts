import ProductBase, { type ConsentGuard } from '../ProductBase'
import type ApiClient from '../lib/api-client'
import type { EventBuilder } from '../lib/api-client/builders'
import type { Profile } from '../lib/api-client/experience/dto/profile'
import { InsightsEvent } from '../lib/api-client/insights/dto/event/InsightsEvent'

import { logger } from '../lib/logger'
import { consent, effect, event as eventSignal, profile as profileSignal } from '../signals'
import type { EventHandler } from './utils'

abstract class AnalyticsBase extends ProductBase<InsightsEvent> implements ConsentGuard {
  constructor(api: ApiClient, builder: EventBuilder) {
    super(api, builder)

    effect(() => {
      const id = profileSignal.value?.id

      logger.info(
        `[Analytics] Analytics ${consent.value ? 'will' : 'will not'} be collected due to consent (${consent.value})`,
      )

      logger.info(`[Analytics] Profile ${id && `with ID ${id}`} has been ${id ? 'set' : 'cleared'}`)
    })
  }

  onBlockedByConsent(name: string, args: unknown[]): void {
    logger.warn(
      `[Anaylytics] Event "${name}" was blocked due to lack of consent; args: ${JSON.stringify(args)}`,
    )
  }

  protected async sendEvent(event: InsightsEvent): Promise<void> {
    const { value: profile } = profileSignal

    if (!profile) {
      logger.warn('Attempting to emit an event without an Optimization profile')

      return
    }

    const interceptedEvent = await this.interceptor.event.run(event)

    const validEvent = InsightsEvent.parse(interceptedEvent)

    eventSignal.value = validEvent

    await this.events.send(profile, validEvent)
  }

  abstract trackComponentView(...args: unknown[]): Promise<void> | void
  abstract trackFlagView(...args: unknown[]): Promise<void> | void
  protected abstract events: EventHandler<Profile, InsightsEvent>
}

export default AnalyticsBase
