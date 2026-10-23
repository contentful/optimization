import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { EventOptimizationContext, OptimizationEventStreamEvent } from '../events'
import { event as eventSignal } from '../signals'

const logger = createScopedLogger('CoreStateful')

/** Publish diagnostic attempts without allowing observer failures to interrupt delivery. */
export function publishEventStream(
  event: OptimizationEventStreamEvent,
  optimizationContext?: EventOptimizationContext,
): void {
  try {
    eventSignal.value =
      optimizationContext === undefined ? event : { ...event, optimization: optimizationContext }
  } catch (error) {
    logger.warn('Event stream subscriber failed', error)
  }
}
