import {
  ANONYMOUS_ID_COOKIE,
  type CoreStatelessRequest,
  type OptimizationData,
} from '@contentful/optimization-react-web/core-sdk'
import type { NextjsCookieReader, NextjsOptimizationCookieConfig } from './bound-component-types'
import type { NextjsResponseLike } from './server'

const SECONDS_IN_DAY = 86_400

export const DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE = ANONYMOUS_ID_COOKIE

export interface NextjsAnonymousIdCookieOptions {
  readonly domain?: string
  readonly expires?: Date
  readonly httpOnly?: boolean
  readonly maxAge?: number
  readonly path?: string
  readonly sameSite?: boolean | 'lax' | 'none' | 'strict'
  readonly secure?: boolean
}

export interface PersistNextjsAnonymousIdOptions {
  readonly anonymousIdCookieName?: string
  readonly cookieOptions?: NextjsAnonymousIdCookieOptions
  readonly deleteWhenProfileCannotPersist?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
  options: PersistNextjsAnonymousIdOptions = {},
): string | undefined {
  const cookie = resolveAnonymousIdCookie(requestOptimization, data, options)
  return cookie === undefined
    ? undefined
    : serializeCookie(cookie.name, cookie.value, cookie.options)
}

function resolveAnonymousIdCookie(
  requestOptimization: CoreStatelessRequest,
  data: OptimizationData | undefined,
  {
    anonymousIdCookieName = DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
    cookieOptions,
    deleteWhenProfileCannotPersist = true,
  }: PersistNextjsAnonymousIdOptions,
):
  | {
      readonly name: string
      readonly value: string
      readonly options: NextjsAnonymousIdCookieOptions
    }
  | undefined {
  const profileId = data?.profile.id ?? requestOptimization.profile?.id
  const options: NextjsAnonymousIdCookieOptions = { path: '/', sameSite: 'lax', ...cookieOptions }
  if (requestOptimization.canPersistProfile) {
    return profileId ? { name: anonymousIdCookieName, value: profileId, options } : undefined
  }
  if (!deleteWhenProfileCannotPersist) return undefined
  return {
    name: anonymousIdCookieName,
    value: '',
    options: { ...options, expires: new Date(0), maxAge: 0 },
  }
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

export function toNextjsAnonymousIdCookieOptions(
  cookie: NextjsOptimizationCookieConfig | undefined,
): NextjsAnonymousIdCookieOptions | undefined {
  if (cookie === undefined) return undefined
  const { expires, ...attributes } = cookie
  return {
    ...attributes,
    ...(typeof expires === 'number' && Number.isFinite(expires)
      ? { maxAge: Math.trunc(expires * SECONDS_IN_DAY) }
      : {}),
  }
}

/**
 * Persist an API-issued profile ID in the response cookie when request persistence consent allows it.
 *
 * The ID comes from `data` or the bound request profile. When persistence is not allowed, the
 * cookie is deleted by default.
 *
 * @public
 */
export function persistNextjsAnonymousId(
  response: NextjsResponseLike,
  requestOptimization: CoreStatelessRequest,
  data: OptimizationData | undefined,
  options: PersistNextjsAnonymousIdOptions = {},
): void {
  const cookie = resolveAnonymousIdCookie(requestOptimization, data, options)
  if (cookie !== undefined) response.cookies.set(cookie.name, cookie.value, cookie.options)
}
