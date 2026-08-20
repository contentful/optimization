import type { FakeIntersectionObserver } from '../../../test/helpers'
import {
  advance,
  deferred,
  installIOPolyfill,
  makeElement,
  setDocumentVisibility,
} from '../../../test/helpers'
import { isRecord } from '../../../test/typeGuards'
import * as ElementView from './element-view-observer-support'
import ElementViewObserver from './ElementViewObserver'

interface Meta {
  totalVisibleMs: number
  viewId: string
  attempts: number
  data?: unknown
}

function isMeta(value: unknown): value is Meta {
  return (
    isRecord(value) &&
    typeof value.totalVisibleMs === 'number' &&
    typeof value.viewId === 'string' &&
    typeof value.attempts === 'number'
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

    const obs = new ElementViewObserver(cb)

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
        viewId: expect.any(String),
      }),
    )
  })

  it('emits a final duration update when visibility ends after dwell has fired', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb)
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

    expect(secondMeta.viewId).toBe(firstMeta.viewId)
    expect(secondMeta.totalVisibleMs).toBe(1400)
  })

  it('does not accumulate dwell across separate visibility intersections', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb)
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
        expect(metaCandidate.viewId).toEqual(expect.any(String))
      } else {
        throw new Error('Unexpected meta payload for first callback')
      }
    }
  })

  it('assigns a new viewId for each new visibility cycle', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb)
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(1000)
    await Promise.resolve()
    await Promise.resolve()

    inst.trigger({ target: el, isIntersecting: false, intersectionRatio: 0 })
    await Promise.resolve()
    await Promise.resolve()

    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(1000)

    expect(cb).toHaveBeenCalledTimes(3)

    const firstMeta = cb.mock.calls[0]?.[1]
    const secondMeta = cb.mock.calls[1]?.[1]
    const thirdMeta = cb.mock.calls[2]?.[1]
    if (!isMeta(firstMeta) || !isMeta(secondMeta) || !isMeta(thirdMeta)) {
      throw new Error('Unexpected callback payload')
    }

    expect(secondMeta.viewId).toBe(firstMeta.viewId)
    expect(firstMeta.viewId).not.toBe(thirdMeta.viewId)
  })

  it('ends on hide and starts a fresh session when the still-visible page returns', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb)
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    await advance(300)
    setDocumentVisibility('hidden')
    expect(cb).not.toHaveBeenCalled()

    setDocumentVisibility('visible')

    await advance(1000)
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
        expect(metaCandidate.viewId).toEqual(expect.any(String))
      } else {
        throw new Error('Unexpected meta payload for first callback')
      }
    }

    await advance(250)
    setDocumentVisibility('hidden')
    await obs.endActive()

    expect(cb).toHaveBeenCalledTimes(2)
    const startMeta = cb.mock.calls[0]?.[1]
    const finalMeta = cb.mock.calls[1]?.[1]
    if (!isMeta(startMeta) || !isMeta(finalMeta)) {
      throw new Error('Unexpected callback payload')
    }
    expect(finalMeta.viewId).toBe(startMeta.viewId)
    expect(finalMeta.totalVisibleMs).toBe(1250)
  })

  it('ends once for duplicate hide signals and starts a fresh view on pageshow', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)
    const obs = new ElementViewObserver(cb)
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(1000)
    await advance(250)

    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(new Event('beforeunload'))
    await obs.endActive()

    expect(cb).toHaveBeenCalledTimes(2)
    const firstStart = cb.mock.calls[0]?.[1]
    const firstFinal = cb.mock.calls[1]?.[1]
    if (!isMeta(firstStart) || !isMeta(firstFinal)) {
      throw new Error('Unexpected callback payload')
    }
    expect(firstFinal.viewId).toBe(firstStart.viewId)
    expect(firstFinal.totalVisibleMs).toBe(1250)

    window.dispatchEvent(new Event('pageshow'))
    await advance(1000)

    expect(cb).toHaveBeenCalledTimes(3)
    const secondStart = cb.mock.calls[2]?.[1]
    if (!isMeta(secondStart)) throw new Error('Unexpected callback payload')
    expect(secondStart.viewId).not.toBe(firstStart.viewId)
    expect(secondStart.totalVisibleMs).toBe(1000)
  })

  it('passes per-element data to the callback', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb)

    obs.observe(el, {
      data: { id: 'xyz' },
    })

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    await advance(1000)

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(
      el,
      expect.objectContaining<Partial<Meta>>({
        attempts: 1,
        totalVisibleMs: 1000,
        viewId: expect.any(String),
        data: { id: 'xyz' },
      }),
    )
  })

  it('awaits an in-flight start before emitting and settling the final callback', async () => {
    const el = makeElement()
    const firstAttempt = deferred()
    let callCount = 0
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockImplementation(async () => {
      callCount += 1
      if (callCount === 1) {
        await firstAttempt.promise
      }
    })

    const obs = new ElementViewObserver(cb)
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })
    await advance(1000)
    await advance(250)
    const ending = obs.endActive()

    expect(cb).toHaveBeenCalledTimes(1)

    firstAttempt.resolve(undefined)
    await ending

    expect(cb).toHaveBeenCalledTimes(2)
    const startMeta = cb.mock.calls[0]?.[1]
    const finalMeta = cb.mock.calls[1]?.[1]
    if (!isMeta(startMeta) || !isMeta(finalMeta)) {
      throw new Error('Unexpected callback payload')
    }
    expect(finalMeta.viewId).toBe(startMeta.viewId)
    expect(finalMeta.totalVisibleMs).toBe(1250)
  })

  it('emits the final callback after a start callback failure', async () => {
    const el = makeElement()
    let calls = 0
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockImplementation(async () => {
      calls += 1
      if (calls === 1) throw new Error('fail-once')
      await Promise.resolve()
    })

    const obs = new ElementViewObserver(cb)
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    await advance(1000)
    await advance(250)
    await obs.endActive()
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('unobserve cancels pending dwell timers', async () => {
    const el = makeElement()
    const cb = rs.fn().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb)
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

    const obs = new ElementViewObserver(cb)
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

    const obs = new ElementViewObserver(cb)
    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    obs.observe(el)
    obs.disconnect()

    expect(rs.getTimerCount()).toBe(0)
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('endActive is idempotent and emits one final callback for a qualified view', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb)
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    await advance(1000)
    expect(cb).toHaveBeenCalledTimes(1)

    await advance(750)
    await Promise.all([obs.endActive(), obs.endActive()])

    expect(cb).toHaveBeenCalledTimes(2)

    const firstMeta = cb.mock.calls[0]?.[1]
    const secondMeta = cb.mock.calls[1]?.[1]
    if (!isMeta(firstMeta) || !isMeta(secondMeta)) {
      throw new Error('Unexpected callback payload')
    }

    expect(secondMeta.viewId).toBe(firstMeta.viewId)
    expect(secondMeta.totalVisibleMs).toBe(1750)
  })

  it('endActive emits nothing for a sub-dwell view', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementViewObserver(cb)
    obs.observe(el)

    const inst = mustGetIO()
    inst.trigger({ target: el, isIntersecting: true, intersectionRatio: 1 })

    await advance(500)
    await obs.endActive()

    expect(cb).not.toHaveBeenCalled()
  })
})
