import { logger } from '@contentful/optimization-web/logger'
import { afterEach, describe, expect, it, rs } from '@rstest/core'
import type { OptimizationSdk } from '../context/OptimizationContext'
import { createOptimizationSdk } from '../test/sdkTestUtils'
import {
  createInitialExperienceClient,
  resolveInitialExperienceMaxWaitMs,
  runInitialExperience,
} from './initialExperience'

function createDeferred<T>(): {
  readonly promise: Promise<T>
  readonly reject: (error: unknown) => void
  readonly resolve: (value: T) => void
} {
  let rejectDeferred: ((error: unknown) => void) | undefined
  let resolveDeferred: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    rejectDeferred = reject
    resolveDeferred = resolve
  })

  return {
    promise,
    reject(error: unknown) {
      if (rejectDeferred === undefined) throw new Error('Expected deferred rejector.')
      rejectDeferred(error)
    },
    resolve(value: T) {
      if (resolveDeferred === undefined) throw new Error('Expected deferred resolver.')
      resolveDeferred(value)
    },
  }
}

describe('initial Experience', () => {
  afterEach(() => {
    rs.useRealTimers()
    rs.restoreAllMocks()
  })

  it('creates receiver-safe identify, screen, and track delegates', async () => {
    const identifyResult = { accepted: true as const }
    const screenError = new Error('screen failed')
    const trackResult = { accepted: false as const }
    const receivers: unknown[] = []
    const identify: OptimizationSdk['identify'] = rs.fn(async function (this: OptimizationSdk) {
      receivers.push(this)
      return await Promise.resolve(identifyResult)
    })
    const screen: OptimizationSdk['screen'] = rs.fn(async function (this: OptimizationSdk) {
      receivers.push(this)
      return await Promise.reject(screenError)
    })
    const track: OptimizationSdk['track'] = rs.fn(async function (this: OptimizationSdk) {
      receivers.push(this)
      return await Promise.resolve(trackResult)
    })
    const sdk = createOptimizationSdk({ identify, screen, track })
    const client = createInitialExperienceClient(sdk)
    const { identify: identifyDelegate, screen: screenDelegate, track: trackDelegate } = client

    await expect(identifyDelegate({ userId: 'user-1' })).resolves.toBe(identifyResult)
    await expect(screenDelegate({ name: 'Home', properties: {} })).rejects.toBe(screenError)
    await expect(trackDelegate({ event: 'ready' })).resolves.toBe(trackResult)

    expect(receivers).toEqual([sdk, sdk, sdk])
  })

  it.each([
    { configured: undefined, expected: 3_000 },
    { configured: 25, expected: 25 },
    { configured: 0.5, expected: 0.5 },
  ])('resolves an accepted max wait of $expected ms', ({ configured, expected }) => {
    expect(resolveInitialExperienceMaxWaitMs(configured)).toBe(expected)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid max wait %s',
    (maxWaitMs) => {
      expect(() => resolveInitialExperienceMaxWaitMs(maxWaitMs)).toThrow(
        new TypeError('initialExperience.maxWaitMs must be a positive finite number.'),
      )
    },
  )

  it.each([
    { configured: undefined, beforeDeadline: 2_999, deadline: 1 },
    { configured: 25, beforeDeadline: 24, deadline: 1 },
  ])(
    'waits for the returned work until the $configured watchdog expires',
    async ({ beforeDeadline, configured, deadline }) => {
      rs.useFakeTimers()
      const work = createDeferred<undefined>()
      const onError = rs.fn()
      const sdk = createOptimizationSdk()
      const running = runInitialExperience(
        sdk,
        {
          onError,
          run: async () => {
            await work.promise
            return 'ready'
          },
        },
        resolveInitialExperienceMaxWaitMs(configured),
      )

      await rs.advanceTimersByTimeAsync(beforeDeadline)
      expect(onError).not.toHaveBeenCalled()

      await rs.advanceTimersByTimeAsync(deadline)
      await running

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    },
  )

  it('assimilates a foreign thenable returned by the callback', async () => {
    const work = createDeferred<unknown>()
    const thenable: PromiseLike<unknown> = { then: work.promise.then.bind(work.promise) }
    const sdk = createOptimizationSdk()
    let settled = false
    const running = runInitialExperience(sdk, { run: () => thenable }, 25).then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    work.resolve('ready')
    await running

    expect(settled).toBe(true)
  })

  it('waits for composite returned work but not detached work', async () => {
    const first = createDeferred<undefined>()
    const second = createDeferred<undefined>()
    const detached = createDeferred<undefined>()
    let compositeSettled = false
    const sdk = createOptimizationSdk()
    const composite = runInitialExperience(
      sdk,
      {
        run: async () => {
          void detached.promise
          return await Promise.allSettled([first.promise, second.promise])
        },
      },
      25,
    ).then(() => {
      compositeSettled = true
    })

    first.resolve(undefined)
    await Promise.resolve()
    expect(compositeSettled).toBe(false)

    second.resolve(undefined)
    await composite
    expect(compositeSettled).toBe(true)

    await runInitialExperience(
      sdk,
      {
        run: () => {
          void detached.promise
        },
      },
      25,
    )
  })

  it.each([
    {
      name: 'synchronous throw',
      run(error: Error): undefined {
        throw error
      },
    },
    {
      name: 'rejected returned work',
      async run(error: Error): Promise<never> {
        return await Promise.reject(error)
      },
    },
  ])('reports one ordinary Error after a $name', async ({ run }) => {
    const callbackError = new Error('callback failed')
    const onError = rs.fn()

    await runInitialExperience(
      createOptimizationSdk(),
      {
        onError,
        run: (): ReturnType<typeof run> => {
          const result = run(callbackError)
          return result
        },
      },
      25,
    )

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(callbackError)
  })

  it('normalizes non-Error callback failures', async () => {
    const onError = rs.fn()
    const rejectedNonError = Reflect.apply(Promise.reject, Promise, ['callback failed'])

    await runInitialExperience(
      createOptimizationSdk(),
      {
        onError,
        run: async () => await rejectedNonError,
      },
      25,
    )

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(onError.mock.calls[0]?.[0]).toHaveProperty('message', 'callback failed')
  })

  it('clears the watchdog when returned work settles before the deadline', async () => {
    rs.useFakeTimers()
    const work = createDeferred<undefined>()
    const onError = rs.fn()
    const running = runInitialExperience(
      createOptimizationSdk(),
      {
        onError,
        run: async () => {
          await work.promise
          return 'ready'
        },
      },
      25,
    )

    expect(rs.getTimerCount()).toBe(1)
    work.resolve(undefined)
    await running
    expect(rs.getTimerCount()).toBe(0)

    await rs.advanceTimersByTimeAsync(25)
    expect(onError).not.toHaveBeenCalled()
  })

  it('observes late callback rejection without reporting a second error', async () => {
    rs.useFakeTimers()
    const work = createDeferred<undefined>()
    const onError = rs.fn()
    const running = runInitialExperience(
      createOptimizationSdk(),
      {
        onError,
        run: async () => {
          await work.promise
          return 'ready'
        },
      },
      25,
    )

    await rs.advanceTimersByTimeAsync(25)
    await running
    expect(onError).toHaveBeenCalledTimes(1)

    work.reject(new Error('settled late'))
    await Promise.resolve()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('catches and logs a throwing onError callback', async () => {
    const callbackError = new Error('callback failed')
    const onErrorFailure = new Error('onError failed')
    const logError = rs.spyOn(logger, 'error').mockImplementation(() => undefined)

    await runInitialExperience(
      createOptimizationSdk(),
      {
        onError: () => {
          throw onErrorFailure
        },
        run: async () => await Promise.reject(callbackError),
      },
      25,
    )

    expect(logError).toHaveBeenCalledWith('React:InitialExperience', onErrorFailure)
  })
})
