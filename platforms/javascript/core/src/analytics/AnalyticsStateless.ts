import type { ComponentViewBuilderArgs } from '../lib/api-client/builders'
import type { Profile } from '../lib/api-client/experience/dto/profile/Profile'
import type { InsightsEvent } from '../lib/api-client/insights/dto/event'
import { guardedBy } from '../lib/decorators'
import { logger } from '../lib/logger'
import AnalyticsBase from './AnalyticsBase'
import { Stateless } from './utils'

class AnalyticsStateless extends AnalyticsBase {
  events: Stateless<Profile, InsightsEvent> = new Stateless<Profile, InsightsEvent>(
    async (batches) => {
      await this.api.insights.sendBatchEvents(
        batches.map(([profile, events]) => ({ profile, events })),
      )
    },
  )

  @guardedBy('hasNoConsent')
  async trackComponentView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.info(`[Analytics] Processing "component view" event`)
    await this.sendEvent(this.builder.buildComponentView(args))
  }

  @guardedBy('hasNoConsent')
  async trackFlagView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.debug(`[Analytics] Processing "flag view" event`)
    await this.sendEvent(this.builder.buildFlagView(args))
  }
}

export default AnalyticsStateless
