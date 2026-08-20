import { shouldRememberStickyEntryViewResult, shouldSendStickyEntryView } from './EntryViewTracking'

describe('EntryViewTracking', () => {
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
