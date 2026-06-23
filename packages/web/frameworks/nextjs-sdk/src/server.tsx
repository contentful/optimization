import ContentfulOptimizationRuntime, {
  type OptimizationNodeConfig,
} from '@contentful/optimization-node'
import type { OptimizationData, PartialProfile } from '@contentful/optimization-node/api-schemas'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import type {
  CoreStatelessInsightsOptions,
  CoreStatelessRequest,
  CoreStatelessRequestConsent,
  CoreStatelessRequestOptions,
  PageViewBuilderArgs,
  UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'
import { createElement, type JSX, type ReactElement, type ReactNode } from 'react'
import {
  getServerTrackingAttributes,
  type ServerTrackingAttributeOptions,
  type ServerTrackingAttributes,
  type ServerTrackingBaselineEntry,
  type ServerTrackingResolvedData,
} from './tracking-attributes'

export const DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE = ANONYMOUS_ID_COOKIE
export type ContentfulOptimization = ContentfulOptimizationRuntime
export type { OptimizationNodeConfig } from '@contentful/optimization-node'
export type { OptimizationData, PartialProfile } from '@contentful/optimization-node/api-schemas'
export type {
  CoreStatelessInsightsOptions,
  CoreStatelessRequest,
  CoreStatelessRequestConsent,
  CoreStatelessRequestOptions,
  PageViewBuilderArgs,
  ResolvedData,
  UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'
export type {
  ServerTrackingAttributeOptions,
  ServerTrackingAttributes,
  ServerTrackingBaselineEntry,
  ServerTrackingResolvedData,
} from './tracking-attributes'

export interface NextjsCookieValue {
  readonly value: string
}

export interface NextjsCookieReader {
  get: (name: string) => NextjsCookieValue | undefined
}

export interface NextjsCookieWriter {
  delete: (name: string) => void
  set: (name: string, value: string, options?: NextjsAnonymousIdCookieOptions) => void
}

export interface NextjsHeadersLike {
  get: (name: string) => string | null
}

export interface NextjsRequestLike {
  readonly cookies?: NextjsCookieReader
  readonly headers: NextjsHeadersLike
  readonly url: string
}

export interface NextjsResponseLike {
  readonly cookies: NextjsCookieWriter
}

export interface NextjsAnonymousIdCookieOptions {
  readonly domain?: string
  readonly expires?: Date
  readonly httpOnly?: boolean
  readonly maxAge?: number
  readonly path?: string
  readonly sameSite?: boolean | 'lax' | 'none' | 'strict'
  readonly secure?: boolean
}

export interface BindNextjsOptimizationRequestOptions {
  readonly anonymousIdCookieName?: string
  readonly consent: CoreStatelessRequestConsent
  readonly cookies?: NextjsCookieReader
  readonly eventContext?: UniversalEventBuilderArgs
  readonly experienceOptions?: CoreStatelessRequestOptions
  readonly headers?: NextjsHeadersLike
  readonly insightsOptions?: CoreStatelessInsightsOptions
  readonly locale?: string
  readonly profile?: PartialProfile
  readonly request?: NextjsRequestLike
}

export interface NextjsServerOptimizationDataOptions extends BindNextjsOptimizationRequestOptions {
  readonly pagePayload?: PageViewBuilderArgs
}

export interface NextjsServerOptimizationData {
  readonly data: OptimizationData | undefined
  readonly requestOptimization: CoreStatelessRequest
}

export interface PersistNextjsAnonymousIdOptions {
  readonly anonymousIdCookieName?: string
  readonly cookieOptions?: NextjsAnonymousIdCookieOptions
  readonly deleteWhenProfileCannotPersist?: boolean
}

type ServerOptimizedEntryOwnProps<TElement extends keyof JSX.IntrinsicElements> =
  ServerTrackingAttributeOptions & {
    readonly as?: TElement
    readonly baselineEntry: ServerTrackingBaselineEntry
    readonly children?: ReactNode
    readonly resolvedData: ServerTrackingResolvedData
  }

type DataCtflAttributeName = `data-ctfl-${string}`

export type ServerOptimizedEntryProps<TElement extends keyof JSX.IntrinsicElements = 'div'> =
  ServerOptimizedEntryOwnProps<TElement> &
    Omit<
      JSX.IntrinsicElements[TElement],
      keyof ServerOptimizedEntryOwnProps<TElement> | DataCtflAttributeName
    >

export function createNextjsOptimization(config: OptimizationNodeConfig): ContentfulOptimization {
  return new ContentfulOptimizationRuntime(config)
}

export function readNextjsAnonymousId(
  cookies: NextjsCookieReader | undefined,
  cookieName = DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
): string | undefined {
  const value = cookies?.get(cookieName)?.value
  return value && value.length > 0 ? value : undefined
}

type CreateNextjsRequestContextOptions = Pick<
  BindNextjsOptimizationRequestOptions,
  'eventContext' | 'headers' | 'locale' | 'request'
>

export function createNextjsRequestContext(
  options: CreateNextjsRequestContextOptions,
): UniversalEventBuilderArgs {
  const { eventContext, locale, request } = options
  const requestHeaders = getRequestHeaders(options)
  const userAgent = requestHeaders?.get('user-agent') ?? undefined
  const referrer = getRequestReferrer(requestHeaders, eventContext)
  const requestPage = getRequestPage(request, referrer)
  const page = mergePageContext(requestPage, eventContext?.page)

  return {
    ...eventContext,
    locale: locale ?? eventContext?.locale,
    page,
    userAgent: userAgent ?? eventContext?.userAgent,
  }
}

function getRequestHeaders({
  headers,
  request,
}: CreateNextjsRequestContextOptions): NextjsHeadersLike | undefined {
  return request?.headers ?? headers
}

function getRequestReferrer(
  headers: NextjsHeadersLike | undefined,
  eventContext: UniversalEventBuilderArgs | undefined,
): string | undefined {
  return headers?.get('referer') ?? eventContext?.page?.referrer
}

function getRequestPage(
  request: NextjsRequestLike | undefined,
  referrer: string | undefined,
): NonNullable<UniversalEventBuilderArgs['page']> | undefined {
  return request ? toPageContext(request.url, referrer) : undefined
}

export function bindNextjsOptimizationRequest(
  sdk: ContentfulOptimization,
  options: BindNextjsOptimizationRequestOptions,
): CoreStatelessRequest {
  const cookieReader = options.cookies ?? options.request?.cookies
  const anonymousId = readNextjsAnonymousId(cookieReader, options.anonymousIdCookieName)
  const profile = options.profile ?? (anonymousId ? { id: anonymousId } : undefined)

  return sdk.forRequest({
    consent: options.consent,
    eventContext: createNextjsRequestContext(options),
    experienceOptions: options.experienceOptions,
    insightsOptions: options.insightsOptions,
    locale: options.locale,
    profile,
  })
}

export async function getNextjsServerOptimizationData(
  sdk: ContentfulOptimization,
  options: NextjsServerOptimizationDataOptions,
): Promise<NextjsServerOptimizationData> {
  const requestOptimization = bindNextjsOptimizationRequest(sdk, options)
  const data = await requestOptimization.page(options.pagePayload)

  return { data, requestOptimization }
}

export function persistNextjsAnonymousId(
  response: NextjsResponseLike,
  requestOptimization: CoreStatelessRequest,
  data: OptimizationData | undefined,
  {
    anonymousIdCookieName = DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
    cookieOptions,
    deleteWhenProfileCannotPersist = true,
  }: PersistNextjsAnonymousIdOptions = {},
): void {
  const profileId = data?.profile.id ?? requestOptimization.profile?.id

  if (requestOptimization.canPersistProfile && profileId) {
    response.cookies.set(anonymousIdCookieName, profileId, {
      path: '/',
      sameSite: 'lax',
      ...cookieOptions,
    })
    return
  }

  if (deleteWhenProfileCannotPersist) {
    response.cookies.delete(anonymousIdCookieName)
  }
}

export function ServerOptimizedEntry<TElement extends keyof JSX.IntrinsicElements = 'div'>({
  as,
  baselineEntry,
  children,
  clickable,
  hoverDurationUpdateIntervalMs,
  resolvedData,
  trackClicks,
  trackHovers,
  trackViews,
  viewDurationUpdateIntervalMs,
  ...htmlProps
}: ServerOptimizedEntryProps<TElement>): ReactElement {
  const Element = as ?? 'div'
  const trackingAttributes: ServerTrackingAttributes = getServerTrackingAttributes(
    baselineEntry,
    resolvedData,
    {
      clickable,
      hoverDurationUpdateIntervalMs,
      trackClicks,
      trackHovers,
      trackViews,
      viewDurationUpdateIntervalMs,
    },
  )

  return createElement(Element, { ...htmlProps, ...trackingAttributes }, children)
}

function toPageContext(
  requestUrl: string,
  referrer: string | undefined,
): NonNullable<UniversalEventBuilderArgs['page']> {
  const url = new URL(requestUrl)

  return {
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    referrer: referrer ?? '',
    search: url.search,
    url: requestUrl,
  }
}

function mergePageContext(
  requestPage: NonNullable<UniversalEventBuilderArgs['page']> | undefined,
  eventPage: UniversalEventBuilderArgs['page'],
): UniversalEventBuilderArgs['page'] {
  if (requestPage && eventPage) {
    return {
      ...requestPage,
      ...eventPage,
    }
  }

  return eventPage ?? requestPage
}
