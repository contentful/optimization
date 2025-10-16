import {
  BatchInsightsEventArray,
  type ComponentViewBuilderArgs,
  ComponentViewEvent,
  type InsightsEvent,
} from '@contentful/optimization-api-client'
import { logger } from 'logger'
import { guardedBy } from '../lib/decorators'
import { event as eventSignal, profile as profileSignal } from '../signals'
import AnalyticsBase from './AnalyticsBase'

class AnalyticsStateless extends AnalyticsBase {
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackComponentView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.info(`[Analytics] Processing "component view" event`)

    const event = this.builder.buildComponentView(args)

    const intercepted = await this.interceptor.event.run(event)

    const parsed = ComponentViewEvent.parse(intercepted)

    eventSignal.value = parsed

    await this.sendBatchEvent(parsed)
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackFlagView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.debug(`[Analytics] Processing "flag view" event`)

    const event = this.builder.buildFlagView(args)

    const intercepted = await this.interceptor.event.run(event)

    const parsed = ComponentViewEvent.parse(intercepted)

    eventSignal.value = parsed

    await this.sendBatchEvent(parsed)
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async sendBatchEvent(event: InsightsEvent): Promise<void> {
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
