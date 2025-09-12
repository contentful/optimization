import type { ComponentViewBuilderArgs } from '../lib/api-client/builders'
import { ComponentViewEvent } from '../lib/api-client/experience/dto/event'
import { BatchInsightsEventArray, type InsightsEvent } from '../lib/api-client/insights/dto/event'
import { guardedBy } from '../lib/decorators'
import { logger } from '../lib/logger'
import { event as eventSignal, profile as profileSignal } from '../signals'
import AnalyticsBase from './AnalyticsBase'

class AnalyticsStateless extends AnalyticsBase {
  @guardedBy('hasNoConsent')
  async trackComponentView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.info(`[Analytics] Processing "component view" event`)

    const event = this.builder.buildComponentView(args)

    const intercepted = await this.interceptor.event.run(event)

    const parsed = ComponentViewEvent.parse(intercepted)

    eventSignal.value = parsed

    await this.#sendBatchEvent(parsed)
  }

  @guardedBy('hasNoConsent')
  async trackFlagView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.debug(`[Analytics] Processing "flag view" event`)

    const event = this.builder.buildFlagView(args)

    const intercepted = await this.interceptor.event.run(event)

    const parsed = ComponentViewEvent.parse(intercepted)

    eventSignal.value = parsed

    await this.#sendBatchEvent(parsed)
  }

  async #sendBatchEvent(event: InsightsEvent): Promise<void> {
    const batchEvent: BatchInsightsEventArray = BatchInsightsEventArray.parse([
      {
        profile: profileSignal.value,
        events: [event],
      },
    ])

    await this.api.insights.sendBatchEvents(batchEvent)
  }
}

export default AnalyticsStateless
