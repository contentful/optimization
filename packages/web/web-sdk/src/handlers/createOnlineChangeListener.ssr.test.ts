import { createOnlineChangeListener } from './createOnlineChangeListener'

rs.mock('../constants', () => ({
  CAN_ADD_LISTENERS: false,
}))

describe('createOnlineChangeListener (SSR)', () => {
  it('returns a no-op cleanup and never invokes the callback when listeners are unavailable', () => {
    const cb = rs.fn()
    const cleanup = createOnlineChangeListener(cb)

    expect(cb).not.toHaveBeenCalled()
    expect(() => {
      cleanup()
    }).not.toThrow()
  })
})
