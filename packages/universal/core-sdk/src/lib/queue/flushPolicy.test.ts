import {
  DEFAULT_QUEUE_FLUSH_POLICY,
  computeQueueFlushRetryDelayMs,
  createQueueFlushFailureWindow,
  resolveQueueFlushPolicy,
} from './flushPolicy'

describe('queue flush policy utils', () => {
  describe('resolveQueueFlushPolicy', () => {
    it('falls back to defaults for invalid values', () => {
      const resolved = resolveQueueFlushPolicy({
        baseBackoffMs: 0,
        maxBackoffMs: -1,
        jitterRatio: 2,
        maxConsecutiveFailures: 0,
        circuitOpenMs: Number.NaN,
      })

      expect(resolved).toEqual(
        expect.objectContaining({
          baseBackoffMs: DEFAULT_QUEUE_FLUSH_POLICY.baseBackoffMs,
          maxBackoffMs: DEFAULT_QUEUE_FLUSH_POLICY.maxBackoffMs,
          jitterRatio: 1,
          maxConsecutiveFailures: DEFAULT_QUEUE_FLUSH_POLICY.maxConsecutiveFailures,
          circuitOpenMs: DEFAULT_QUEUE_FLUSH_POLICY.circuitOpenMs,
        }),
      )
    })

    it('normalizes maxBackoffMs to at least baseBackoffMs', () => {
      const resolved = resolveQueueFlushPolicy({
        baseBackoffMs: 100,
        maxBackoffMs: 10,
      })

      expect(resolved.baseBackoffMs).toBe(100)
      expect(resolved.maxBackoffMs).toBe(100)
    })
  })

  describe('computeQueueFlushRetryDelayMs', () => {
    it('computes deterministic backoff when jitter ratio is zero', () => {
      const policy = resolveQueueFlushPolicy({
        baseBackoffMs: 10,
        maxBackoffMs: 40,
        jitterRatio: 0,
      })

      expect(computeQueueFlushRetryDelayMs({ consecutiveFailures: 1, policy })).toBe(10)
      expect(computeQueueFlushRetryDelayMs({ consecutiveFailures: 2, policy })).toBe(20)
      expect(computeQueueFlushRetryDelayMs({ consecutiveFailures: 3, policy })).toBe(40)
      expect(computeQueueFlushRetryDelayMs({ consecutiveFailures: 4, policy })).toBe(40)
    })
  })

  describe('createQueueFlushFailureWindow', () => {
    it('returns a retry window before circuit threshold is reached', () => {
      const failureWindow = createQueueFlushFailureWindow({
        consecutiveFailures: 1,
        failureTimestamp: 1_000,
        retryDelayMs: 250,
        policy: {
          maxConsecutiveFailures: 3,
          circuitOpenMs: 5_000,
        },
      })

      expect(failureWindow).toEqual({
        openedCircuit: false,
        retryDelayMs: 250,
        nextFlushAllowedAt: 1_250,
        circuitOpenUntil: 0,
      })
    })

    it('opens a circuit window when threshold is reached', () => {
      const failureWindow = createQueueFlushFailureWindow({
        consecutiveFailures: 3,
        failureTimestamp: 1_000,
        retryDelayMs: 250,
        policy: {
          maxConsecutiveFailures: 3,
          circuitOpenMs: 5_000,
        },
      })

      expect(failureWindow).toEqual({
        openedCircuit: true,
        retryDelayMs: 5_000,
        nextFlushAllowedAt: 6_000,
        circuitOpenUntil: 6_000,
      })
    })
  })
})
