import {
  createPageContextFromUrl,
  type UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'
import { NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER } from './request-context'
import type { NextjsPageContextInput, NextjsRequestHandoffOptions } from './server'

export function getForwardedRequestPage(
  headers: Headers | undefined,
  referrer: string | undefined,
): NonNullable<UniversalEventBuilderArgs['page']> | undefined {
  const requestUrl = headers?.get(NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER)
  if (!requestUrl) return undefined
  return createPageContextFromUrl(requestUrl, { referrer })
}

export function createNextjsRequestRouteKey(
  options: NextjsRequestHandoffOptions,
  getExplicitPage: (
    page: NextjsPageContextInput | undefined,
  ) => NonNullable<UniversalEventBuilderArgs['page']> | undefined,
): string | undefined {
  const requestUrl = getRequestUrl(options)
  const requestRouteKey = requestUrl === undefined ? undefined : toRouteKey(requestUrl)
  if (requestRouteKey !== undefined) return requestRouteKey

  const explicitPageRouteKey = toExplicitPageRouteKey(options, getExplicitPage)
  if (explicitPageRouteKey !== undefined) return explicitPageRouteKey

  return toPagePayloadRouteKey(options)
}

function getRequestUrl(options: NextjsRequestHandoffOptions): string | undefined {
  if (options.request !== undefined) return options.request.url
  return options.headers?.get(NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER) ?? undefined
}

function toExplicitPageRouteKey(
  options: NextjsRequestHandoffOptions,
  getExplicitPage: (
    page: NextjsPageContextInput | undefined,
  ) => NonNullable<UniversalEventBuilderArgs['page']> | undefined,
): string | undefined {
  const page = getExplicitPage(options.page)
  return page === undefined ? undefined : `${page.path}${page.search}`
}

function toPagePayloadRouteKey(options: NextjsRequestHandoffOptions): string | undefined {
  const { path, search } = options.pagePayload.properties ?? {}
  if (typeof path !== 'string') return undefined

  return `${path}${typeof search === 'string' ? search : ''}`
}

function toRouteKey(value: string): string | undefined {
  try {
    const url = new URL(value, 'http://localhost')
    return `${url.pathname}${url.search}`
  } catch {
    return undefined
  }
}
