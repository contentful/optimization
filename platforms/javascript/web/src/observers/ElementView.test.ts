// @vitest-environment happy-dom
import {
  cancelRetry,
  clearFireTimer,
  DEFAULTS,
  derefElement,
  isPageVisible,
  NOW,
  Num,
  withJitter,
  type ElementState,
  type PerElementEffectiveOptions,
} from './ElementView'

const defaultPerElOpts: PerElementEffectiveOptions = {
  dwellTimeMs: 1000,
  maxRetries: 2,
  retryBackoffMs: 300,
  backoffMultiplier: 2,
}

const makeState = (overrides: Partial<ElementState> = {}): ElementState => ({
  ref: null,
  strongRef: null,
  opts: defaultPerElOpts,
  data: undefined,
  accumulatedMs: 0,
  visibleSince: null,
  fireTimer: null,
  retryTimer: null,
  retryScheduledAt: null,
  retryDelayMs: null,
  pendingRetry: false,
  attempts: 0,
  done: false,
  inFlight: false,
  lastKnownVisible: false,
  ...overrides,
})

const setVisibilityState = (state: 'visible' | 'hidden'): void => {
  // Override possibly-readonly property
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
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
    const perfSpy = vi.spyOn(performance, 'now').mockReturnValue(42)
    const dateSpy = vi.spyOn(Date, 'now')
    expect(NOW()).toBe(42)
    expect(perfSpy).toHaveBeenCalledTimes(1)
    expect(dateSpy).not.toHaveBeenCalled()
  })

  it('falls back to Date.now() when performance is undefined', () => {
    const { performance: originalPerf } = globalThis
    vi.stubGlobal('performance', undefined)
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(123456)
    expect(NOW()).toBe(123456)
    // restore immediately to keep other tests safe
    vi.stubGlobal('performance', originalPerf)
    expect(dateSpy).toHaveBeenCalledTimes(1)
  })
})

describe('withJitter', () => {
  it('adds jitter in [0, max(1, floor(base/divisor)))', () => {
    const base = 100
    const span = Math.max(1, Math.floor(base / DEFAULTS.JITTER_DIVISOR))

    vi.spyOn(Math, 'random').mockReturnValueOnce(0) // +0
    expect(withJitter(base)).toBe(base)

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5) // +floor(0.5*span)
    expect(withJitter(base)).toBe(base + Math.floor(0.5 * span))

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9999) // +(span-1)
    expect(withJitter(base)).toBe(base + (span - 1))
  })

  it('handles small bases (0, 1) using max(1, ...)', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.7)
    expect(withJitter(0)).toBe(0)

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.2)
    expect(withJitter(1)).toBe(1)
  })
})

describe('Num helpers', () => {
  it('n(value,fallback)', () => {
    expect(Num.n(5, 99)).toBe(5)
    expect(Num.n('x', 99)).toBe(99)
    expect(Num.n(undefined, 3)).toBe(3)
  })

  it('clamp01', () => {
    expect(Num.clamp01(2, 0.3)).toBe(1)
    expect(Num.clamp01(-5, 0.4)).toBe(0)
    expect(Num.clamp01(undefined, 0.4)).toBeCloseTo(0.4)
  })

  it('nonNeg', () => {
    expect(Num.nonNeg(-10, 5)).toBe(0)
    expect(Num.nonNeg(12, 5)).toBe(12)
    expect(Num.nonNeg(undefined, 7)).toBe(7)
  })

  it('atLeast1', () => {
    expect(Num.atLeast1(0, 4)).toBe(1)
    expect(Num.atLeast1(5, 4)).toBe(5)
    expect(Num.atLeast1(undefined, 2)).toBe(2)
  })
})

describe('Timer utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('clearFireTimer clears existing handle and nulls it', () => {
    const handle = setTimeout(() => undefined, 1000)
    const state = makeState({ fireTimer: handle })
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    clearFireTimer(state)
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledWith(handle)
    expect(state.fireTimer).toBeNull()
  })

  it('clearFireTimer is no-op when null', () => {
    const state = makeState({ fireTimer: null })
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    clearFireTimer(state)
    expect(clearSpy).not.toHaveBeenCalled()
    expect(state.fireTimer).toBeNull()
  })

  it('cancelRetry clears existing handle and resets scheduling', () => {
    const handle = setTimeout(() => undefined, 1000)
    const state = makeState({ retryTimer: handle, retryScheduledAt: 12345 })
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    cancelRetry(state)
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledWith(handle)
    expect(state.retryTimer).toBeNull()
    expect(state.retryScheduledAt).toBeNull()
  })

  it('cancelRetry is no-op when null, but still nulls retryScheduledAt', () => {
    const state = makeState({ retryTimer: null, retryScheduledAt: 555 })
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    cancelRetry(state)
    expect(clearSpy).not.toHaveBeenCalled()
    expect(state.retryTimer).toBeNull()
    expect(state.retryScheduledAt).toBeNull()
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
