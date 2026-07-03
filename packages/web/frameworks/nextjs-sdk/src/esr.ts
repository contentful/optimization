import { isRecord } from '@contentful/optimization-node/api-schemas'
import type { NextRequest, NextResponse } from 'next/server'
import {
  createCookieReaderFromHeader,
  createNextjsAnonymousIdSetCookieHeader,
  isNextjsCookieReader,
} from './cookies'
import {
  getNextjsServerOptimizationData,
  persistNextjsAnonymousId,
  type ContentfulOptimization,
  type CoreStatelessRequest,
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

  return createCookieReaderFromHeader(request.headers.get('cookie'))
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
  options: PersistNextjsAnonymousIdOptions,
): void {
  const setCookie = createNextjsAnonymousIdSetCookieHeader(requestOptimization, data, options)
  if (setCookie === undefined) return

  response.headers.append('set-cookie', setCookie)
}

function isNextResponseLike(response: NextjsEsrResponse): response is NextResponse {
  if (!isRecord(response)) return false

  return (
    isRecord(response.cookies) &&
    typeof response.cookies.delete === 'function' &&
    typeof response.cookies.set === 'function'
  )
}
