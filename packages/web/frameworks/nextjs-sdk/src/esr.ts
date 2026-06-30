import { isRecord } from '@contentful/optimization-node/api-schemas'
import type { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
  getNextjsServerOptimizationData,
  persistNextjsAnonymousId,
  type ContentfulOptimization,
  type CoreStatelessRequest,
  type NextjsAnonymousIdCookieOptions,
  type NextjsCookieReader,
  type NextjsRequestLike,
  type NextjsServerOptimizationDataOptions,
  type OptimizationData,
  type PersistNextjsAnonymousIdOptions,
} from './server'

export type NextjsEsrRequest = NextRequest | Request
export type NextjsEsrResponse = NextResponse | Response

export interface NextjsEsrOptimizationDataOptions
  extends
    Omit<NextjsServerOptimizationDataOptions, 'cookies' | 'headers' | 'request'>,
    PersistNextjsAnonymousIdOptions {
  readonly request: NextjsEsrRequest
}

export interface NextjsEsrOptimizationData {
  readonly data: OptimizationData | undefined
  readonly requestOptimization: CoreStatelessRequest
  readonly persist: (response: NextjsEsrResponse) => void
}

export async function getNextjsEsrOptimizationData(
  sdk: ContentfulOptimization,
  options: NextjsEsrOptimizationDataOptions,
): Promise<NextjsEsrOptimizationData> {
  const { cookieOptions, deleteWhenProfileCannotPersist, pagePayload, request, ...requestOptions } =
    options
  const requestLike = createNextjsEsrRequestLike(request)
  const { data, requestOptimization } = await getNextjsServerOptimizationData(sdk, {
    ...requestOptions,
    pagePayload,
    request: requestLike,
  })

  return {
    data,
    requestOptimization,
    persist: (response) => {
      persistNextjsEsrAnonymousId(response, requestOptimization, data, {
        anonymousIdCookieName: requestOptions.anonymousIdCookieName,
        cookieOptions,
        deleteWhenProfileCannotPersist,
      })
    },
  }
}

function createNextjsEsrRequestLike(request: NextjsEsrRequest): NextjsRequestLike {
  return {
    cookies: getNextjsEsrRequestCookies(request),
    headers: request.headers,
    url: request.url,
  }
}

function getNextjsEsrRequestCookies(request: NextjsEsrRequest): NextjsCookieReader | undefined {
  const nextCookies = 'cookies' in request ? request.cookies : undefined
  if (isNextjsCookieReader(nextCookies)) return nextCookies

  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return undefined

  return {
    get: (name) => {
      const value = readCookieHeaderValue(cookieHeader, name)
      return value === undefined ? undefined : { value }
    },
  }
}

function isNextjsCookieReader(value: unknown): value is NextjsCookieReader {
  return isRecord(value) && typeof value.get === 'function'
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

function persistNextjsEsrAnonymousId(
  response: NextjsEsrResponse,
  requestOptimization: CoreStatelessRequest,
  data: OptimizationData | undefined,
  options: PersistNextjsAnonymousIdOptions,
): void {
  if (isNextResponseLike(response)) {
    persistNextjsAnonymousId(response, requestOptimization, data, options)
    return
  }

  persistAnonymousIdSetCookieHeader(response, requestOptimization, data, options)
}

function persistAnonymousIdSetCookieHeader(
  response: Response,
  requestOptimization: CoreStatelessRequest,
  data: OptimizationData | undefined,
  {
    anonymousIdCookieName = DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
    cookieOptions,
    deleteWhenProfileCannotPersist = true,
  }: PersistNextjsAnonymousIdOptions,
): void {
  const profileId = data?.profile.id ?? requestOptimization.profile?.id

  if (requestOptimization.canPersistProfile && profileId) {
    response.headers.append(
      'set-cookie',
      serializeCookie(anonymousIdCookieName, profileId, {
        path: '/',
        sameSite: 'lax',
        ...cookieOptions,
      }),
    )
    return
  }

  if (deleteWhenProfileCannotPersist) {
    response.headers.append(
      'set-cookie',
      serializeCookie(anonymousIdCookieName, '', {
        path: '/',
        sameSite: 'lax',
        ...cookieOptions,
        expires: new Date(0),
        maxAge: 0,
      }),
    )
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

function isNextResponseLike(response: NextjsEsrResponse): response is NextResponse {
  if (!isRecord(response)) return false

  return (
    isRecord(response.cookies) &&
    typeof response.cookies.delete === 'function' &&
    typeof response.cookies.set === 'function'
  )
}
