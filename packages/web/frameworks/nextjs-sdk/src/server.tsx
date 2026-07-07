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
import { createPageContextFromUrl } from '@contentful/optimization-node/core-sdk'
import type { JSX, ReactElement, ReactNode } from 'react'
import type { NextjsCookieReader } from './bound-component-types'
import { NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER } from './request-context'
import { renderOptimizedEntryOnServer } from './server-entry-renderer'
import type {
  ServerTrackingAttributeOptions,
  ServerTrackingBaselineEntry,
  ServerTrackingResolvedData,
} from './tracking-attributes'

export const DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE = ANONYMOUS_ID_COOKIE
export type { OptimizationNodeConfig } from '@contentful/optimization-node'
export type { OptimizationData, PartialProfile } from '@contentful/optimization-node/api-schemas'
export {
  prefetchOptimizedEntries,
  type OptimizedEntryPrefetchDescriptor,
  type OptimizedEntryPrefetchRuntime,
  type ServerOptimizedEntryHandoff,
} from '@contentful/optimization-node/core-sdk'
export type {
  CoreStatelessInsightsOptions,
  CoreStatelessRequest,
  CoreStatelessRequestConsent,
  CoreStatelessRequestOptions,
  FetchOptimizedEntryResult,
  PageViewBuilderArgs,
  ResolvedData,
  UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'
export type {
  NextjsCookieReader,
  NextjsCookieValue,
  NextjsOptimizationServerConsent,
  NextjsOptimizationServerConsentContext,
  NextjsOptimizationServerConsentResolver,
} from './bound-component-types'
export {
  NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX,
  NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER,
} from './request-context'
export type {
  ServerTrackingAttributeOptions,
  ServerTrackingAttributes,
  ServerTrackingBaselineEntry,
  ServerTrackingResolvedData,
} from './tracking-attributes'
export type ContentfulOptimization = ContentfulOptimizationRuntime

export interface NextjsCookieWriter {
  delete: (name: string) => void
  set: (name: string, value: string, options?: NextjsAnonymousIdCookieOptions) => void
}

export interface NextjsRequestLike {
  readonly cookies?: NextjsCookieReader
  readonly headers: Headers
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
  readonly headers?: Headers
  readonly insightsOptions?: CoreStatelessInsightsOptions
  readonly locale?: string
  readonly page?: NextjsPageContextInput
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

/**
 * Query parameter value shape used by Next.js App Router `searchParams` props.
 *
 * @public
 */
export type NextjsSearchParamsValue = string | readonly string[] | undefined

/**
 * Query parameter container accepted by {@link createNextjsPageContext}.
 *
 * @public
 */
export type NextjsSearchParams = URLSearchParams | Readonly<Record<string, NextjsSearchParamsValue>>

/**
 * Options for creating page context from a Server Component route.
 *
 * @public
 */
export interface CreateNextjsPageContextOptions {
  /** Absolute request origin used to build `page.url` when `url` is omitted. */
  readonly origin?: string
  /** Route pathname, for example `/products`. */
  readonly path: string
  /** Referrer URL from request headers when available. */
  readonly referrer?: string
  /** App Router `searchParams` or a `URLSearchParams` instance. */
  readonly searchParams?: NextjsSearchParams
  /** Explicit full page URL. Takes precedence over `origin`. */
  readonly url?: string
}

export type NextjsPageContextInput =
  | NonNullable<UniversalEventBuilderArgs['page']>
  | CreateNextjsPageContextOptions

export type ServerOptimizedEntryFetchResult = ServerTrackingResolvedData & {
  readonly baselineEntry: ServerTrackingBaselineEntry
}

type ServerOptimizedEntryOwnProps<TElement extends keyof JSX.IntrinsicElements> =
  ServerTrackingAttributeOptions & {
    readonly as?: TElement
    readonly children?: ReactNode
  } & (
      | {
          readonly baselineEntry: ServerTrackingBaselineEntry
          readonly resolvedData: ServerTrackingResolvedData
          readonly result?: never
        }
      | {
          readonly baselineEntry?: never
          readonly resolvedData?: never
          readonly result: ServerOptimizedEntryFetchResult
        }
    )

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
  'eventContext' | 'headers' | 'locale' | 'page' | 'request'
>

export function createNextjsRequestContext(
  options: CreateNextjsRequestContextOptions,
): UniversalEventBuilderArgs {
  const { eventContext, locale, page: explicitPage, request } = options
  const requestHeaders = getRequestHeaders(options)
  const userAgent = requestHeaders?.get('user-agent') ?? undefined
  const referrer = getRequestReferrer(requestHeaders, eventContext)
  const requestPage = getRequestPage(request, referrer)
  const forwardedPage = getForwardedRequestPage(requestHeaders, referrer)
  const page = mergePageContext(
    mergePageContext(requestPage ?? forwardedPage, eventContext?.page),
    getExplicitPage(explicitPage),
  )

  return {
    ...eventContext,
    locale: locale ?? eventContext?.locale,
    page,
    userAgent: eventContext?.userAgent ?? userAgent,
  }
}

function getRequestHeaders({
  headers,
  request,
}: CreateNextjsRequestContextOptions): Headers | undefined {
  if (!headers) return request?.headers
  if (!request) return headers

  const mergedHeaders = new Headers(request.headers)
  headers.forEach((value, name) => {
    mergedHeaders.set(name, value)
  })

  return mergedHeaders
}

function getRequestReferrer(
  headers: Headers | undefined,
  eventContext: UniversalEventBuilderArgs | undefined,
): string | undefined {
  return headers?.get('referer') ?? eventContext?.page?.referrer
}

function getRequestPage(
  request: NextjsRequestLike | undefined,
  referrer: string | undefined,
): NonNullable<UniversalEventBuilderArgs['page']> | undefined {
  return request ? createPageContextFromUrl(request.url, { referrer }) : undefined
}

export function bindNextjsOptimizationRequest(
  sdk: ContentfulOptimization,
  options: BindNextjsOptimizationRequestOptions,
): CoreStatelessRequest {
  const anonymousId =
    readNextjsAnonymousId(options.cookies, options.anonymousIdCookieName) ??
    readNextjsAnonymousId(options.request?.cookies, options.anonymousIdCookieName)
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

/**
 * Creates a Core-compatible page context object from App Router route state.
 *
 * @remarks
 * Query values are normalized to the SDK dictionary shape (`Record<string, string>`). Array and
 * duplicate values keep the last value for `page.query` while preserving all values in
 * `page.search`.
 *
 * @public
 */
export function createNextjsPageContext({
  origin,
  path,
  referrer,
  searchParams,
  url,
}: CreateNextjsPageContextOptions): NonNullable<UniversalEventBuilderArgs['page']> {
  const params = toUrlSearchParams(searchParams)
  const serializedSearchParams = params.toString()
  const search = serializedSearchParams ? `?${serializedSearchParams}` : ''

  return {
    path,
    query: toQueryDictionary(params),
    referrer: referrer ?? '',
    search,
    url: url ?? toPageUrl(origin, path, search),
  }
}

function getExplicitPage(
  page: NextjsPageContextInput | undefined,
): NonNullable<UniversalEventBuilderArgs['page']> | undefined {
  if (!page) return undefined

  if (!isCompletePageContext(page)) return createNextjsPageContext(page)

  return page
}

function isCompletePageContext(
  page: NextjsPageContextInput,
): page is NonNullable<UniversalEventBuilderArgs['page']> {
  return 'query' in page && 'search' in page && 'url' in page
}

function getForwardedRequestPage(
  headers: Headers | undefined,
  referrer: string | undefined,
): NonNullable<UniversalEventBuilderArgs['page']> | undefined {
  const requestUrl = headers?.get(NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER)
  if (!requestUrl) return undefined

  return createPageContextFromUrl(requestUrl, { referrer })
}

export async function getNextjsServerOptimizationData(
  sdk: ContentfulOptimization,
  options: NextjsServerOptimizationDataOptions,
): Promise<NextjsServerOptimizationData> {
  const requestOptimization = bindNextjsOptimizationRequest(sdk, options)
  const pageResult = await requestOptimization.page(options.pagePayload)

  return { data: pageResult.data, requestOptimization }
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

function getServerOptimizedEntryData<TElement extends keyof JSX.IntrinsicElements>(
  props: ServerOptimizedEntryProps<TElement>,
): {
  readonly baselineEntry: ServerTrackingBaselineEntry
  readonly resolvedData: ServerTrackingResolvedData
} {
  if (props.result !== undefined) {
    return { baselineEntry: props.result.baselineEntry, resolvedData: props.result }
  }

  return { baselineEntry: props.baselineEntry, resolvedData: props.resolvedData }
}

export function ServerOptimizedEntry<TElement extends keyof JSX.IntrinsicElements = 'div'>(
  props: ServerOptimizedEntryProps<TElement>,
): ReactElement {
  const {
    baselineEntry: _baselineEntry,
    resolvedData: _resolvedData,
    result: _result,
    ...rendererProps
  } = props
  const { baselineEntry, resolvedData } = getServerOptimizedEntryData(props)

  return renderOptimizedEntryOnServer({
    ...rendererProps,
    baselineEntry,
    resolvedData,
  })
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

function toUrlSearchParams(searchParams: NextjsSearchParams | undefined): URLSearchParams {
  if (searchParams instanceof URLSearchParams) return new URLSearchParams(searchParams)

  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === 'string') {
      params.append(key, value)
      continue
    }

    for (const item of value ?? []) {
      params.append(key, item)
    }
  }

  return params
}

function toQueryDictionary(searchParams: URLSearchParams): Record<string, string> {
  const query: Record<string, string> = {}

  searchParams.forEach((value, key) => {
    query[key] = value
  })

  return query
}

function toPageUrl(origin: string | undefined, path: string, search: string): string {
  if (origin) return new URL(`${path}${search}`, origin).toString()

  return `${path}${search}`
}
