import { describe, expect, it, rs } from '@rstest/core'
import { AcceptedCurrentStateTracker } from './AcceptedCurrentStateTracker'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
} {
  let resolvePromise: (value: T) => void = () => undefined
  let rejectPromise: (error: unknown) => void = () => undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

describe('AcceptedCurrentStateTracker', () => {
  it('marks accepted emissions and suppresses duplicate accepted keys', async () => {
    const tracker = new AcceptedCurrentStateTracker<string>()
    const emit = rs.fn().mockResolvedValue({ accepted: true })

    await expect(tracker.emitIfNeeded({ key: 'home', isAllowed: true, emit })).resolves.toEqual({
      accepted: true,
      attempted: true,
    })
    await expect(tracker.emitIfNeeded({ key: 'home', isAllowed: true, emit })).resolves.toEqual({
      accepted: false,
      attempted: false,
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(tracker.hasAccepted()).toBe(true)
  })

  it('does not emit while the same key is already in flight', async () => {
    const tracker = new AcceptedCurrentStateTracker<string>()
    const first = deferred<{ accepted: true }>()
    const emit = rs.fn().mockReturnValue(first.promise)

    const firstEmission = tracker.emitIfNeeded({ key: 'home', isAllowed: true, emit })
    await expect(tracker.emitIfNeeded({ key: 'home', isAllowed: true, emit })).resolves.toEqual({
      accepted: false,
      attempted: false,
    })

    first.resolve({ accepted: true })
    await firstEmission

    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('retries after a blocked or not accepted result', async () => {
    const tracker = new AcceptedCurrentStateTracker<string>()
    const emit = rs
      .fn()
      .mockResolvedValueOnce({ accepted: false })
      .mockResolvedValueOnce({ accepted: true })

    await tracker.emitIfNeeded({ key: 'home', isAllowed: true, emit })
    await tracker.emitIfNeeded({ key: 'home', isAllowed: true, emit })

    expect(emit).toHaveBeenCalledTimes(2)
  })

  it('clears in-flight state after rejected emissions', async () => {
    const tracker = new AcceptedCurrentStateTracker<string>()
    const emit = rs
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ accepted: true })

    await expect(tracker.emitIfNeeded({ key: 'home', isAllowed: true, emit })).rejects.toThrow(
      'network',
    )
    await tracker.emitIfNeeded({ key: 'home', isAllowed: true, emit })

    expect(emit).toHaveBeenCalledTimes(2)
  })

  it('tracks changed keys and supports reset', async () => {
    const tracker = new AcceptedCurrentStateTracker<string>()
    const emit = rs.fn().mockResolvedValue({ accepted: true })

    await tracker.emitIfNeeded({ key: 'home', isAllowed: true, emit })
    await tracker.emitIfNeeded({ key: 'details', isAllowed: true, emit })
    tracker.reset()
    await tracker.emitIfNeeded({ key: 'details', isAllowed: true, emit })

    expect(emit).toHaveBeenCalledTimes(3)
  })

  it('does not call emit when tracking is not allowed', async () => {
    const tracker = new AcceptedCurrentStateTracker<string>()
    const emit = rs.fn().mockResolvedValue({ accepted: true })

    await expect(tracker.emitIfNeeded({ key: 'home', isAllowed: false, emit })).resolves.toEqual({
      accepted: false,
      attempted: false,
    })

    expect(emit).not.toHaveBeenCalled()
  })

  it('supports undefined as a key value', async () => {
    const tracker = new AcceptedCurrentStateTracker<string | undefined>()
    const emit = rs.fn().mockResolvedValue({ accepted: true })

    await expect(tracker.emitIfNeeded({ key: undefined, isAllowed: true, emit })).resolves.toEqual({
      accepted: true,
      attempted: true,
    })
    await expect(tracker.emitIfNeeded({ key: undefined, isAllowed: true, emit })).resolves.toEqual({
      accepted: false,
      attempted: false,
    })

    expect(emit).toHaveBeenCalledTimes(1)
    expect(tracker.hasAccepted()).toBe(true)
  })
})
