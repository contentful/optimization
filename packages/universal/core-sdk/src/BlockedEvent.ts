/**
 * Reasons why an event was blocked before being sent.
 *
 * @public
 */
export type BlockedEventReason = 'consent'

/**
 * Payload emitted when event processing is blocked.
 *
 * @public
 */
export interface BlockedEvent {
  /** Why the event was blocked. */
  reason: BlockedEventReason
  /** Method name that was blocked. */
  method: string
  /** Original arguments passed to the blocked method call. */
  args: readonly unknown[]
}
