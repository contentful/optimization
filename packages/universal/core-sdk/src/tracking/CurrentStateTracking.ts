import type { OptimizationData } from '../api-schemas'

/**
 * Read-only lifecycle state for the current page or screen emission.
 *
 * @public
 */
export type CurrentStateTrackingState =
  | { readonly generation: number; readonly status: 'idle' }
  | {
      readonly generation: number
      readonly key: string
      readonly status: 'observed' | 'pending' | 'accepted'
    }

/**
 * Reason a current page or screen emission was not accepted.
 *
 * @public
 */
export type CurrentStateTrackingRejectionReason = 'already-accepted' | 'not-allowed' | 'superseded'

/**
 * Outcome of tracking the current page or screen.
 *
 * @public
 */
export type CurrentStateTrackingResult<TData = OptimizationData> =
  | { readonly accepted: true; readonly data?: TData }
  | { readonly accepted: false; readonly reason: CurrentStateTrackingRejectionReason }
