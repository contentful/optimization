import {
  computeQueueFlushRetryDelayMs,
  createQueueFlushFailureWindow,
  type QueueFlushFailureContext,
  type QueueFlushRecoveredContext,
  type ResolvedQueueFlushPolicy,
} from './flushPolicy'

/**
 * Callback names for queue flush policy hooks.
 *
 * @internal
 */
export type QueueFlushCallbackName = 'onCircuitOpen' | 'onFlushFailure' | 'onFlushRecovered'

/**
 * Construction options for {@link QueueFlushRuntime}.
 *
 * @internal
 */
interface QueueFlushRuntimeOptions {
  onCallbackError?: (callbackName: QueueFlushCallbackName, error: unknown) => void
  onRetry: () => void
  policy: ResolvedQueueFlushPolicy
}

/**
 * Shared runtime state machine for queue flush retry, backoff, and circuit behavior.
 *
 * @internal
 */
export class QueueFlushRuntime {
  private circuitOpenUntil = 0
  private flushFailureCount = 0
  private flushInFlight = false
  private nextFlushAllowedAt = 0
  private readonly onCallbackError?: QueueFlushRuntimeOptions['onCallbackError']
  private readonly onRetry: QueueFlushRuntimeOptions['onRetry']
  private readonly policy: QueueFlushRuntimeOptions['policy']
  private retryTimer: ReturnType<typeof setTimeout> | undefined

  constructor(options: QueueFlushRuntimeOptions) {
    const { onCallbackError, onRetry, policy } = options

    this.policy = policy
    this.onRetry = onRetry
    this.onCallbackError = onCallbackError
  }

  /**
   * Reset runtime state and clear any scheduled retry.
   */
  reset(): void {
    this.clearScheduledRetry()

    this.circuitOpenUntil = 0
    this.flushFailureCount = 0
    this.flushInFlight = false
    this.nextFlushAllowedAt = 0
  }

  /**
   * Clear the scheduled retry timer, if any.
   */
  clearScheduledRetry(): void {
    if (this.retryTimer === undefined) return

    clearTimeout(this.retryTimer)
    this.retryTimer = undefined
  }

  /**
   * Determine whether to skip flush due to current state gates.
   *
   * @param options - Flush gate options.
   * @param options.force - When true, bypass online/backoff/circuit gates.
   * @param options.isOnline - Whether connectivity gates permit flushing.
   * @returns `true` when flush is skipped.
   */
  shouldSkip(options: { force: boolean; isOnline: boolean }): boolean {
    const { force, isOnline } = options

    if (this.flushInFlight) return true
    if (force) return false
    if (!isOnline) return true

    const now = Date.now()

    if (this.nextFlushAllowedAt > now) return true
    if (this.circuitOpenUntil > now) return true

    return false
  }

  /**
   * Mark a flush attempt as in flight.
   */
  markFlushStarted(): void {
    this.flushInFlight = true
  }

  /**
   * Mark a flush attempt as finished.
   */
  markFlushFinished(): void {
    this.flushInFlight = false
  }

  /**
   * Apply successful flush state transitions and invoke recovery callback as needed.
   */
  handleFlushSuccess(): void {
    const { flushFailureCount: previousConsecutiveFailures } = this

    this.clearScheduledRetry()

    this.circuitOpenUntil = 0
    this.flushFailureCount = 0
    this.nextFlushAllowedAt = 0

    if (previousConsecutiveFailures <= 0) return

    this.safeInvoke('onFlushRecovered', {
      consecutiveFailures: previousConsecutiveFailures,
    })
  }

  /**
   * Apply failed flush state transitions, invoke callbacks, and schedule retry.
   *
   * @param options - Failure inputs.
   * @param options.queuedBatches - Number of failed queued batches.
   * @param options.queuedEvents - Number of failed queued events.
   */
  handleFlushFailure(options: { queuedBatches: number; queuedEvents: number }): void {
    const { queuedBatches, queuedEvents } = options

    this.flushFailureCount += 1

    const retryDelayMs = computeQueueFlushRetryDelayMs({
      consecutiveFailures: this.flushFailureCount,
      policy: this.policy,
    })
    const failureTimestamp = Date.now()
    const failureContext: QueueFlushFailureContext = {
      consecutiveFailures: this.flushFailureCount,
      queuedBatches,
      queuedEvents,
      retryDelayMs,
    }

    this.safeInvoke('onFlushFailure', failureContext)

    const failureWindow = createQueueFlushFailureWindow({
      consecutiveFailures: this.flushFailureCount,
      failureTimestamp,
      retryDelayMs,
      policy: this.policy,
    })
    const {
      circuitOpenUntil,
      nextFlushAllowedAt,
      openedCircuit,
      retryDelayMs: scheduledRetryDelayMs,
    } = failureWindow

    this.nextFlushAllowedAt = nextFlushAllowedAt

    if (openedCircuit) {
      this.circuitOpenUntil = circuitOpenUntil
      this.safeInvoke('onCircuitOpen', {
        ...failureContext,
        retryDelayMs: scheduledRetryDelayMs,
      })
    }

    this.scheduleRetry(scheduledRetryDelayMs)
  }

  /**
   * Schedule a later flush attempt.
   *
   * @param delayMs - Delay in milliseconds before next attempt.
   */
  private scheduleRetry(delayMs: number): void {
    this.clearScheduledRetry()

    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      this.onRetry()
    }, delayMs)
  }

  /**
   * Invoke a policy callback in a fault-tolerant manner.
   *
   * @param callbackName - Callback key.
   * @param payload - Callback payload.
   */
  private safeInvoke(
    ...args:
      | ['onFlushRecovered', QueueFlushRecoveredContext]
      | ['onCircuitOpen' | 'onFlushFailure', QueueFlushFailureContext]
  ): void {
    const [callbackName, payload] = args

    try {
      if (callbackName === 'onFlushRecovered') {
        this.policy.onFlushRecovered?.(payload)
        return
      }

      if (callbackName === 'onCircuitOpen') {
        this.policy.onCircuitOpen?.(payload)
        return
      }

      this.policy.onFlushFailure?.(payload)
    } catch (error) {
      this.onCallbackError?.(callbackName, error)
    }
  }
}
