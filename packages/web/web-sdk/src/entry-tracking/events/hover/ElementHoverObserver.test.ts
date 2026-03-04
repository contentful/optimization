import { advance, deferred, makeElement, setDocumentVisibility } from '../../../test/helpers'
import * as ElementHover from './element-hover-observer-support'
import ElementHoverObserver from './ElementHoverObserver'

interface Meta {
  totalHoverMs: number
  componentHoverId: string
  attempts: number
  data?: unknown
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function isMeta(x: unknown): x is Meta {
  return (
    isRecord(x) &&
    typeof x.totalHoverMs === 'number' &&
    typeof x.componentHoverId === 'string' &&
    typeof x.attempts === 'number'
  )
}

const canUsePointerEvents = (): boolean =>
  typeof window !== 'undefined' &&
  typeof PointerEvent !== 'undefined' &&
  typeof window.PointerEvent === 'function'

const dispatchHoverEnter = (element: Element): void => {
  if (canUsePointerEvents()) {
    element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    return
  }

  element.dispatchEvent(new MouseEvent('mouseenter'))
}

const dispatchHoverLeave = (element: Element): void => {
  if (canUsePointerEvents()) {
    element.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    return
  }

  element.dispatchEvent(new MouseEvent('mouseleave'))
}

const dispatchTouchPointerEnter = (element: Element): void => {
  if (!canUsePointerEvents()) return
  element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }))
}

describe('ElementHoverObserver', () => {
  beforeEach(() => {
    rs.useFakeTimers()
    setDocumentVisibility('visible')
    rs.spyOn(ElementHover, 'NOW').mockImplementation(() => Date.now())
  })

  afterEach(() => {
    rs.clearAllTimers()
    rs.restoreAllMocks()
  })

  it('fires callback after dwell time when element hover begins', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 1000 })
    obs.observe(el)

    dispatchHoverEnter(el)

    await advance(999)
    expect(cb).not.toHaveBeenCalled()

    await advance(1)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(
      el,
      expect.objectContaining({
        attempts: 1,
        totalHoverMs: 1000,
        componentHoverId: expect.any(String),
      }),
    )
  })

  it('emits duration updates at configured intervals while still hovered', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb, {
      dwellTimeMs: 1000,
      hoverDurationUpdateIntervalMs: 5000,
    })
    obs.observe(el)

    dispatchHoverEnter(el)

    await advance(1000)
    expect(cb).toHaveBeenCalledTimes(1)

    await advance(5000)
    expect(cb).toHaveBeenCalledTimes(2)

    const firstMeta = cb.mock.calls[0]?.[1]
    const secondMeta = cb.mock.calls[1]?.[1]
    if (!isMeta(firstMeta) || !isMeta(secondMeta)) {
      throw new Error('Unexpected callback payload')
    }

    expect(secondMeta.totalHoverMs).toBe(6000)
    expect(secondMeta.componentHoverId).toBe(firstMeta.componentHoverId)
  })

  it('emits a final duration update when hover ends after dwell has fired', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb, {
      dwellTimeMs: 1000,
      hoverDurationUpdateIntervalMs: 10_000,
    })
    obs.observe(el)

    dispatchHoverEnter(el)
    await advance(1000)
    await advance(400)
    dispatchHoverLeave(el)
    await Promise.resolve()

    expect(cb).toHaveBeenCalledTimes(2)

    const firstMeta = cb.mock.calls[0]?.[1]
    const secondMeta = cb.mock.calls[1]?.[1]
    if (!isMeta(firstMeta) || !isMeta(secondMeta)) {
      throw new Error('Unexpected callback payload')
    }

    expect(secondMeta.componentHoverId).toBe(firstMeta.componentHoverId)
    expect(secondMeta.totalHoverMs).toBe(1400)
  })

  it('does not emit when hover ends before dwell time completes', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 1000 })
    obs.observe(el)

    dispatchHoverEnter(el)
    await advance(400)
    dispatchHoverLeave(el)
    await advance(1000)

    expect(cb).not.toHaveBeenCalled()
  })

  it('assigns a new componentHoverId for each new hover cycle', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 100 })
    obs.observe(el)

    dispatchHoverEnter(el)
    await advance(100)
    dispatchHoverLeave(el)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    dispatchHoverEnter(el)
    await advance(100)

    expect(cb).toHaveBeenCalledTimes(3)

    const firstMeta = cb.mock.calls[0]?.[1]
    const thirdMeta = cb.mock.calls[2]?.[1]
    if (!isMeta(firstMeta) || !isMeta(thirdMeta)) {
      throw new Error('Unexpected callback payload')
    }

    expect(firstMeta.componentHoverId).not.toBe(thirdMeta.componentHoverId)
  })

  it('pauses dwell timers when hidden and resumes with remaining dwell time', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 500 })
    obs.observe(el)

    dispatchHoverEnter(el)

    await advance(300)
    setDocumentVisibility('hidden')

    await advance(1000)
    expect(cb).not.toHaveBeenCalled()

    setDocumentVisibility('visible')

    await advance(199)
    expect(cb).not.toHaveBeenCalled()

    await advance(1)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('supports per-element dwell override and passes data to callback', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 10_000 })

    obs.observe(el, {
      dwellTimeMs: 50,
      data: { id: 'xyz' },
    })

    dispatchHoverEnter(el)

    await advance(50)

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(
      el,
      expect.objectContaining<Partial<Meta>>({
        attempts: 1,
        totalHoverMs: 50,
        componentHoverId: expect.any(String),
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

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 10 })
    obs.observe(el)

    dispatchHoverEnter(el)
    await advance(10)
    expect(cb).toHaveBeenCalledTimes(1)

    await advance(100)
    expect(cb).toHaveBeenCalledTimes(1)

    firstAttempt.resolve(undefined)
    await Promise.resolve()
    await Promise.resolve()

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('emits a final callback after in-flight callback settles on hover end', async () => {
    const el = makeElement()
    const firstAttempt = deferred()
    let callCount = 0
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockImplementation(async () => {
      callCount += 1
      if (callCount === 1) {
        await firstAttempt.promise
      }
    })

    const obs = new ElementHoverObserver(cb, {
      dwellTimeMs: 0,
      hoverDurationUpdateIntervalMs: 1000,
    })
    obs.observe(el)

    dispatchHoverEnter(el)
    await advance(0)
    await advance(250)
    dispatchHoverLeave(el)

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
      if (calls === 1) throw new Error('fail-once')
      await Promise.resolve()
    })

    const obs = new ElementHoverObserver(cb, {
      dwellTimeMs: 0,
      hoverDurationUpdateIntervalMs: 1000,
    })
    obs.observe(el)

    dispatchHoverEnter(el)

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

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 10_000 })
    obs.observe(el)

    dispatchHoverEnter(el)

    expect(rs.getTimerCount()).toBeGreaterThan(0)

    obs.unobserve(el)
    await advance(20_000)

    expect(cb).not.toHaveBeenCalled()
  })

  it('sweeps orphaned states for disconnected or dropped elements', async () => {
    const el = makeElement()
    const cb = rs.fn().mockResolvedValue(undefined)
    const derefSpy = rs.spyOn(ElementHover, 'derefElement')

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 1_000 })
    obs.observe(el)

    dispatchHoverEnter(el)

    derefSpy.mockReturnValueOnce(null)
    await advance(35_000)

    expect(cb).not.toHaveBeenCalled()
  })

  it('disconnect clears timers and removes visibility listener', () => {
    const el = makeElement()
    const cb = rs.fn().mockResolvedValue(undefined)
    const addSpy = rs.spyOn(document, 'addEventListener')
    const removeSpy = rs.spyOn(document, 'removeEventListener')

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 100 })
    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    obs.observe(el)
    dispatchHoverEnter(el)
    obs.disconnect()

    expect(rs.getTimerCount()).toBe(0)
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('ignores touch pointer hover events when PointerEvent is available', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb, { dwellTimeMs: 0 })
    obs.observe(el)

    dispatchTouchPointerEnter(el)
    await advance(0)

    expect(cb).not.toHaveBeenCalled()
  })
})
