import { detectPreviewMode } from './detectPreviewMode'

describe('detectPreviewMode (NT-3678)', () => {
  it('returns false for an empty search string', () => {
    expect(detectPreviewMode({ search: '' })).toBe(false)
  })

  it('returns true when preview_session_id is present', () => {
    expect(detectPreviewMode({ search: '?preview_session_id=abc-123' })).toBe(true)
    expect(detectPreviewMode({ search: '?other=1&preview_session_id=xyz' })).toBe(true)
  })

  it('returns true when nt_preview is truthy', () => {
    expect(detectPreviewMode({ search: '?nt_preview=1' })).toBe(true)
    expect(detectPreviewMode({ search: '?nt_preview=true' })).toBe(true)
  })

  it('returns false when nt_preview is explicitly false or zero', () => {
    expect(detectPreviewMode({ search: '?nt_preview=false' })).toBe(false)
    expect(detectPreviewMode({ search: '?nt_preview=0' })).toBe(false)
  })

  it('returns false for unrelated params', () => {
    expect(detectPreviewMode({ search: '?utm_source=x' })).toBe(false)
  })

  it('returns false when preview_session_id is empty', () => {
    expect(detectPreviewMode({ search: '?preview_session_id=' })).toBe(false)
  })
})
