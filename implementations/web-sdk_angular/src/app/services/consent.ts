/**
 * App-level consent storage.
 *
 * Consent is a consumer-application concern: the SDK only needs the resolved
 * boolean. This module owns the `app-personalization-consent` cookie name and
 * read/write helpers used both server-side (during SSR preflight) and
 * browser-side (when the user toggles consent in the UI).
 */
const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

/**
 * Resolve consent from a request cookie. Returns `false` when the cookie is
 * missing or any value other than `granted`, so callers can branch on a
 * single boolean.
 */
export function readConsentFromRequest(request: Request): boolean {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    if (trimmed.slice(0, eq) === APP_PERSONALIZATION_CONSENT_COOKIE) {
      return trimmed.slice(eq + 1) === 'granted'
    }
  }
  return false
}

/**
 * Persist the user's consent decision to a cookie the server can read on the
 * next request. Browser-only; no-ops in SSR contexts where `document` is
 * undefined.
 */
export function writeConsentCookie(consent: boolean): void {
  if (typeof document === 'undefined') return
  const value = consent ? 'granted' : 'denied'
  document.cookie = `${APP_PERSONALIZATION_CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax`
}
