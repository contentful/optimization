// NT-3678: web-side preview-mode detection.
//
// Under PUSH_EDITOR + SESSION_SETTINGS the editor appends
// `?preview_session_id=<id>` to the resolved preview URL. `nt_preview=1` is
// the legacy switch (Preview Widget parity) — we accept either. Callers wire
// this up at browser bootstrap; non-browser hosts set the signal explicitly.

const PREVIEW_QUERY_KEYS = ['preview_session_id', 'nt_preview'] as const

export interface DetectPreviewModeOptions {
  search?: string
}

/**
 * Returns true when the URL query indicates the SDK is loading under an ExO
 * preview session.
 */
export function detectPreviewMode(options: DetectPreviewModeOptions = {}): boolean {
  const search = options.search ?? readWindowSearch()
  if (!search) return false

  const params = new URLSearchParams(search)
  for (const key of PREVIEW_QUERY_KEYS) {
    const value = params.get(key)
    if (value !== null && value !== '' && value !== 'false' && value !== '0') return true
  }
  return false
}

interface WindowLike {
  location?: { search?: string }
}

function readWindowSearch(): string {
  const { window: win } = globalThis as typeof globalThis & { window?: WindowLike }
  const search = win?.location?.search
  return typeof search === 'string' ? search : ''
}
