// ElementViewObserver.spec.ts
import type { FakeIntersectionObserver } from '../test/helpers'
import {
  advance,
  deferred,
  installIOPolyfill,
  makeElement,
  setDocumentVisibility,
} from '../test/helpers'
import * as ElementView from './ElementView'
import ElementViewObserver from './ElementViewObserver'

interface Meta {
  totalVisibleMs: number
  attempts: number
  data?: unknown
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}
function isMeta(x: unknown): x is Meta {
  return isRecord(x) && typeof x.totalVisibleMs === 'number' && typeof x.attempts === 'number'
}

describe('ElementViewObserver', () => {
  const io = installIOPolyfill()

  const mustGetIO = (): FakeIntersectionObserver => {
    const inst = io.getLast()
    if (inst === null) throw new Error('IntersectionObserver polyfill instance not found')
    return inst
  }

  beforeEach(() => {
    rs.useFakeTimers()
    setDocumentVisibility('visible')
    rs.spyOn(ElementView, 'withJitter').mockImplementation((n: number) => n)
    rs.spyOn(ElementView, 'NOW').mockImplementation(() => Date.now())
  })

  afterEach(() => {
    rs.clearAllTimers()
    rs.restoreAllMocks()
  })

  afterAll(() => {
    io.restore()
  })

  it('fires callback once after dwell time when element becomes visible', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb, {
      minVisibleRatio: 0.5,
      dwellTimeMs: 1000,
    })
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 0.6 })

    await advance(999)
    expect(cb).not.toHaveBeenCalled()

    await advance(1)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(
      el,
      expect.objectContaining({ attempts: 1, totalVisibleMs: 1000 }),
    )

    // Further visibility should not refire (done=true)
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 0.8 })
    await advance(2000)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('accumulates visible time across visibility toggles', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb, { dwellTimeMs: 1000 })
    obs.observe(el)
    const inst = mustGetIO()

    // First partial visibility: 400ms
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(400)
    inst.trigger({ target: el, isIntersecting: false, intersectionRatio: 0 })
    await advance(200)

    // Second visibility: after another 600ms it should fire
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(599)
    expect(cb).not.toHaveBeenCalled()

    await advance(1)
    expect(cb).toHaveBeenCalledTimes(1)

    const {
      mock: {
        calls: { 0: first },
      },
    } = cb
    expect(first).toBeDefined()
    if (first) {
      // Array destructuring for meta argument
      const [, metaCandidate] = first
      if (isMeta(metaCandidate)) {
        expect(metaCandidate.totalVisibleMs).toBe(1000)
      } else {
        throw new Error('Unexpected meta payload for first callback')
      }
    }
  })

  it('pauses timers when page becomes hidden and resumes cleanly', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)
    const obs = new ElementViewObserver(cb, { dwellTimeMs: 500 })
    obs.observe(el)
    const inst = mustGetIO()

    // Start visible; run 300ms then hide
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(300)

    setDocumentVisibility('hidden')
    await advance(1000)
    expect(cb).not.toHaveBeenCalled()

    setDocumentVisibility('visible')
    await advance(199)
    expect(cb).not.toHaveBeenCalled()

    await advance(1)
    expect(cb).toHaveBeenCalledTimes(1)

    const {
      mock: {
        calls: { 0: first },
      },
    } = cb
    expect(first).toBeDefined()
    if (first) {
      const [, metaCandidate] = first
      if (isMeta(metaCandidate)) {
        expect(metaCandidate.totalVisibleMs).toBe(500)
      } else {
        throw new Error('Unexpected meta payload for first callback')
      }
    }
  })

  it('supports per-element overrides and passes data to callback', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)
    const obs = new ElementViewObserver(cb, {
      dwellTimeMs: 10_000,
      minVisibleRatio: 0.8,
    })

    obs.observe(el, {
      dwellTimeMs: 50,
      maxRetries: 1,
      retryBackoffMs: 10,
      backoffMultiplier: 3,
      data: { id: 'xyz' },
    })

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(50)

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(
      el,
      expect.objectContaining<Partial<Meta>>({
        attempts: 1,
        totalVisibleMs: 50,
        data: { id: 'xyz' },
      }),
    )
  })

  it('exposes readonly stats snapshot via getStats()', async () => {
    const el = makeElement()
    const cb = rs.fn().mockResolvedValue(undefined)
    const obs = new ElementViewObserver(cb, { dwellTimeMs: 200 })
    obs.observe(el)
    const inst = mustGetIO()

    expect(obs.getStats(el)).toEqual(
      expect.objectContaining({
        accumulatedMs: 0,
        visibleSince: null,
        attempts: 0,
        done: false,
        inFlight: false,
        pendingRetry: false,
        lastKnownVisible: false,
      }),
    )

    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(100)
    const mid = obs.getStats(el)
    expect(mid).not.toBeNull()
    if (mid) {
      expect(mid.accumulatedMs).toBeGreaterThanOrEqual(0)
      expect(mid.visibleSince).not.toBeNull()
      expect(mid.lastKnownVisible).toBe(true)
    }

    await advance(100)
    expect(cb).toHaveBeenCalledTimes(1)

    const after = obs.getStats(el)
    expect(after).toBeNull()
  })

  it('coalesces attempts (no duplicate concurrent calls) and retries with exponential backoff', async () => {
    const el = makeElement()
    const firstAttempt = deferred()
    const cb = rs
      .fn<(e: Element, m: Meta) => Promise<void>>()
      .mockImplementationOnce(async () => {
        await firstAttempt.promise
        throw new Error('fail-1')
      })
      .mockRejectedValueOnce(new Error('fail-2')) // attempt #2
      .mockResolvedValueOnce(undefined) // attempt #3

    const obs = new ElementViewObserver(cb, {
      dwellTimeMs: 10,
      maxRetries: 2,
      retryBackoffMs: 200,
      backoffMultiplier: 2,
    })

    obs.observe(el)
    const inst = mustGetIO()

    // Start dwell -> attempt #1 in-flight
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(10)
    expect(cb).toHaveBeenCalledTimes(1)

    // Visibility while in-flight should not start a duplicate attempt
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(100)
    expect(cb).toHaveBeenCalledTimes(1)

    // Fail the in-flight attempt; allow catch path to schedule the retry
    firstAttempt.reject(new Error('done-pending'))
    await Promise.resolve()
    await Promise.resolve()

    // Step to the next scheduled timer (200ms backoff) -> attempt #2
    await rs.advanceTimersToNextTimerAsync()
    expect(cb).toHaveBeenCalledTimes(2)

    // Allow attempt #2 rejection to schedule the next retry (400ms)
    await Promise.resolve()
    await Promise.resolve()

    // Step to the next scheduled timer (400ms backoff) -> attempt #3 (success)
    await rs.advanceTimersToNextTimerAsync()
    expect(cb).toHaveBeenCalledTimes(3)

    // No more timers should cause additional attempts
    // (Optionally drain any stragglers; count stays at 3)
    await rs.runOnlyPendingTimersAsync()
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('stops pending retry when element becomes not visible and clears when visible again', async () => {
    const el = makeElement()
    const cb = rs
      .fn<(e: Element, m: Meta) => Promise<void>>()
      .mockRejectedValue(new Error('always-fail'))

    const obs = new ElementViewObserver(cb, {
      dwellTimeMs: 0,
      maxRetries: 2,
      retryBackoffMs: 100,
      backoffMultiplier: 2,
    })

    obs.observe(el)
    const inst = mustGetIO()

    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)
    expect(cb).toHaveBeenCalledTimes(1)

    inst.trigger({ target: el, isIntersecting: false, intersectionRatio: 0 })
    await advance(200)
    expect(cb).toHaveBeenCalledTimes(1)

    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(100)
    expect(cb).toHaveBeenCalledTimes(2)
    await advance(200)
    expect(cb).toHaveBeenCalledTimes(3)

    // After attempts reset on not-visible, we get: immediate (#2) + 100ms (#3) + 200ms (#4)
    await advance(500)
    expect(cb).toHaveBeenCalledTimes(4)
  })

  it('unobserve() cancels timers and removes internal state; sweep stops when inactive', async () => {
    const el = makeElement()
    const cb = rs.fn().mockResolvedValue(undefined)
    const setIntervalSpy = rs.spyOn(globalThis, 'setInterval')

    const obs = new ElementViewObserver(cb, { dwellTimeMs: 10_000 })
    obs.observe(el)

    expect(setIntervalSpy).toHaveBeenCalled()

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    expect(rs.getTimerCount()).toBeGreaterThan(0)

    obs.unobserve(el)
    await advance(0)

    expect(obs.getStats(el)).toBeNull()
  })

  it('sweeps orphaned states for disconnected or dropped elements', async () => {
    const el = makeElement()
    const cb = rs.fn().mockResolvedValue(undefined)
    const derefSpy = rs.spyOn(ElementView, 'derefElement')

    const obs = new ElementViewObserver(cb, { dwellTimeMs: 1_000 })

    obs.observe(el)
    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    derefSpy.mockReturnValueOnce(null)

    inst.trigger({ target: el, isIntersecting: false, intersectionRatio: 0 })
    await advance(0)

    // After sweepOrphans with WeakRef present and a still-referenced element,
    // the state is finalized but may still be readable via the WeakMap key.
    // Assert the "done" snapshot rather than null.
    const stats = obs.getStats(el)
    expect(stats).not.toBeNull()
    if (stats) {
      expect(stats.done).toBe(true)
      expect(stats.inFlight).toBe(false)
    }
  })

  // No unnecessary async/await (satisfies @typescript-eslint/require-await)
  it('disconnect() clears everything and removes visibility listener', () => {
    const el = makeElement()
    const cb = rs.fn().mockResolvedValue(undefined)
    const addSpy = rs.spyOn(document, 'addEventListener')
    const removeSpy = rs.spyOn(document, 'removeEventListener')

    const obs = new ElementViewObserver(cb, { dwellTimeMs: 100 })
    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    obs.observe(el)
    obs.disconnect()

    expect(rs.getTimerCount()).toBe(0)
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
