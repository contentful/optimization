import { InterceptorManager } from './InterceptorManager'

interface Event {
  type: 'track' | 'identify'
  payload: Record<string, unknown>
  timestamp?: string
}

describe('InterceptorManager', () => {
  let manager: InterceptorManager<Event>

  const baseEvent: Event = {
    type: 'track',
    payload: { feature: 'search' },
  }

  beforeEach(() => {
    manager = new InterceptorManager<Event>()
  })

  it('adds interceptors with incremental ids and updates count()', () => {
    const id0 = manager.add((e: Readonly<Event>): Event => e)
    const id1 = manager.add((e: Readonly<Event>): Event => e)

    expect(id0).toBe(0)
    expect(id1).toBe(1)
    expect(manager.count()).toBe(2)
  })

  it('removes interceptors by id and returns true/false appropriately', () => {
    const id = manager.add((e: Readonly<Event>): Event => e)

    expect(manager.remove(id)).toBe(true)
    expect(manager.count()).toBe(0)

    // Removing again should return false (already removed)
    expect(manager.remove(id)).toBe(false)

    // Removing a non-existent id should also return false
    expect(manager.remove(999)).toBe(false)
  })

  it('clears all interceptors', () => {
    manager.add((e: Readonly<Event>): Event => e)
    manager.add((e: Readonly<Event>): Event => e)

    expect(manager.count()).toBe(2)

    manager.clear()
    expect(manager.count()).toBe(0)
  })

  it('run() returns the same reference when no interceptors are registered', async () => {
    const result = await manager.run(baseEvent)
    expect(result).toBe(baseEvent)
  })

  it('executes interceptors in insertion order (sync + async) and pipes transformed values', async () => {
    const addTimestamp = rs.fn(
      (evt: Readonly<Event>): Event => ({
        ...evt,
        timestamp: evt.timestamp ?? '2025-09-01T00:00:00.000Z',
      }),
    )

    const addFlagAsync = rs.fn(async (evt: Readonly<Event>): Promise<Event> => {
      await Promise.resolve()
      return {
        ...evt,
        payload: { ...evt.payload, flagged: true },
      }
    })

    const redactSecret = rs.fn((evt: Readonly<Event>): Event => {
      const nextPayload: Record<string, unknown> = { ...evt.payload }
      if (Object.prototype.hasOwnProperty.call(nextPayload, 'secret')) {
        nextPayload.secret = '[REDACTED]'
      }
      return { ...evt, payload: nextPayload }
    })

    manager.add(addTimestamp)
    manager.add(addFlagAsync)
    manager.add(redactSecret)

    const input: Event = {
      type: 'track',
      payload: { secret: 'tok_123', feature: 'search' },
    }

    const output = await manager.run(input)

    expect(addTimestamp).toHaveBeenCalledTimes(1)
    expect(addFlagAsync).toHaveBeenCalledTimes(1)
    expect(redactSecret).toHaveBeenCalledTimes(1)

    // Deep destructuring with defaults at both levels
    const {
      mock: { invocationCallOrder: tsOrder = [] },
    } = addTimestamp
    const {
      mock: { invocationCallOrder: asyncOrder = [] },
    } = addFlagAsync
    const {
      mock: { invocationCallOrder: redactOrder = [] },
    } = redactSecret

    const [ts0 = -1] = tsOrder
    const [async0 = -1] = asyncOrder
    const [redact0 = -1] = redactOrder

    expect(ts0).toBeLessThan(async0)
    expect(async0).toBeLessThan(redact0)

    // Argument piping
    expect(addTimestamp).toHaveBeenNthCalledWith(1, input)
    expect(addFlagAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ timestamp: '2025-09-01T00:00:00.000Z' }),
    )
    expect(redactSecret).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        payload: expect.objectContaining({ flagged: true }),
      }),
    )

    // Final value reflects all transforms
    expect(output).toEqual({
      type: 'track',
      timestamp: '2025-09-01T00:00:00.000Z',
      payload: { feature: 'search', flagged: true, secret: '[REDACTED]' },
    })
  })

  it('snapshots the interceptor list during run(): adds/removes during a run do not affect that run', async () => {
    const dynamicSpy = rs.fn(
      (evt: Readonly<Event>): Event => ({
        ...evt,
        payload: { ...evt.payload, dynamic: true },
      }),
    )

    let firstId = -1

    const first = rs.fn((evt: Readonly<Event>): Event => {
      const removed = manager.remove(firstId)
      expect(removed).toBe(true)
      manager.add(dynamicSpy)
      return evt
    })

    const second = rs.fn(
      (evt: Readonly<Event>): Event => ({
        ...evt,
        payload: { ...evt.payload, afterFirst: true },
      }),
    )

    firstId = manager.add(first)
    manager.add(second)

    // First run: dynamicSpy should NOT be called (added mid-run), but "second" should.
    const firstOut = await manager.run(baseEvent)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(dynamicSpy).toHaveBeenCalledTimes(0)
    expect(firstOut).toEqual({
      ...baseEvent,
      payload: { ...baseEvent.payload, afterFirst: true },
    })

    // After first run: "first" removed, "dynamicSpy" added.
    expect(manager.count()).toBe(2)

    // Second run: both "second" and "dynamicSpy" apply (in that order).
    const secondRunInput: Event = {
      type: 'identify',
      payload: { userId: 'u1' },
    }
    const secondOut = await manager.run(secondRunInput)
    expect(second).toHaveBeenCalledTimes(2)
    expect(dynamicSpy).toHaveBeenCalledTimes(1)

    const {
      mock: { invocationCallOrder: secondOrder = [] },
    } = second
    const {
      mock: { invocationCallOrder: dynamicOrder = [] },
    } = dynamicSpy

    const [, second1 = -1] = secondOrder
    const [dynamic0 = -1] = dynamicOrder

    expect(second1).toBeLessThan(dynamic0)

    expect(secondOut).toEqual({
      type: 'identify',
      payload: { userId: 'u1', afterFirst: true, dynamic: true },
    })
  })
})
