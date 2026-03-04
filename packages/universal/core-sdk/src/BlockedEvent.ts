/**
 * Reasons why an event was blocked before being sent.
 *
 * @public
 */
export type BlockedEventReason = 'consent'

/**
 * Product that blocked the event.
 *
 * @public
 */
export type BlockedEventProduct = 'analytics' | 'personalization'

/**
 * Payload emitted when event processing is blocked.
 *
 * @public
 */
export interface BlockedEvent {
  /** Why the event was blocked. */
  reason: BlockedEventReason
  /** Product that blocked the event. */
  product: BlockedEventProduct
  /** Method name that was blocked. */
  method: string
  /** Original arguments passed to the blocked method call. */
  args: readonly unknown[]
}
