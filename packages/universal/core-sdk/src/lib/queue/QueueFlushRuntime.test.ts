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

  it('joins an active attempt before evaluating gates and starts attempts synchronously', async () => {
    const runtime = new QueueFlushRuntime({
      policy: resolveQueueFlushPolicy(undefined),
      onRetry: rs.fn(),
    })
    const pending = Promise.withResolvers<undefined>()
    const attempt = rs.fn(async () => {
      await pending.promise
    })
    const gates = { force: false, isOnline: true }
    const first = runtime.runFlush(gates, attempt)
    let joined = false
    const second = runtime.runFlush({ force: false, isOnline: false }, attempt).then(() => {
      joined = true
    })

    expect(attempt).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(joined).toBe(false)
    pending.resolve(undefined)
    await Promise.all([first, second])
    expect(joined).toBe(true)
  })

  it('reserves joining before synchronous attempt observers run', async () => {
    const runtime = new QueueFlushRuntime({
      policy: resolveQueueFlushPolicy(undefined),
      onRetry: rs.fn(),
    })
    const pending = Promise.withResolvers<undefined>()
    const unexpectedAttempt = rs.fn(async () => {
      await Promise.resolve(undefined)
    })
    let joined: Promise<void> | undefined
    const first = runtime.runFlush({ force: false, isOnline: true }, async () => {
      joined = runtime.runFlush({ force: true, isOnline: true }, unexpectedAttempt)
      await pending.promise
    })

    expect(unexpectedAttempt).not.toHaveBeenCalled()
    pending.resolve(undefined)
    await first
    await joined
  })

  it('detaches reset attempts without letting their completion clear a fresh attempt', async () => {
    const runtime = new QueueFlushRuntime({
      policy: resolveQueueFlushPolicy(undefined),
      onRetry: rs.fn(),
    })
    const old = Promise.withResolvers<undefined>()
    const fresh = Promise.withResolvers<undefined>()
    const gates = { force: false, isOnline: true }
    const first = runtime.runFlush(gates, async () => {
      await old.promise
    })
    runtime.reset()
    const second = runtime.runFlush(gates, async () => {
      await fresh.promise
    })
    old.resolve(undefined)
    await first

    const unexpectedAttempt = rs.fn(async () => {
      await Promise.resolve(undefined)
    })
    const third = runtime.runFlush(gates, unexpectedAttempt)
    expect(unexpectedAttempt).not.toHaveBeenCalled()
    fresh.resolve(undefined)
    await Promise.all([second, third])
  })

  it('skips offline attempts and allows force bypass', async () => {
    const runtime = new QueueFlushRuntime({
      policy: resolveQueueFlushPolicy(undefined),
      onRetry: rs.fn(),
    })
    const attempt = rs.fn(async () => {
      await Promise.resolve(undefined)
    })
    await runtime.runFlush({ force: false, isOnline: false }, attempt)
    expect(attempt).not.toHaveBeenCalled()
    await runtime.runFlush({ force: true, isOnline: false }, attempt)
    expect(attempt).toHaveBeenCalledTimes(1)
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
    const attempt = rs.fn(async () => {
      await Promise.resolve(undefined)
    })
    await runtime.runFlush({ force: false, isOnline: true }, attempt)
    expect(attempt).not.toHaveBeenCalled()

    runtime.handleFlushSuccess()
    await runtime.runFlush({ force: false, isOnline: true }, attempt)
    expect(attempt).toHaveBeenCalledTimes(1)
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
