import type { ProfileType } from '../lib/api-client/experience/dto/profile'
import type { BatchEventType, EventType } from '../lib/api-client/insights/dto/event'
import { logger } from '../lib/logger'
import AnalyticsBase from './AnalyticsBase'

type BatchEventQueue = Map<string, BatchEventType>

class AnalyticsStateful extends AnalyticsBase {
  private readonly queue: BatchEventQueue = new Map()

  // TODO: get profile from store
  track(event: EventType, profile: ProfileType): void {
    logger.debug(`Queueing ${event.type} event for profile ${profile.id}`, event)

    const queueItem = this.queue.get(profile.id)

    if (queueItem) {
      queueItem.events.push(event)
    } else {
      this.queue.set(profile.id, { profile, events: [event] })
    }
  }

  // TODO: flush the queue
}

export default AnalyticsStateful
