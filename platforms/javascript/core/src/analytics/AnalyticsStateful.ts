import type { ComponentViewBuilderArgs } from '../lib/api-client/builders'
import type { Profile } from '../lib/api-client/experience/dto/profile'
import type { InsightsEvent } from '../lib/api-client/insights/dto/event'
import { guardedBy } from '../lib/decorators'
import AnalyticsBase from './AnalyticsBase'
import { Stateful } from './utils'

class AnalyticsStateful extends AnalyticsBase {
  events: Stateful<Profile, InsightsEvent> = new Stateful<Profile, InsightsEvent>(
    async (batches) => {
      await this.api.insights.sendBatchEvents(
        batches.map(([profile, events]) => ({ profile, events })),
      )
    },
  )

  @guardedBy('hasNoConsent')
  async trackComponentView(args: ComponentViewBuilderArgs): Promise<void> {
    await this.sendEvent(this.builder.buildComponentView(args))
  }

  @guardedBy('hasNoConsent')
  async trackFlagView(args: ComponentViewBuilderArgs): Promise<void> {
    await this.sendEvent(this.builder.buildFlagView(args))
  }
}

export default AnalyticsStateful
