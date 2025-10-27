import {
  BatchInsightsEventArray,
  type ComponentViewBuilderArgs,
  ComponentViewEvent,
  type InsightsEvent,
  type Profile,
} from '@contentful/optimization-api-client'
import { logger } from 'logger'
import AnalyticsBase from './AnalyticsBase'

class AnalyticsStateless extends AnalyticsBase {
  async trackComponentView(args: ComponentViewBuilderArgs & { profile?: Profile }): Promise<void> {
    logger.info(`[Analytics] Processing "component view" event`)

    const { profile, ...builderArgs } = args

    const event = this.builder.buildComponentView(builderArgs)

    const intercepted = await this.interceptor.event.run(event)

    const parsed = ComponentViewEvent.parse(intercepted)

    await this.sendBatchEvent(parsed, profile)
  }

  async trackFlagView(args: ComponentViewBuilderArgs & { profile?: Profile }): Promise<void> {
    logger.debug(`[Analytics] Processing "flag view" event`)

    const { profile, ...builderArgs } = args

    const event = this.builder.buildFlagView(builderArgs)

    const intercepted = await this.interceptor.event.run(event)

    const parsed = ComponentViewEvent.parse(intercepted)

    await this.sendBatchEvent(parsed, profile)
  }

  async sendBatchEvent(event: InsightsEvent, profile?: Profile): Promise<void> {
    const batchEvent: BatchInsightsEventArray = BatchInsightsEventArray.parse([
      {
        profile,
        events: [event],
      },
    ])

    await this.api.insights.sendBatchEvents(batchEvent)
  }
}

export default AnalyticsStateless
