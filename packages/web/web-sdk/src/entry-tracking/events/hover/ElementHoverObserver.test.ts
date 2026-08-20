import { advance, deferred, makeElement, setDocumentVisibility } from '../../../test/helpers'
import { isRecord } from '../../../test/typeGuards'
import * as ElementHover from './element-hover-observer-support'
import ElementHoverObserver from './ElementHoverObserver'

interface Meta {
  totalHoverMs: number
  hoverId: string
  attempts: number
  data?: unknown
}

function isMeta(value: unknown): value is Meta {
  return (
    isRecord(value) &&
    typeof value.totalHoverMs === 'number' &&
    typeof value.hoverId === 'string' &&
    typeof value.attempts === 'number'
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

    const obs = new ElementHoverObserver(cb)
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
        hoverId: expect.any(String),
      }),
    )
  })

  it('emits a final duration update when hover ends after dwell has fired', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb)
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

    expect(secondMeta.hoverId).toBe(firstMeta.hoverId)
    expect(secondMeta.totalHoverMs).toBe(1400)
  })

  it('does not emit when hover ends before dwell time completes', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb)
    obs.observe(el)

    dispatchHoverEnter(el)
    await advance(400)
    dispatchHoverLeave(el)
    await advance(1000)

    expect(cb).not.toHaveBeenCalled()
  })

  it('assigns a new hoverId for each new hover cycle', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb)
    obs.observe(el)

    dispatchHoverEnter(el)
    await advance(1000)
    dispatchHoverLeave(el)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    dispatchHoverEnter(el)
    await advance(1000)

    expect(cb).toHaveBeenCalledTimes(3)

    const firstMeta = cb.mock.calls[0]?.[1]
    const thirdMeta = cb.mock.calls[2]?.[1]
    if (!isMeta(firstMeta) || !isMeta(thirdMeta)) {
      throw new Error('Unexpected callback payload')
    }

    expect(firstMeta.hoverId).not.toBe(thirdMeta.hoverId)
  })

  it('ends on hide and requires a fresh pointer entry after the page returns', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb)
    obs.observe(el)

    dispatchHoverEnter(el)

    await advance(300)
    setDocumentVisibility('hidden')
    expect(cb).not.toHaveBeenCalled()

    setDocumentVisibility('visible')
    await advance(1000)
    expect(cb).not.toHaveBeenCalled()

    dispatchHoverEnter(el)
    await advance(1000)
    expect(cb).toHaveBeenCalledTimes(1)

    await advance(250)
    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(new Event('beforeunload'))
    await obs.endActive()

    expect(cb).toHaveBeenCalledTimes(2)
    const startMeta = cb.mock.calls[0]?.[1]
    const finalMeta = cb.mock.calls[1]?.[1]
    if (!isMeta(startMeta) || !isMeta(finalMeta)) {
      throw new Error('Unexpected callback payload')
    }
    expect(finalMeta.hoverId).toBe(startMeta.hoverId)
    expect(finalMeta.totalHoverMs).toBe(1250)
  })

  it('passes per-element data to the callback', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb)

    obs.observe(el, {
      data: { id: 'xyz' },
    })

    dispatchHoverEnter(el)

    await advance(1000)

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(
      el,
      expect.objectContaining<Partial<Meta>>({
        attempts: 1,
        totalHoverMs: 1000,
        hoverId: expect.any(String),
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

    const obs = new ElementHoverObserver(cb)
    obs.observe(el)

    dispatchHoverEnter(el)
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
    expect(finalMeta.hoverId).toBe(startMeta.hoverId)
    expect(finalMeta.totalHoverMs).toBe(1250)
  })

  it('emits the final callback after a start callback failure', async () => {
    const el = makeElement()
    let calls = 0
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockImplementation(async () => {
      calls += 1
      if (calls === 1) throw new Error('fail-once')
      await Promise.resolve()
    })

    const obs = new ElementHoverObserver(cb)
    obs.observe(el)

    dispatchHoverEnter(el)

    await advance(1000)
    await advance(250)
    await obs.endActive()
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('unobserve cancels pending dwell timers', async () => {
    const el = makeElement()
    const cb = rs.fn().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb)
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

    const obs = new ElementHoverObserver(cb)
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

    const obs = new ElementHoverObserver(cb)
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

    const obs = new ElementHoverObserver(cb)
    obs.observe(el)

    dispatchTouchPointerEnter(el)
    await advance(0)

    expect(cb).not.toHaveBeenCalled()
  })

  it('endActive is idempotent and emits one final callback for a qualified hover', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb)
    obs.observe(el)

    dispatchHoverEnter(el)

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

    expect(secondMeta.hoverId).toBe(firstMeta.hoverId)
    expect(secondMeta.totalHoverMs).toBe(1750)
  })

  it('endActive emits nothing for a sub-dwell hover', async () => {
    const el = makeElement()
    const cb = rs.fn<(e: Element, m: Meta) => Promise<void>>().mockResolvedValue(undefined)

    const obs = new ElementHoverObserver(cb)
    obs.observe(el)

    dispatchHoverEnter(el)

    await advance(500)
    await obs.endActive()

    expect(cb).not.toHaveBeenCalled()
  })
})
