import { resolveTrackEntryInteractionOptions } from './optimizationRootRuntime'

describe('resolveTrackEntryInteractionOptions', () => {
  it('defaults root entry interaction tracking to enabled', () => {
    expect(resolveTrackEntryInteractionOptions(undefined)).toEqual({
      clicks: true,
      hovers: true,
      views: true,
    })
  })

  it('preserves explicit opt-out values', () => {
    expect(resolveTrackEntryInteractionOptions({ clicks: false, hovers: false })).toEqual({
      clicks: false,
      hovers: false,
      views: true,
    })
  })
})
