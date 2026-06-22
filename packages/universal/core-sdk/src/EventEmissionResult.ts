import type { OptimizationData } from './api-schemas'

/**
 * Result returned by internal event emission helpers that need to distinguish
 * accepted events from consent-blocked events.
 *
 * @internal
 */
export interface EventEmissionResult<TData = OptimizationData> {
  readonly accepted: boolean
  readonly data?: TData
}
