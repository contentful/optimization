import { createOnlineChangeListener } from './createOnlineChangeListener'

describe('createOnlineChangeListener', () => {
  afterEach(() => {
    rs.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'onLine')
  })

  it('emits initial online state from navigator.onLine', () => {
    rs.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const cb = rs.fn()

    const cleanup = createOnlineChangeListener(cb)

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(true)
    cleanup()
  })

  it('falls back to true when navigator.onLine is unavailable', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => undefined,
    })
    const cb = rs.fn()

    const cleanup = createOnlineChangeListener(cb)

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(true)
    cleanup()
  })

  it('emits state transitions for offline and online browser events', () => {
    rs.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const cb = rs.fn()

    const cleanup = createOnlineChangeListener(cb)
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))

    expect(cb).toHaveBeenNthCalledWith(1, true)
    expect(cb).toHaveBeenNthCalledWith(2, false)
    expect(cb).toHaveBeenNthCalledWith(3, true)
    cleanup()
  })

  it('removes listeners on cleanup', () => {
    rs.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const cb = rs.fn()

    const cleanup = createOnlineChangeListener(cb)
    cleanup()

    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))

    expect(cb).toHaveBeenCalledTimes(1)
  })
})
