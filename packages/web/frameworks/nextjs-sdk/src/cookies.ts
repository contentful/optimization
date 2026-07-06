import { isRecord } from '@contentful/optimization-node/api-schemas'
import {
  DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
  type CoreStatelessRequest,
  type NextjsAnonymousIdCookieOptions,
  type NextjsCookieReader,
  type OptimizationData,
  type PersistNextjsAnonymousIdOptions,
} from './server'

export function isNextjsCookieReader(value: unknown): value is NextjsCookieReader {
  return isRecord(value) && typeof value.get === 'function'
}

export function createCookieReaderFromRecord(value: unknown): NextjsCookieReader | undefined {
  if (!isRecord(value)) return undefined

  return {
    get: (name) => {
      const { [name]: cookieValue } = value
      return typeof cookieValue === 'string' ? { value: cookieValue } : undefined
    },
  }
}

export function createCookieReaderFromHeader(
  cookieHeader: string | null | undefined,
): NextjsCookieReader | undefined {
  if (!cookieHeader) return undefined

  return {
    get: (name) => {
      const value = readCookieHeaderValue(cookieHeader, name)
      return value === undefined ? undefined : { value }
    },
  }
}

export function createNextjsAnonymousIdSetCookieHeader(
  requestOptimization: CoreStatelessRequest,
  data: OptimizationData | undefined,
  {
    anonymousIdCookieName = DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
    cookieOptions,
    deleteWhenProfileCannotPersist = true,
  }: PersistNextjsAnonymousIdOptions = {},
): string | undefined {
  const profileId = data?.profile.id ?? requestOptimization.profile?.id

  if (requestOptimization.canPersistProfile && profileId) {
    return serializeCookie(anonymousIdCookieName, profileId, {
      path: '/',
      sameSite: 'lax',
      ...cookieOptions,
    })
  }

  if (!deleteWhenProfileCannotPersist) return undefined

  return serializeCookie(anonymousIdCookieName, '', {
    path: '/',
    sameSite: 'lax',
    ...cookieOptions,
    expires: new Date(0),
    maxAge: 0,
  })
}

function readCookieHeaderValue(cookieHeader: string, cookieName: string): string | undefined {
  for (const cookiePart of cookieHeader.split(';')) {
    const separatorIndex = cookiePart.indexOf('=')
    if (separatorIndex === -1) continue

    const name = cookiePart.slice(0, separatorIndex).trim()
    if (name !== cookieName) continue

    return decodeCookieValue(cookiePart.slice(separatorIndex + 1).trim())
  }

  return undefined
}

function decodeCookieValue(value: string): string {
  const unquotedValue =
    value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value

  try {
    return decodeURIComponent(unquotedValue)
  } catch (_error) {
    return unquotedValue
  }
}

function serializeCookie(
  name: string,
  value: string,
  options: NextjsAnonymousIdCookieOptions,
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.trunc(options.maxAge)}`)
  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')

  const sameSite = serializeSameSite(options.sameSite)
  if (sameSite) parts.push(`SameSite=${sameSite}`)

  return parts.join('; ')
}

function serializeSameSite(
  sameSite: NextjsAnonymousIdCookieOptions['sameSite'],
): string | undefined {
  if (sameSite === undefined || sameSite === false) return undefined
  if (sameSite === true) return 'Strict'

  return sameSite.slice(0, 1).toUpperCase() + sameSite.slice(1)
}
