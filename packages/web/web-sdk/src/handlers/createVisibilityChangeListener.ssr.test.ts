import { createVisibilityChangeListener } from './createVisibilityChangeListener'

rs.mock('../constants', () => ({
  CAN_ADD_LISTENERS: false,
}))

describe('createVisibilityChangeListener (SSR)', () => {
  it('returns a no-op cleanup and never invokes the callback when listeners are unavailable', () => {
    const cb = rs.fn()
    const cleanup = createVisibilityChangeListener(cb)

    expect(cb).not.toHaveBeenCalled()
    expect(() => {
      cleanup()
    }).not.toThrow()
  })
})
