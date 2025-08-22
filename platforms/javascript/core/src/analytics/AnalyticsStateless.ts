import type { ProfileType } from '../lib/api-client/experience/dto/profile'
import {
  BatchEventArray,
  type BatchEventArrayType,
  type EventType,
} from '../lib/api-client/insights/dto/event'
import { logger } from '../lib/logger'
import AnalyticsBase from './AnalyticsBase'

class AnalyticsStateless extends AnalyticsBase {
  async track(event: EventType, profile: ProfileType): Promise<void> {
    logger.debug(`Processing ${event.type} event`, event)

    const batchEvents: BatchEventArrayType = BatchEventArray.parse([
      {
        profile,
        events: [event],
      },
    ])

    await this.api.insights.sendBatchEvents(batchEvents)
  }
}

export default AnalyticsStateless
