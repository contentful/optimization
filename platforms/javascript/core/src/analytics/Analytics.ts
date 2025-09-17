import ProductBase, { type ConsentGuard } from '../ProductBase'
import type ApiClient from '../lib/api-client'
import type { ComponentViewBuilderArgs, EventBuilder } from '../lib/api-client/builders'
import { InsightsEvent } from '../lib/api-client/insights/dto/event/InsightsEvent'
import { guardedBy } from '../lib/decorators'
import { logger } from '../lib/logger'
import { consent, effect, event as eventSignal, profile as profileSignal } from '../signals'
import type { EventHandler } from './EventHandler'

class Analytics extends ProductBase<InsightsEvent> implements ConsentGuard {
  private readonly eventHandler: EventHandler

  constructor(api: ApiClient, builder: EventBuilder, eventHandler: EventHandler) {
    super(api, builder)
    this.eventHandler = eventHandler

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

  @guardedBy('hasNoConsent')
  public async trackComponentView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.debug(`[Analytics] Processing "component view" event`)
    await this.sendEvent(this.builder.buildComponentView(args))
  }

  @guardedBy('hasNoConsent')
  public async trackFlagView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.debug(`[Analytics] Processing "flag view" event`)
    await this.sendEvent(this.builder.buildFlagView(args))
  }

  private async sendEvent(event: InsightsEvent): Promise<void> {
    const { value: profile } = profileSignal

    if (!profile) {
      logger.warn('Attempting to emit an event without an Optimization profile')

      return
    }

    const interceptedEvent = await this.interceptor.event.run(event)

    const validEvent = InsightsEvent.parse(interceptedEvent)

    eventSignal.value = validEvent

    await this.eventHandler.send(profile, validEvent)
  }
}

export default Analytics
