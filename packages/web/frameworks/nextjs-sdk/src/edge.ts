import type { App } from '@contentful/optimization-react-web/api-schemas'
import {
  CoreStateless,
  createPageContextFromUrl,
  getOptimizationCacheSafetyWarnings,
  type CoreStatelessConfig,
  type CoreStatelessInsightsOptions,
  type CoreStatelessRequest,
  type CoreStatelessRequestConsent,
  type CoreStatelessRequestOptions,
  type EventEmissionResult,
  type EventType,
  type ManagedEntryHandoff,
  type OptimizationCacheMetadata,
  type OptimizationData,
  type OptimizationHandoff,
  type PageViewBuilderArgs,
  type PartialProfile,
  type UniversalEventBuilderArgs,
} from '@contentful/optimization-react-web/core-sdk'
import type {
  NextjsCookieReader,
  NextjsOptimizationConsentConfig,
  NextjsOptimizationCookieConfig,
  NextjsOptimizationServerConsent,
  NextjsOptimizationServerConsentResolver,
} from './bound-component-types'
import { OPTIMIZATION_NEXTJS_SDK_VERSION } from './constants'
import {
  DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
  createCookieReaderFromHeader,
  createNextjsAnonymousIdSetCookieHeader,
  isNextjsCookieReader,
  type NextjsAnonymousIdCookieOptions,
  type PersistNextjsAnonymousIdOptions,
} from './cookies'
import {
  addBrowserHandoffMetadata,
  createHandoffFromSelections,
  createOptimizationCacheKey,
  type BrowserOptimizationHandoff,
  type OptimizationHydrationMode,
} from './handoff'

const DEFAULT_EDGE_ALLOWED_EVENT_TYPES: EventType[] = ['identify', 'page']
const EDGE_SDK_NAME = '@contentful/optimization-nextjs'
const EMPTY_COOKIE_READER = {
  get: () => undefined,
}
const SECONDS_IN_DAY = 86_400

export type NextjsEdgeRequest = Request | NextjsEdgeRequestSnapshot

export interface NextjsEdgeRequestSnapshot {
  readonly cookies?: NextjsCookieReader
  readonly headers: Headers
  readonly url: string
}

export type PublicEdgeEventBuilderConfig = Partial<
  Omit<NonNullable<CoreStatelessConfig['eventBuilder']>, 'app' | 'getConsent'>
>

export interface NextjsEdgeOptimizationConfig extends Omit<CoreStatelessConfig, 'eventBuilder'> {
  readonly app?: App
  readonly consent?: NextjsOptimizationConsentConfig
  readonly cookie?: NextjsOptimizationCookieConfig
  readonly eventBuilder?: PublicEdgeEventBuilderConfig
}

export interface NextjsEdgeRequestHandoffOptions extends PersistNextjsAnonymousIdOptions {
  readonly cache?: OptimizationCacheMetadata
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly eventContext?: UniversalEventBuilderArgs
  readonly experienceOptions?: CoreStatelessRequestOptions
  readonly hydration: OptimizationHydrationMode
  readonly insightsOptions?: CoreStatelessInsightsOptions
  readonly locale?: string
  readonly pagePayload: PageViewBuilderArgs
  readonly profile?: PartialProfile
  readonly request: NextjsEdgeRequest
}

export interface NextjsEdgeRequestHandoff {
  readonly data: OptimizationData | undefined
  readonly handoff: BrowserOptimizationHandoff
  readonly pageResult: EventEmissionResult
  readonly persist: (response: Response) => void
  readonly requestOptimization: CoreStatelessRequest
}

export interface NextjsEdgeOptimization {
  readonly createEdgeRequestHandoff: (
    options: NextjsEdgeRequestHandoffOptions,
  ) => Promise<NextjsEdgeRequestHandoff>
  readonly createHandoffFromSelections: typeof createHandoffFromSelections
  readonly createOptimizationCacheKey: typeof createOptimizationCacheKey
}

export function configureNextjsEdgeOptimization(
  config: NextjsEdgeOptimizationConfig,
): NextjsEdgeOptimization {
  const sdk = createEdgeOptimizationRuntime(config)

  async function createEdgeRequestHandoff(
    options: NextjsEdgeRequestHandoffOptions,
  ): Promise<NextjsEdgeRequestHandoff> {
    const request = createEdgeRequestSnapshot(options.request)
    const consent = await resolveServerConsent(config.consent?.server, {
      cookies: request.cookies ?? EMPTY_COOKIE_READER,
      headers: request.headers,
    })
    const anonymousId = readNextjsAnonymousId(request.cookies, options.anonymousIdCookieName)
    const profile = options.profile ?? (anonymousId === undefined ? undefined : { id: anonymousId })
    const requestOptimization = sdk.forRequest({
      consent,
      eventContext: createEdgeRequestContext(request, options, options.locale ?? config.locale),
      experienceOptions: options.experienceOptions,
      insightsOptions: options.insightsOptions,
      locale: options.locale ?? config.locale,
      profile,
    })
    const pageResult = await requestOptimization.page(options.pagePayload)
    const { data } = pageResult
    const handoff = addBrowserHandoffMetadata(
      createEdgeRequestOptimizationHandoff({
        cache: options.cache,
        data,
        entries: options.entries,
      }),
      {
        hydration: options.hydration,
        initialPageEvent: pageResult.accepted ? 'skip' : 'emit',
      },
    )

    return {
      data,
      handoff,
      pageResult,
      persist: (response) => {
        persistEdgeAnonymousId(response, requestOptimization, data, {
          anonymousIdCookieName: options.anonymousIdCookieName,
          cookieOptions: options.cookieOptions ?? toConfigCookieOptions(config.cookie),
          deleteWhenProfileCannotPersist: options.deleteWhenProfileCannotPersist,
        })
      },
      requestOptimization,
    }
  }

  return {
    createEdgeRequestHandoff,
    createHandoffFromSelections,
    createOptimizationCacheKey,
  }
}

function createEdgeOptimizationRuntime(config: NextjsEdgeOptimizationConfig): CoreStateless {
  const {
    app,
    allowedEventTypes,
    consent: _consent,
    cookie: _cookie,
    eventBuilder,
    ...coreConfig
  } = config
  const { library, ...eventBuilderConfig } = eventBuilder ?? {}

  return new CoreStateless({
    ...coreConfig,
    allowedEventTypes: allowedEventTypes ?? DEFAULT_EDGE_ALLOWED_EVENT_TYPES,
    eventBuilder: {
      app,
      channel: 'server',
      ...eventBuilderConfig,
      library: {
        name: EDGE_SDK_NAME,
        version: OPTIMIZATION_NEXTJS_SDK_VERSION,
        ...library,
      },
      getConsent: () => false,
    },
  })
}

function createEdgeRequestSnapshot(request: NextjsEdgeRequest): NextjsEdgeRequestSnapshot {
  return {
    cookies: getEdgeRequestCookies(request),
    headers: request.headers,
    url: request.url,
  }
}

function getEdgeRequestCookies(request: NextjsEdgeRequest): NextjsCookieReader | undefined {
  const nextCookies = 'cookies' in request ? request.cookies : undefined
  if (isNextjsCookieReader(nextCookies)) return nextCookies

  return createCookieReaderFromHeader(request.headers.get('cookie'))
}

function readNextjsAnonymousId(
  cookies: NextjsCookieReader | undefined,
  cookieName = DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
): string | undefined {
  const value = cookies?.get(cookieName)?.value
  return value && value.length > 0 ? value : undefined
}

function createEdgeRequestContext(
  request: NextjsEdgeRequestSnapshot,
  options: NextjsEdgeRequestHandoffOptions,
  locale: string | undefined,
): UniversalEventBuilderArgs {
  const referrer = request.headers.get('referer') ?? options.eventContext?.page?.referrer
  const requestPage = createPageContextFromUrl(request.url, { referrer })

  return {
    ...options.eventContext,
    locale: locale ?? options.eventContext?.locale,
    page: mergeEdgeRequestPage(requestPage, options.eventContext?.page),
    userAgent: options.eventContext?.userAgent ?? request.headers.get('user-agent') ?? undefined,
  }
}

function mergeEdgeRequestPage(
  requestPage: NonNullable<UniversalEventBuilderArgs['page']>,
  eventPage: UniversalEventBuilderArgs['page'],
): UniversalEventBuilderArgs['page'] {
  return eventPage === undefined ? requestPage : { ...requestPage, ...eventPage }
}

function createEdgeRequestOptimizationHandoff(input: {
  readonly cache?: OptimizationCacheMetadata
  readonly data?: OptimizationData
  readonly entries?: readonly ManagedEntryHandoff[]
}): OptimizationHandoff {
  const handoff: OptimizationHandoff = {
    cache: input.cache ?? { scope: 'private-request' },
    ...(input.entries === undefined ? {} : { entries: input.entries }),
    ...(input.data === undefined
      ? {}
      : {
          state: {
            changes: input.data.changes,
            profile: input.data.profile,
            selectedOptimizations: input.data.selectedOptimizations,
          },
        }),
  }

  assertEdgeRequestHandoffCacheSafety(handoff)

  return handoff
}

function assertEdgeRequestHandoffCacheSafety(handoff: OptimizationHandoff): void {
  const profileWarning = getOptimizationCacheSafetyWarnings(handoff).find(
    (warning) => warning.code === 'profile-state-in-public-cache',
  )

  if (profileWarning === undefined) return

  throw new TypeError(
    `${profileWarning.message} Request handoffs with profile state must use private-request cache scope.`,
  )
}

function resolveServerConsent(
  consent: NextjsOptimizationServerConsent | NextjsOptimizationServerConsentResolver | undefined,
  context: Parameters<NextjsOptimizationServerConsentResolver>[0],
): CoreStatelessRequestConsent | Promise<CoreStatelessRequestConsent> {
  if (consent === undefined) return false

  return typeof consent === 'function' ? consent(context) : consent
}

function persistEdgeAnonymousId(
  response: Response,
  requestOptimization: CoreStatelessRequest,
  data: OptimizationData | undefined,
  options: PersistNextjsAnonymousIdOptions,
): void {
  const setCookie = createNextjsAnonymousIdSetCookieHeader(requestOptimization, data, options)
  if (setCookie === undefined) return

  response.headers.append('set-cookie', setCookie)
}

function toConfigCookieOptions(
  cookie: NextjsOptimizationCookieConfig | undefined,
): NextjsAnonymousIdCookieOptions | undefined {
  if (cookie === undefined) return undefined

  return {
    ...(cookie.domain ? { domain: cookie.domain } : {}),
    ...(typeof cookie.expires === 'number' && Number.isFinite(cookie.expires)
      ? { maxAge: Math.trunc(cookie.expires * SECONDS_IN_DAY) }
      : {}),
  }
}

export { createHandoffFromSelections, createOptimizationCacheKey }
