import type { QueueFlushFailureContext, QueueFlushRecoveredContext } from './flushPolicy'
import { resolveQueueFlushPolicy } from './flushPolicy'
import { QueueFlushRuntime } from './QueueFlushRuntime'

describe('QueueFlushRuntime', () => {
  beforeEach(() => {
    rs.useFakeTimers()
  })

  afterEach(() => {
    rs.clearAllTimers()
    rs.restoreAllMocks()
    rs.useRealTimers()
  })

  it('skips flush while in flight and allows force bypass', () => {
    const runtime = new QueueFlushRuntime({
      policy: resolveQueueFlushPolicy(undefined),
      onRetry: rs.fn(),
    })

    expect(runtime.shouldSkip({ force: false, isOnline: true })).toBe(false)

    runtime.markFlushStarted()
    expect(runtime.shouldSkip({ force: false, isOnline: true })).toBe(true)

    runtime.markFlushFinished()
    expect(runtime.shouldSkip({ force: true, isOnline: false })).toBe(false)
  })

  it('schedules retries and opens a circuit window at the failure threshold', async () => {
    const onRetry = rs.fn<() => void>()
    const onFlushFailure = rs.fn<(context: QueueFlushFailureContext) => void>()
    const onCircuitOpen = rs.fn<(context: QueueFlushFailureContext) => void>()
    const runtime = new QueueFlushRuntime({
      policy: resolveQueueFlushPolicy({
        baseBackoffMs: 10,
        maxBackoffMs: 10,
        jitterRatio: 0,
        maxConsecutiveFailures: 2,
        circuitOpenMs: 50,
        onCircuitOpen,
        onFlushFailure,
      }),
      onRetry,
    })

    runtime.handleFlushFailure({ queuedBatches: 1, queuedEvents: 3 })

    expect(onFlushFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutiveFailures: 1,
        queuedBatches: 1,
        queuedEvents: 3,
        retryDelayMs: 10,
      }),
    )
    expect(onCircuitOpen).not.toHaveBeenCalled()

    await rs.advanceTimersByTimeAsync(10)
    expect(onRetry).toHaveBeenCalledTimes(1)

    runtime.handleFlushFailure({ queuedBatches: 1, queuedEvents: 3 })

    expect(onCircuitOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutiveFailures: 2,
        queuedBatches: 1,
        queuedEvents: 3,
        retryDelayMs: 50,
      }),
    )

    await rs.advanceTimersByTimeAsync(50)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('clears pending backoff and emits recovery callback after success', async () => {
    const onRetry = rs.fn<() => void>()
    const onFlushRecovered = rs.fn<(context: QueueFlushRecoveredContext) => void>()
    const runtime = new QueueFlushRuntime({
      policy: resolveQueueFlushPolicy({
        baseBackoffMs: 10,
        maxBackoffMs: 10,
        jitterRatio: 0,
        onFlushRecovered,
      }),
      onRetry,
    })

    runtime.handleFlushFailure({ queuedBatches: 1, queuedEvents: 1 })
    expect(runtime.shouldSkip({ force: false, isOnline: true })).toBe(true)

    runtime.handleFlushSuccess()
    expect(runtime.shouldSkip({ force: false, isOnline: true })).toBe(false)
    expect(onFlushRecovered).toHaveBeenCalledWith({ consecutiveFailures: 1 })

    await rs.advanceTimersByTimeAsync(10)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('reports callback failures via onCallbackError', () => {
    const callbackError = new Error('callback-failed')
    const onCallbackError = rs.fn<(callbackName: string, error: unknown) => void>()
    const runtime = new QueueFlushRuntime({
      policy: resolveQueueFlushPolicy({
        onFlushFailure: () => {
          throw callbackError
        },
      }),
      onRetry: rs.fn(),
      onCallbackError,
    })

    runtime.handleFlushFailure({ queuedBatches: 1, queuedEvents: 1 })

    expect(onCallbackError).toHaveBeenCalledWith('onFlushFailure', callbackError)
  })
})
