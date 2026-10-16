import type { OptimizationData } from '../api-schemas'

/**
 * Result returned by Experience-event methods.
 *
 * @remarks
 * `{ accepted: false }` means consent or SDK guards blocked the event.
 * `{ accepted: true, data }` means the SDK accepted the event. Accepted
 * queued/offline events may not have data yet.
 *
 * @public
 */
export type EventEmissionResult<TData = OptimizationData> =
  | {
      readonly accepted: false
      readonly data?: never
    }
  | {
      readonly accepted: true
      readonly data?: TData
    }
