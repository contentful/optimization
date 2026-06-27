import { resolveAutoTrackEntryInteractionOptions } from './resolveAutoTrackEntryInteractionOptions'

describe('resolveAutoTrackEntryInteractionOptions', () => {
  it('defaults auto-track values to true when omitted', () => {
    expect(resolveAutoTrackEntryInteractionOptions()).toEqual({
      clicks: true,
      hovers: true,
      views: true,
    })
  })

  it('applies opt-out values while preserving defaults for omitted keys', () => {
    expect(resolveAutoTrackEntryInteractionOptions({ clicks: false })).toEqual({
      clicks: false,
      hovers: true,
      views: true,
    })
  })
})
