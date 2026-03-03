import {
  clearFireTimer,
  derefElement,
  isPageVisible,
  NOW,
  Num,
  type ElementState,
  type PerElementEffectiveOptions,
} from './element-hover-observer-support'

const defaultPerElOpts: PerElementEffectiveOptions = {
  dwellTimeMs: 1000,
  hoverDurationUpdateIntervalMs: 5000,
}

const makeState = (overrides: Partial<ElementState> = {}): ElementState => ({
  ref: null,
  strongRef: null,
  opts: defaultPerElOpts,
  data: undefined,
  accumulatedMs: 0,
  hoverSince: null,
  fireTimer: null,
  attempts: 0,
  componentHoverId: null,
  done: false,
  inFlight: false,
  isHovered: false,
  pendingFinal: false,
  enterHandler: () => undefined,
  leaveHandler: () => undefined,
  ...overrides,
})

const setVisibilityState = (state: 'visible' | 'hidden'): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
}

beforeEach(() => {
  rs.useRealTimers()
})

afterEach(() => {
  rs.restoreAllMocks()
  rs.unstubAllGlobals()
  rs.useRealTimers()
})

describe('Environment flags', () => {
  it('isPageVisible follows document.visibilityState (visible)', () => {
    setVisibilityState('visible')
    expect(isPageVisible()).toBe(true)
  })

  it('isPageVisible follows document.visibilityState (hidden)', () => {
    setVisibilityState('hidden')
    expect(isPageVisible()).toBe(false)
  })
})

describe('NOW', () => {
  it('uses performance.now() when available', () => {
    const perfSpy = rs.spyOn(performance, 'now').mockReturnValue(42)
    const dateSpy = rs.spyOn(Date, 'now')

    expect(NOW()).toBe(42)
    expect(perfSpy).toHaveBeenCalledTimes(1)
    expect(dateSpy).not.toHaveBeenCalled()
  })

  it('falls back to Date.now() when performance is undefined', () => {
    const { performance: originalPerf } = globalThis
    rs.stubGlobal('performance', undefined)
    const dateSpy = rs.spyOn(Date, 'now').mockReturnValue(123456)

    expect(NOW()).toBe(123456)

    rs.stubGlobal('performance', originalPerf)
    expect(dateSpy).toHaveBeenCalledTimes(1)
  })
})

describe('Num helpers', () => {
  it('n(value,fallback)', () => {
    expect(Num.n(5, 99)).toBe(5)
    expect(Num.n('x', 99)).toBe(99)
    expect(Num.n(undefined, 3)).toBe(3)
  })

  it('nonNeg', () => {
    expect(Num.nonNeg(-10, 5)).toBe(0)
    expect(Num.nonNeg(12, 5)).toBe(12)
    expect(Num.nonNeg(undefined, 7)).toBe(7)
  })
})

describe('Timer utilities', () => {
  beforeEach(() => {
    rs.useFakeTimers()
  })

  it('clearFireTimer clears existing handle and nulls it', () => {
    const handle = setTimeout(() => undefined, 1000)
    const state = makeState({ fireTimer: handle })
    const clearSpy = rs.spyOn(globalThis, 'clearTimeout')

    clearFireTimer(state)

    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledWith(handle)
    expect(state.fireTimer).toBeNull()
  })

  it('clearFireTimer is no-op when null', () => {
    const state = makeState({ fireTimer: null })
    const clearSpy = rs.spyOn(globalThis, 'clearTimeout')

    clearFireTimer(state)

    expect(clearSpy).not.toHaveBeenCalled()
    expect(state.fireTimer).toBeNull()
  })
})

describe('derefElement', () => {
  it('returns element via WeakRef when available', () => {
    const el = document.createElement('div')
    const state = makeState({ ref: new WeakRef(el), strongRef: null })
    expect(derefElement(state)).toBe(el)
  })

  it('falls back to strongRef when WeakRef.deref() is empty', () => {
    const el = document.createElement('div')
    const fakeWeakRef: WeakRef<Element> = {
      deref: (): undefined => undefined,
      [Symbol.toStringTag]: 'WeakRef',
    }
    const state = makeState({ ref: fakeWeakRef, strongRef: el })
    expect(derefElement(state)).toBe(el)
  })

  it('uses strongRef when WeakRef is null', () => {
    const el = document.createElement('div')
    const state = makeState({ ref: null, strongRef: el })
    expect(derefElement(state)).toBe(el)
  })

  it('returns null when neither ref yields an element', () => {
    const state = makeState({ ref: null, strongRef: null })
    expect(derefElement(state)).toBeNull()
  })
})
