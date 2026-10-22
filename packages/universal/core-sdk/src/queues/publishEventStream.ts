import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { OptimizationEventStreamEvent } from '../events'
import { event as eventSignal } from '../signals'

const logger = createScopedLogger('CoreStateful')

/** Publish diagnostic attempts without allowing observer failures to interrupt delivery. */
export function publishEventStream(event: OptimizationEventStreamEvent): void {
  try {
    eventSignal.value = event
  } catch (error) {
    logger.warn('Event stream subscriber failed', error)
  }
}
