import { createVisibilityChangeListener } from './createVisibilityChangeListener'

const setVisibilityState = (state: 'visible' | 'hidden'): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

describe('createVisibilityChangeListener', () => {
  afterEach(() => {
    rs.restoreAllMocks()
    setVisibilityState('visible')
  })

  it('invokes callback when page becomes hidden', () => {
    const cb = rs.fn()
    const cleanup = createVisibilityChangeListener(cb)

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(expect.any(Event))
    cleanup()
  })

  it('invokes callback at most once per hide cycle until reset', () => {
    const cb = rs.fn()
    const cleanup = createVisibilityChangeListener(cb)

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))

    expect(cb).toHaveBeenCalledTimes(1)

    setVisibilityState('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(cb).toHaveBeenCalledTimes(2)
    cleanup()
  })

  it('resets handled state on pageshow', () => {
    const cb = rs.fn()
    const cleanup = createVisibilityChangeListener(cb)

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pageshow'))
    window.dispatchEvent(new Event('pagehide'))

    expect(cb).toHaveBeenCalledTimes(2)
    cleanup()
  })

  it('invokes callback on beforeunload and only once per hide cycle', () => {
    const cb = rs.fn()
    const cleanup = createVisibilityChangeListener(cb)

    window.dispatchEvent(new Event('beforeunload'))
    window.dispatchEvent(new Event('pagehide'))

    expect(cb).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('pageshow'))
    window.dispatchEvent(new Event('beforeunload'))

    expect(cb).toHaveBeenCalledTimes(2)
    cleanup()
  })

  it('removes listeners on cleanup', () => {
    const cb = rs.fn()
    const cleanup = createVisibilityChangeListener(cb)

    cleanup()
    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(new Event('beforeunload'))

    expect(cb).not.toHaveBeenCalled()
  })
})
