import type {
  AudienceEntry,
  EntryReplacementVariant,
  ExperienceEvent,
  InsightsEvent,
  OptimizationEntry,
  SelectedOptimization,
} from '@contentful/optimization-api-client/api-schemas'
import type { Entry } from 'contentful'

export type ContentfulEntry = Entry

/**
 * Opaque identifier for a runtime-owned optimization context.
 *
 * @public
 */
export type OptimizationContextId = string

/**
 * Runtime context attached to SDK event-stream emissions for optimized entry interactions.
 *
 * @public
 */
export interface EventOptimizationContext {
  readonly contextId: OptimizationContextId
  readonly selectedOptimization: SelectedOptimization
  readonly optimizationEntry: OptimizationEntry
  readonly audienceEntry?: AudienceEntry
  readonly baselineEntry: ContentfulEntry
  readonly resolvedEntry: ContentfulEntry
  readonly selectedVariant?: EntryReplacementVariant
}

/**
 * Event emitted through {@link CoreStateful.states | CoreStateful.states.eventStream}.
 *
 * @public
 */
export type OptimizationEventStreamEvent = (InsightsEvent | ExperienceEvent) & {
  readonly optimization?: EventOptimizationContext
}
