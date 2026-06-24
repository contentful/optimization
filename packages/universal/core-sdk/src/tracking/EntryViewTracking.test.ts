import {
  getRemainingMsUntilNextEntryViewFire,
  resolveEntryViewTimingOptions,
  shouldRememberStickyEntryViewResult,
  shouldSendStickyEntryView,
} from './EntryViewTracking'

describe('EntryViewTracking', () => {
  it('resolves timing with platform defaults and normalized overrides', () => {
    expect(
      resolveEntryViewTimingOptions(
        {
          dwellTimeMs: -1,
          minVisibleRatio: 2,
          viewDurationUpdateIntervalMs: 2500,
        },
        {
          dwellTimeMs: 1000,
          minVisibleRatio: 0.1,
          viewDurationUpdateIntervalMs: 5000,
        },
      ),
    ).toEqual({
      dwellTimeMs: 0,
      minVisibleRatio: 1,
      viewDurationUpdateIntervalMs: 2500,
    })
  })

  it('computes remaining time from dwell, update interval, attempts, and accumulated time', () => {
    expect(
      getRemainingMsUntilNextEntryViewFire({
        dwellTimeMs: 2000,
        viewDurationUpdateIntervalMs: 5000,
        attempts: 2,
        accumulatedMs: 8500,
      }),
    ).toBe(3500)
  })

  it('applies sticky policy from runtime-local accepted state', () => {
    expect(shouldSendStickyEntryView(true, false)).toBe(true)
    expect(shouldSendStickyEntryView(true, true)).toBe(false)
    expect(shouldSendStickyEntryView(false, false)).toBe(false)
    expect(shouldSendStickyEntryView(undefined, false)).toBe(false)
  })

  it('remembers sticky results only after accepted sticky sends', () => {
    expect(shouldRememberStickyEntryViewResult(true, true)).toBe(true)
    expect(shouldRememberStickyEntryViewResult(true, false)).toBe(false)
    expect(shouldRememberStickyEntryViewResult(false, true)).toBe(false)
  })
})
