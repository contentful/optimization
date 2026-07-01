import { isBrowser } from './isBrowser'

describe('isBrowser', () => {
  it('returns true when window is defined', () => {
    expect(typeof window).toBe('object')
    expect(isBrowser()).toBe(true)
  })

  it('returns false when window is undefined', () => {
    const original = globalThis.window

    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    try {
      expect(isBrowser()).toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: original,
        configurable: true,
        writable: true,
      })
    }
  })
})
