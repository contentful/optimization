import type { FakeIntersectionObserver } from '../../../test/helpers'
import {
  advance,
  deferred,
  installIOPolyfill,
  makeElement,
  setDocumentVisibility,
} from '../../../test/helpers'
import * as ElementView from './element-view-observer-support'
import ElementViewObserver from './ElementViewObserver'

interface Meta {
  totalVisibleMs: number
  componentViewId: string
  attempts: number
  data?: unknown
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function isMeta(x: unknown): x is Meta {
  return (
    isRecord(x) &&
    typeof x.totalVisibleMs === 'number' &&
    typeof x.componentViewId === 'string' &&
    typeof x.attempts === 'number'
  )
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
    rs.spyOn(ElementView, 'NOW').mockImplementation(() => Date.now())
  })

  afterEach(() => {
    rs.clearAllTimers()
    rs.restoreAllMocks()
  })

  afterAll(() => {
    io.restore()
  })

  it('fires callback after dwell time when element becomes visible', async () => {
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
      expect.objectContaining({
        attempts: 1,
        totalVisibleMs: 1000,
        componentViewId: expect.any(String),
      }),
    )

    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 0.9 })
    await advance(2000)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('emits duration updates at configured intervals while still visible', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb, {
      dwellTimeMs: 1000,
      viewDurationUpdateIntervalMs: 5000,
    })

    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    await advance(1000)
    expect(cb).toHaveBeenCalledTimes(1)

    await advance(5000)
    expect(cb).toHaveBeenCalledTimes(2)

    const firstMeta = cb.mock.calls[0]?.[1]
    const secondMeta = cb.mock.calls[1]?.[1]
    if (!isMeta(firstMeta) || !isMeta(secondMeta)) {
      throw new Error('Unexpected callback payload')
    }

    expect(secondMeta.totalVisibleMs).toBe(6000)
    expect(secondMeta.componentViewId).toBe(firstMeta.componentViewId)
  })

  it('emits a final duration update when visibility ends after dwell has fired', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb, {
      dwellTimeMs: 1000,
      viewDurationUpdateIntervalMs: 10_000,
    })
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    await advance(1000)
    await advance(400)
    inst.trigger({ target: el, isIntersecting: false, intersectionRatio: 0 })
    await Promise.resolve()

    expect(cb).toHaveBeenCalledTimes(2)

    const firstMeta = cb.mock.calls[0]?.[1]
    const secondMeta = cb.mock.calls[1]?.[1]
    if (!isMeta(firstMeta) || !isMeta(secondMeta)) {
      throw new Error('Unexpected callback payload')
    }

    expect(secondMeta.componentViewId).toBe(firstMeta.componentViewId)
    expect(secondMeta.totalVisibleMs).toBe(1400)
  })

  it('does not accumulate dwell across separate visibility intersections', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb, { dwellTimeMs: 1000 })
    obs.observe(el)

    const inst = mustGetIO()

    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(400)

    inst.trigger({ target: el, isIntersecting: false, intersectionRatio: 0 })

    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(600)
    expect(cb).not.toHaveBeenCalled()

    await advance(400)
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
        expect(metaCandidate.totalVisibleMs).toBe(1000)
        expect(metaCandidate.componentViewId).toEqual(expect.any(String))
      } else {
        throw new Error('Unexpected meta payload for first callback')
      }
    }
  })

  it('assigns a new componentViewId for each new visibility cycle', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb, { dwellTimeMs: 100 })
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(100)
    await Promise.resolve()
    await Promise.resolve()

    inst.trigger({ target: el, isIntersecting: false, intersectionRatio: 0 })
    await Promise.resolve()
    await Promise.resolve()

    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(100)

    expect(cb).toHaveBeenCalledTimes(3)

    const firstMeta = cb.mock.calls[0]?.[1]
    const secondMeta = cb.mock.calls[1]?.[1]
    const thirdMeta = cb.mock.calls[2]?.[1]
    if (!isMeta(firstMeta) || !isMeta(secondMeta) || !isMeta(thirdMeta)) {
      throw new Error('Unexpected callback payload')
    }

    expect(secondMeta.componentViewId).toBe(firstMeta.componentViewId)
    expect(firstMeta.componentViewId).not.toBe(thirdMeta.componentViewId)
  })

  it('pauses dwell timers when hidden and resumes with remaining dwell time', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb, { dwellTimeMs: 500 })
    obs.observe(el)

    const inst = mustGetIO()
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
        expect(metaCandidate.componentViewId).toEqual(expect.any(String))
      } else {
        throw new Error('Unexpected meta payload for first callback')
      }
    }
  })

  it('supports per-element dwell override and passes data to callback', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb, {
      dwellTimeMs: 10_000,
      minVisibleRatio: 0.8,
    })

    obs.observe(el, {
      dwellTimeMs: 50,
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
        componentViewId: expect.any(String),
        data: { id: 'xyz' },
      }),
    )
  })

  it('coalesces in-flight attempts and does not trigger duplicate callbacks', async () => {
    const el = makeElement()
    const firstAttempt = deferred()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockImplementation(async () => {
      await firstAttempt.promise
    })

    const obs = new ElementViewObserver(cb, { dwellTimeMs: 10 })
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    await advance(10)
    expect(cb).toHaveBeenCalledTimes(1)

    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(100)
    expect(cb).toHaveBeenCalledTimes(1)

    firstAttempt.resolve(undefined)
    await Promise.resolve()
    await Promise.resolve()

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('emits a final callback after in-flight callback settles on visibility end', async () => {
    const el = makeElement()
    const firstAttempt = deferred()
    let callCount = 0
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockImplementation(async () => {
      callCount += 1
      if (callCount === 1) {
        await firstAttempt.promise
      }
    })

    const obs = new ElementViewObserver(cb, {
      dwellTimeMs: 0,
      viewDurationUpdateIntervalMs: 1000,
    })
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)
    await advance(250)
    inst.trigger({ target: el, isIntersecting: false, intersectionRatio: 0 })

    expect(cb).toHaveBeenCalledTimes(1)

    firstAttempt.resolve(undefined)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('continues scheduled updates after callback failure', async () => {
    const el = makeElement()
    let calls = 0
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockImplementation(async () => {
      calls += 1
      if (calls === 1) {
        throw new Error('fail-once')
      }

      await Promise.resolve()
    })

    const obs = new ElementViewObserver(cb, {
      dwellTimeMs: 0,
      viewDurationUpdateIntervalMs: 1000,
    })
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)
    await Promise.resolve()
    await Promise.resolve()

    expect(cb).toHaveBeenCalledTimes(1)

    await advance(1000)
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('unobserve cancels pending dwell timers', async () => {
    const el = makeElement()
    const cb = rs.fn().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb, { dwellTimeMs: 10_000 })
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    expect(rs.getTimerCount()).toBeGreaterThan(0)

    obs.unobserve(el)
    await advance(20_000)

    expect(cb).not.toHaveBeenCalled()
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

    await advance(35_000)
    expect(cb).not.toHaveBeenCalled()
  })

  it('disconnect clears timers and removes visibility listener', () => {
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
