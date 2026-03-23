import { toPositiveInt, toRatio } from '../number'

/**
 * Context payload emitted when a queue flush fails.
 *
 * @public
 */
export interface QueueFlushFailureContext {
  /** Number of consecutive failed flush attempts. */
  consecutiveFailures: number
  /** Number of queued batches at the time of the failed attempt. */
  queuedBatches: number
  /** Number of queued events at the time of the failed attempt. */
  queuedEvents: number
  /** Delay before the next retry attempt is scheduled. */
  retryDelayMs: number
}

/**
 * Context payload emitted when a failed queue flush sequence recovers.
 *
 * @public
 */
export interface QueueFlushRecoveredContext {
  /** Consecutive failure count that existed immediately before recovery. */
  consecutiveFailures: number
}

/**
 * Policy options for controlling queue flush retry behavior.
 *
 * @public
 */
export interface QueueFlushPolicy {
  /**
   * Periodic flush interval in milliseconds while events remain queued.
   *
   * @defaultValue `30000`
   */
  flushIntervalMs?: number

  /**
   * Base retry backoff delay in milliseconds.
   *
   * @defaultValue `500`
   */
  baseBackoffMs?: number

  /**
   * Maximum retry backoff delay in milliseconds.
   *
   * @defaultValue `30000`
   */
  maxBackoffMs?: number

  /**
   * Jitter ratio applied to retry delay to avoid synchronized retries.
   *
   * @remarks
   * Value is clamped to `[0, 1]`.
   *
   * @defaultValue `0.2`
   */
  jitterRatio?: number

  /**
   * Consecutive failures threshold before opening the circuit window.
   *
   * @defaultValue `8`
   */
  maxConsecutiveFailures?: number

  /**
   * Duration in milliseconds to wait before retrying after circuit opens.
   *
   * @defaultValue `120000`
   */
  circuitOpenMs?: number

  /**
   * Callback invoked after each failed flush attempt.
   */
  onFlushFailure?: (context: QueueFlushFailureContext) => void

  /**
   * Callback invoked when the circuit opens after consecutive failures.
   */
  onCircuitOpen?: (context: QueueFlushFailureContext) => void

  /**
   * Callback invoked when a flush succeeds after previous failures.
   */
  onFlushRecovered?: (context: QueueFlushRecoveredContext) => void
}

interface QueueFlushDefaults {
  flushIntervalMs: number
  baseBackoffMs: number
  maxBackoffMs: number
  jitterRatio: number
  maxConsecutiveFailures: number
  circuitOpenMs: number
}

/**
 * Default queue flush policy values.
 *
 * @internal
 */
export const DEFAULT_QUEUE_FLUSH_POLICY: QueueFlushDefaults = {
  flushIntervalMs: 30_000,
  baseBackoffMs: 500,
  maxBackoffMs: 30_000,
  jitterRatio: 0.2,
  maxConsecutiveFailures: 8,
  circuitOpenMs: 120_000,
}

/**
 * Internal normalized shape of queue flush policy values.
 *
 * @internal
 */
export interface ResolvedQueueFlushPolicy {
  flushIntervalMs: number
  baseBackoffMs: number
  maxBackoffMs: number
  jitterRatio: number
  maxConsecutiveFailures: number
  circuitOpenMs: number
  onCircuitOpen?: QueueFlushPolicy['onCircuitOpen']
  onFlushFailure?: QueueFlushPolicy['onFlushFailure']
  onFlushRecovered?: QueueFlushPolicy['onFlushRecovered']
}

/**
 * Resolve and normalize queue flush policy values.
 *
 * @param policy - Candidate queue flush policy configuration.
 * @param defaults - Optional fallback defaults.
 * @returns Normalized queue flush policy.
 *
 * @internal
 */
export const resolveQueueFlushPolicy = (
  policy: QueueFlushPolicy | undefined,
  defaults: QueueFlushDefaults = DEFAULT_QUEUE_FLUSH_POLICY,
): ResolvedQueueFlushPolicy => {
  const configuredPolicy: QueueFlushPolicy = policy ?? {}
  const baseBackoffMs = toPositiveInt(configuredPolicy.baseBackoffMs, defaults.baseBackoffMs)
  const maxBackoffMs = Math.max(
    baseBackoffMs,
    toPositiveInt(configuredPolicy.maxBackoffMs, defaults.maxBackoffMs),
  )

  return {
    flushIntervalMs: toPositiveInt(configuredPolicy.flushIntervalMs, defaults.flushIntervalMs),
    baseBackoffMs,
    maxBackoffMs,
    jitterRatio: toRatio(configuredPolicy.jitterRatio, defaults.jitterRatio),
    maxConsecutiveFailures: toPositiveInt(
      configuredPolicy.maxConsecutiveFailures,
      defaults.maxConsecutiveFailures,
    ),
    circuitOpenMs: toPositiveInt(configuredPolicy.circuitOpenMs, defaults.circuitOpenMs),
    onCircuitOpen: configuredPolicy.onCircuitOpen,
    onFlushFailure: configuredPolicy.onFlushFailure,
    onFlushRecovered: configuredPolicy.onFlushRecovered,
  }
}

/**
 * Compute retry delay in milliseconds using exponential backoff plus jitter.
 *
 * @param options - Retry delay inputs.
 * @returns Backoff delay in milliseconds.
 *
 * @internal
 */
export const computeQueueFlushRetryDelayMs = (options: {
  consecutiveFailures: number
  policy: Pick<ResolvedQueueFlushPolicy, 'baseBackoffMs' | 'maxBackoffMs' | 'jitterRatio'>
}): number => {
  const {
    consecutiveFailures,
    policy: { baseBackoffMs, jitterRatio, maxBackoffMs },
  } = options
  const exponential = baseBackoffMs * 2 ** Math.max(0, consecutiveFailures - 1)
  const capped = Math.min(maxBackoffMs, exponential)
  const jitter = capped * jitterRatio * Math.random()

  return Math.round(capped + jitter)
}

/**
 * Derived retry scheduling state after a failed flush attempt.
 *
 * @internal
 */
export interface QueueFlushFailureWindow {
  openedCircuit: boolean
  retryDelayMs: number
  nextFlushAllowedAt: number
  circuitOpenUntil: number
}

/**
 * Create the next retry scheduling window from a failed flush attempt.
 *
 * @param options - Failure window inputs.
 * @returns Derived retry scheduling state.
 *
 * @internal
 */
export const createQueueFlushFailureWindow = (options: {
  consecutiveFailures: number
  failureTimestamp: number
  retryDelayMs: number
  policy: Pick<ResolvedQueueFlushPolicy, 'maxConsecutiveFailures' | 'circuitOpenMs'>
}): QueueFlushFailureWindow => {
  const {
    consecutiveFailures,
    failureTimestamp,
    retryDelayMs,
    policy: { maxConsecutiveFailures, circuitOpenMs },
  } = options

  if (consecutiveFailures < maxConsecutiveFailures) {
    return {
      openedCircuit: false,
      retryDelayMs,
      nextFlushAllowedAt: failureTimestamp + retryDelayMs,
      circuitOpenUntil: 0,
    }
  }

  const circuitOpenUntil = failureTimestamp + circuitOpenMs

  return {
    openedCircuit: true,
    retryDelayMs: circuitOpenMs,
    nextFlushAllowedAt: circuitOpenUntil,
    circuitOpenUntil,
  }
}
