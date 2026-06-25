import { DOCUMENT, isPlatformBrowser } from '@angular/common'
import { inject, Injectable, PLATFORM_ID } from '@angular/core'

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
 * Browser-side consent cookie writer. Uses Angular's {@link DOCUMENT} token
 * instead of touching the global `document` directly so the dependency is
 * explicit and easy to swap in tests. No-ops on the server, where
 * `@angular/platform-server` provides a stub `Document` that throws on
 * `cookie` writes.
 */
@Injectable({ providedIn: 'root' })
export class ConsentCookie {
  private readonly document = inject(DOCUMENT)
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID))

  write(consent: boolean): void {
    if (!this.isBrowser) return
    const value = consent ? 'granted' : 'denied'
    this.document.cookie = `${APP_PERSONALIZATION_CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax`
  }
}
