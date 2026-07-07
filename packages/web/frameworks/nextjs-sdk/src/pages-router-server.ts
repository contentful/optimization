import type { GetServerSidePropsContext } from 'next'
import type { IncomingHttpHeaders } from 'node:http'
import type {
  NextjsOptimizationCookieConfig,
  NextjsPagesRouterClientDefaults,
} from './bound-component-types'
import {
  createCookieReaderFromHeader,
  createCookieReaderFromRecord,
  createNextjsAnonymousIdSetCookieHeader,
} from './cookies'
import {
  createNextjsOptimization,
  getNextjsServerOptimizationData,
  prefetchOptimizedEntries as prefetchServerOptimizedEntries,
  type ContentfulOptimization,
  type CoreStatelessRequest,
  type CoreStatelessRequestConsent,
  type NextjsCookieReader,
  type NextjsRequestLike,
  type NextjsServerOptimizationDataOptions,
  type OptimizationData,
  type OptimizationNodeConfig,
  type OptimizedEntryPrefetchDescriptor,
  type PersistNextjsAnonymousIdOptions,
  type ServerOptimizedEntryHandoff,
} from './server'

const SECONDS_IN_DAY = 86_400

export type NextjsPagesRouterInitialPageEvent = 'emit' | 'skip'
export type {
  NextjsOptimizationCookieConfig,
  NextjsPagesRouterClientDefaults,
} from './bound-component-types'
export {
  prefetchOptimizedEntries,
  type OptimizedEntryPrefetchDescriptor,
  type ServerOptimizedEntryHandoff,
} from './server'

export interface NextjsPagesRouterOptimizationPageProps {
  readonly clientDefaults?: NextjsPagesRouterClientDefaults
  readonly initialPageEvent: NextjsPagesRouterInitialPageEvent
  readonly serverOptimizationState?: OptimizationData
  readonly serverOptimizedEntries?: readonly ServerOptimizedEntryHandoff[]
}

export interface NextjsPagesRouterOptimizationProps {
  readonly contentfulOptimization: NextjsPagesRouterOptimizationPageProps
}

export interface NextjsPagesRouterOptimizationPropsOptions
  extends
    Omit<NextjsServerOptimizationDataOptions, 'cookies' | 'headers' | 'locale' | 'request'>,
    PersistNextjsAnonymousIdOptions {
  readonly initialPageEvent?: NextjsPagesRouterInitialPageEvent
  readonly locale?: string
  readonly prefetchOptimizedEntries?: readonly OptimizedEntryPrefetchDescriptor[]
}

export type NextjsPagesRouterServerConsentResolver = (
  context: GetServerSidePropsContext,
) => CoreStatelessRequestConsent | Promise<CoreStatelessRequestConsent>

export interface NextjsPagesRouterOptimizationConfig extends OptimizationNodeConfig {
  readonly cookie?: NextjsOptimizationCookieConfig
  readonly defaults?: unknown
  readonly liveUpdates?: unknown
  readonly onStatesReady?: unknown
  readonly server: {
    readonly consent: CoreStatelessRequestConsent | NextjsPagesRouterServerConsentResolver
  }
  readonly trackEntryInteraction?: unknown
}

export type GetNextjsPagesRouterOptimizationPropsOptions = Omit<
  NextjsPagesRouterOptimizationPropsOptions,
  'consent' | 'cookieOptions' | 'locale'
>

export interface NextjsPagesRouterOptimizationPropsResult {
  readonly props: NextjsPagesRouterOptimizationProps
  readonly data: OptimizationData | undefined
  readonly requestOptimization: CoreStatelessRequest
}

export interface NextjsPagesRouterOptimization {
  readonly getServerSideOptimizationProps: (
    context: GetServerSidePropsContext,
    options?: GetNextjsPagesRouterOptimizationPropsOptions,
  ) => Promise<NextjsPagesRouterOptimizationPropsResult>
}

export function createNextjsPagesRouterOptimization(
  config: NextjsPagesRouterOptimizationConfig,
): NextjsPagesRouterOptimization {
  const sdk = createNextjsOptimization(toServerOptimizationConfig(config))

  return {
    getServerSideOptimizationProps: async (context, options = {}) =>
      await getNextjsPagesRouterOptimizationProps(sdk, context, {
        ...options,
        consent: await resolveServerConsent(config.server.consent, context),
        cookieOptions: toAnonymousIdCookieOptions(config.cookie),
        locale: config.locale ?? context.locale,
      }),
  }
}

export async function getNextjsPagesRouterOptimizationProps(
  sdk: ContentfulOptimization,
  context: GetServerSidePropsContext,
  options: NextjsPagesRouterOptimizationPropsOptions,
): Promise<NextjsPagesRouterOptimizationPropsResult> {
  const {
    cookieOptions,
    deleteWhenProfileCannotPersist,
    initialPageEvent,
    locale,
    prefetchOptimizedEntries,
    ...requestOptions
  } = options
  const request = createPagesRouterRequest(context)
  const { data, requestOptimization } = await getNextjsServerOptimizationData(sdk, {
    ...requestOptions,
    locale: locale ?? context.locale,
    request,
  })
  const setCookie = createNextjsAnonymousIdSetCookieHeader(requestOptimization, data, {
    anonymousIdCookieName: requestOptions.anonymousIdCookieName,
    cookieOptions,
    deleteWhenProfileCannotPersist,
  })
  if (setCookie !== undefined) appendSetCookie(context, setCookie)
  const serverOptimizedEntries =
    prefetchOptimizedEntries === undefined
      ? undefined
      : await prefetchServerOptimizedEntries(requestOptimization, prefetchOptimizedEntries)

  return {
    data,
    requestOptimization,
    props: {
      contentfulOptimization: toContentfulOptimizationProps(
        data,
        initialPageEvent ?? resolveInitialPageEvent(data, requestOptions.consent),
        resolveClientDefaults(requestOptions.consent),
        serverOptimizedEntries,
      ),
    },
  }
}

function createPagesRouterRequest(context: GetServerSidePropsContext): NextjsRequestLike {
  const headers = createHeadersFromNodeHeaders(context.req.headers)

  return {
    cookies: createPagesRouterCookieReader(context),
    headers,
    url: createPagesRouterRequestUrl(context, headers),
  }
}

function createPagesRouterCookieReader(
  context: GetServerSidePropsContext,
): NextjsCookieReader | undefined {
  const requestCookies = createCookieReaderFromRecord(context.req.cookies)
  const headerCookies = createCookieReaderFromHeader(getCookieHeader(context.req.headers.cookie))

  if (requestCookies === undefined) return headerCookies
  if (headerCookies === undefined) return requestCookies

  return {
    get: (name) => requestCookies.get(name) ?? headerCookies.get(name),
  }
}

function createHeadersFromNodeHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers()

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue

    for (const headerValue of Array.isArray(value) ? value : [value]) {
      result.append(name, headerValue)
    }
  }

  return result
}

function createPagesRouterRequestUrl(context: GetServerSidePropsContext, headers: Headers): string {
  const {
    req: { url: requestUrl },
    resolvedUrl: contextResolvedUrl,
  } = context
  const origin = getForwardedOrigin(headers)

  if (contextResolvedUrl) {
    const resolvedUrl = toAbsoluteUrl(contextResolvedUrl, origin)
    if (resolvedUrl !== undefined) return resolvedUrl
  }

  if (requestUrl) return toAbsoluteUrl(requestUrl, origin) ?? requestUrl

  return contextResolvedUrl || '/'
}

function getForwardedOrigin(headers: Headers): string | undefined {
  const host =
    firstHeaderValue(headers.get('x-forwarded-host')) ?? firstHeaderValue(headers.get('host'))
  if (host === undefined) return undefined

  const proto = firstHeaderValue(headers.get('x-forwarded-proto')) ?? 'http'
  return `${proto}://${host}`
}

function firstHeaderValue(value: string | null): string | undefined {
  const first = value?.split(',')[0]?.trim()
  return first && first.length > 0 ? first : undefined
}

function toAbsoluteUrl(url: string, origin: string | undefined): string | undefined {
  if (/^[a-z][a-z\d+\-.]*:/i.test(url)) return url
  if (origin === undefined) return undefined

  return new URL(url, origin).toString()
}

function getCookieHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join('; ') : value
}

function appendSetCookie(context: GetServerSidePropsContext, setCookie: string): void {
  const existingSetCookie = context.res.getHeader('Set-Cookie')

  if (existingSetCookie === undefined) {
    context.res.setHeader('Set-Cookie', setCookie)
    return
  }

  context.res.setHeader('Set-Cookie', [
    ...(Array.isArray(existingSetCookie) ? existingSetCookie : [existingSetCookie]).map(String),
    setCookie,
  ])
}

function toContentfulOptimizationProps(
  data: OptimizationData | undefined,
  initialPageEvent: NextjsPagesRouterInitialPageEvent,
  clientDefaults: NextjsPagesRouterClientDefaults | undefined,
  serverOptimizedEntries: readonly ServerOptimizedEntryHandoff[] | undefined,
): NextjsPagesRouterOptimizationPageProps {
  const props: NextjsPagesRouterOptimizationPageProps = {
    ...(clientDefaults === undefined ? {} : { clientDefaults }),
    initialPageEvent,
    ...(serverOptimizedEntries === undefined ? {} : { serverOptimizedEntries }),
  }

  if (data === undefined) return props

  return {
    ...props,
    serverOptimizationState: data,
  }
}

function resolveInitialPageEvent(
  data: OptimizationData | undefined,
  consent: CoreStatelessRequestConsent,
): NextjsPagesRouterInitialPageEvent {
  return data !== undefined && hasEventConsent(consent) ? 'skip' : 'emit'
}

function hasEventConsent(consent: CoreStatelessRequestConsent): boolean {
  return typeof consent === 'boolean' ? consent : consent.events === true
}

function resolveClientDefaults(
  consent: CoreStatelessRequestConsent,
): NextjsPagesRouterClientDefaults | undefined {
  if (typeof consent === 'boolean') {
    return { consent, persistenceConsent: consent }
  }

  const defaults: NextjsPagesRouterClientDefaults = {
    ...(consent.events === undefined ? {} : { consent: consent.events }),
    ...(consent.persistence === undefined ? {} : { persistenceConsent: consent.persistence }),
  }

  return Object.keys(defaults).length === 0 ? undefined : defaults
}

function toServerOptimizationConfig(
  config: NextjsPagesRouterOptimizationConfig,
): OptimizationNodeConfig {
  const {
    cookie: _cookie,
    defaults: _defaults,
    liveUpdates: _liveUpdates,
    onStatesReady: _onStatesReady,
    server: _server,
    trackEntryInteraction: _trackEntryInteraction,
    ...serverConfig
  } = config

  return serverConfig
}

function toAnonymousIdCookieOptions(
  cookie: NextjsPagesRouterOptimizationConfig['cookie'],
): PersistNextjsAnonymousIdOptions['cookieOptions'] {
  if (cookie === undefined) return undefined

  const cookieOptions: NonNullable<PersistNextjsAnonymousIdOptions['cookieOptions']> = {
    ...(cookie.domain ? { domain: cookie.domain } : {}),
    ...(typeof cookie.expires === 'number' && Number.isFinite(cookie.expires)
      ? { maxAge: Math.trunc(cookie.expires * SECONDS_IN_DAY) }
      : {}),
  }

  return Object.keys(cookieOptions).length === 0 ? undefined : cookieOptions
}

function resolveServerConsent(
  consent: CoreStatelessRequestConsent | NextjsPagesRouterServerConsentResolver,
  context: GetServerSidePropsContext,
): CoreStatelessRequestConsent | Promise<CoreStatelessRequestConsent> {
  return typeof consent === 'function' ? consent(context) : consent
}
