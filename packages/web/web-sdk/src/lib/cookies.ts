const EXPIRED_UTC = 'Thu, 01 Jan 1970 00:00:00 GMT'
const MS_IN_DAY = 86_400_000

/**
 * Supported cookie attributes for the Web SDK.
 *
 * @public
 * @remarks
 * These options are used when persisting the anonymous ID cookie.
 */
export interface CookieAttributes {
  /**
   * Cookie domain attribute.
   *
   * @remarks
   * If omitted, the browser will scope the cookie to the current host.
   */
  domain?: string

  /**
   * Determines the expiration date of the cookie as the number of days until the cookie expires.
   */
  expires?: number
  /** Cookie path; defaults to `/`. */
  path?: string
  /** Cross-site cookie policy. */
  sameSite?: 'lax' | 'strict' | 'none'
  /** Require HTTPS when writing the cookie. */
  secure?: boolean
}

export const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined

  const prefix = `${name}=`
  const cookies = document.cookie ? document.cookie.split('; ') : []

  for (const cookie of cookies) {
    if (!cookie.startsWith(prefix)) continue
    return cookie.slice(prefix.length)
  }

  return undefined
}

function serializeCookieScope(attributes?: CookieAttributes): string {
  let cookie = `; Path=${attributes?.path ?? '/'}`
  if (attributes?.domain) {
    cookie += `; Domain=${attributes.domain}`
  }
  if (attributes?.sameSite) cookie += `; SameSite=${attributes.sameSite}`
  if (attributes?.secure) cookie += '; Secure'
  return cookie
}

export const setCookie = (name: string, value: string, attributes?: CookieAttributes): void => {
  if (typeof document === 'undefined') return

  let cookie = `${name}=${value}${serializeCookieScope(attributes)}`
  if (typeof attributes?.expires === 'number' && Number.isFinite(attributes.expires)) {
    cookie += `; Expires=${new Date(Date.now() + attributes.expires * MS_IN_DAY).toUTCString()}`
  }

  document.cookie = cookie
}

export const removeCookie = (name: string, attributes?: CookieAttributes): void => {
  if (typeof document === 'undefined') return

  document.cookie = `${name}=; Expires=${EXPIRED_UTC}${serializeCookieScope(attributes)}`
}
