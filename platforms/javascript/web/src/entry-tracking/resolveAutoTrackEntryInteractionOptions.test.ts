import { resolveAutoTrackEntryInteractionOptions } from './resolveAutoTrackEntryInteractionOptions'

describe('resolveAutoTrackEntryInteractionOptions', () => {
  it('defaults auto-track values to false when omitted', () => {
    expect(resolveAutoTrackEntryInteractionOptions()).toEqual({
      clicks: false,
      views: false,
    })
  })

  it('applies provided values while preserving defaults for omitted keys', () => {
    expect(resolveAutoTrackEntryInteractionOptions({ views: true })).toEqual({
      clicks: false,
      views: true,
    })
  })
})
