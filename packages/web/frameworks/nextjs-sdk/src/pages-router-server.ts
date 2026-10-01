import { resolveEntriesForSelections } from '@contentful/optimization-react-web/core-sdk'
import type { GetServerSidePropsContext } from 'next'
import type { IncomingHttpHeaders } from 'node:http'
import { assertRequestHandoffCacheMetadata, toHandoffDefaults } from './app-router-request-handoff'
import type {
  NextjsOptimizationComponentsConfig,
  NextjsOptimizationServerConsent,
  NextjsOptimizationServerConsentResolver,
} from './bound-component-types'
import { createCookieReaderFromHeader, createCookieReaderFromRecord } from './cookies'
import type { BrowserOptimizationHandoff } from './handoff'
import {
  createPrivateRequestPreviewFallbackHandoff,
  resolveRequestPreview,
} from './request-preview-fallback'
import {
  configureNextjsServerOptimization,
  createNextjsRequestHandoff,
  prefetchManagedEntries as prefetchServerManagedEntries,
  type ContentfulOptimization,
  type CoreStatelessRequestConsent,
  type ManagedEntryDescriptor,
  type NextjsCookieReader,
  type NextjsRequestHandoffOptions,
  type NextjsRequestHandoffResult,
  type NextjsRequestLike,
  type OptimizationNodeConfig,
} from './server'

const EMPTY_COOKIE_READER = {
  get: () => undefined,
}
type PagesRouterRequestDefaultsHandoff = BrowserOptimizationHandoff & {
  readonly defaults: ReturnType<typeof toHandoffDefaults>
}

export type {
  NextjsOptimizationComponentsConfig,
  NextjsOptimizationConsentConfig,
  NextjsOptimizationCookieConfig,
} from './bound-component-types'
export { createPublicPermutationCacheMetadata, createPublicPermutationHandoff } from './handoff'
export {
  prefetchManagedEntries,
  type ManagedEntryDescriptor,
  type ManagedEntryHandoff,
} from './server'
export { resolveEntriesForSelections }

export type NextjsPagesRouterRequestHandoffOptions = Omit<
  NextjsRequestHandoffOptions,
  'consent' | 'cookies' | 'headers' | 'locale' | 'request'
> & {
  readonly locale?: string
  readonly prefetchManagedEntries?: readonly ManagedEntryDescriptor[]
}

export interface NextjsPagesRouterOptimization {
  readonly createRequestHandoff: (
    context: GetServerSidePropsContext,
    options: NextjsPagesRouterRequestHandoffOptions,
  ) => Promise<BrowserOptimizationHandoff>
}

export function bindNextjsPagesRouterServerOptimization(
  config: NextjsOptimizationComponentsConfig,
): NextjsPagesRouterOptimization {
  const sdk = configureNextjsServerOptimization(toServerOptimizationConfig(config))

  return {
    createRequestHandoff: async (context, options) => {
      const cache = options.cache ?? { scope: 'private-request' }
      assertRequestHandoffCacheMetadata(cache)
      const result = await resolveRequestPreview(
        async () => {
          const consent = await resolveServerConsent(config.consent?.server, context)
          const { handoff } = await createNextjsPagesRouterRequestHandoff(sdk, context, {
            ...options,
            consent,
            locale: options.locale ?? config.locale ?? context.locale,
          })
          return handoff
        },
        () =>
          addRequestDefaultsToHandoff(
            createPrivateRequestPreviewFallbackHandoff({
              entries: options.entries,
              hydration: options.hydration,
            }),
            false,
          ),
      )

      return result.value
    },
  }
}

export async function createNextjsPagesRouterRequestHandoff(
  sdk: ContentfulOptimization,
  context: GetServerSidePropsContext,
  options: NextjsPagesRouterRequestHandoffOptions & {
    readonly consent: CoreStatelessRequestConsent
  },
): Promise<NextjsRequestHandoffResult> {
  const { locale, prefetchManagedEntries, ...requestOptions } = options
  const request = createPagesRouterRequest(context)
  const result = await createNextjsRequestHandoff(sdk, {
    ...requestOptions,
    locale: locale ?? context.locale,
    request,
  })
  const requestHandoff = addRequestDefaultsToHandoff(result.handoff, requestOptions.consent)
  if (prefetchManagedEntries === undefined) {
    return {
      ...result,
      handoff: requestHandoff,
    }
  }

  const entries = await prefetchServerManagedEntries(
    result.requestOptimization,
    prefetchManagedEntries,
  )

  const handoff: PagesRouterRequestDefaultsHandoff = {
    ...requestHandoff,
    entries: [...(result.handoff.entries ?? []), ...entries],
  }

  return {
    ...result,
    handoff,
  }
}

function addRequestDefaultsToHandoff(
  handoff: BrowserOptimizationHandoff,
  consent: CoreStatelessRequestConsent,
): PagesRouterRequestDefaultsHandoff {
  return {
    ...handoff,
    defaults: toHandoffDefaults(consent),
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

function resolveServerConsent(
  consent: NextjsOptimizationServerConsent | NextjsOptimizationServerConsentResolver | undefined,
  context: GetServerSidePropsContext,
): CoreStatelessRequestConsent | Promise<CoreStatelessRequestConsent> {
  if (consent === undefined) return false

  return typeof consent === 'function'
    ? consent({
        cookies: createPagesRouterCookieReader(context) ?? EMPTY_COOKIE_READER,
        headers: createHeadersFromNodeHeaders(context.req.headers),
      })
    : consent
}

function toServerOptimizationConfig(
  config: NextjsOptimizationComponentsConfig,
): OptimizationNodeConfig {
  const {
    consent: _consent,
    cookie: _cookie,
    liveUpdates: _liveUpdates,
    onStatesReady: _onStatesReady,
    trackEntryInteraction: _trackEntryInteraction,
    ...serverConfig
  } = config

  return serverConfig as OptimizationNodeConfig
}
