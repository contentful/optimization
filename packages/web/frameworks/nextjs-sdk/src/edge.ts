import type { App } from '@contentful/optimization-react-web/api-schemas'
import {
  CoreStateless,
  createPageContextFromUrl,
  createRequestHandoffFromData,
  createRequestHandoffFromPreview,
  type CoreStatelessConfig,
  type CoreStatelessInsightsOptions,
  type CoreStatelessRequest,
  type CoreStatelessRequestConsent,
  type CoreStatelessRequestOptions,
  type EventEmissionResult,
  type EventType,
  type InitialExperienceCommandInput,
  type ManagedEntryHandoff,
  type OptimizationCacheMetadata,
  type OptimizationData,
  type PageViewBuilderArgs,
  type PartialProfile,
  type PrivateRequestOptimizationCacheMetadata,
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
  createCookieReaderFromHeader,
  DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE,
  isNextjsCookieReader,
} from './cookies'
import {
  addBrowserHandoffMetadata,
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationCacheMetadata,
  createPublicPermutationHandoff,
  type BrowserOptimizationHandoff,
  type OptimizationHydrationMode,
} from './handoff'
import {
  createPrivateRequestPreviewFallbackHandoff,
  resolveRequestPreview,
} from './request-preview-fallback'

const DEFAULT_EDGE_ALLOWED_EVENT_TYPES: EventType[] = ['identify', 'page']
const EDGE_SDK_NAME = '@contentful/optimization-nextjs'
const EMPTY_COOKIE_READER = {
  get: () => undefined,
}

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

export interface NextjsEdgeRequestHandoffOptions {
  readonly anonymousIdCookieName?: string
  readonly cache?: PrivateRequestOptimizationCacheMetadata
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly eventContext?: UniversalEventBuilderArgs
  readonly experienceOptions?: CoreStatelessRequestOptions
  readonly hydration: OptimizationHydrationMode
  readonly insightsOptions?: CoreStatelessInsightsOptions
  readonly initialExperienceEvents?:
    | readonly InitialExperienceCommandInput[]
    | ((
        context: NextjsEdgeRequestSnapshot,
      ) =>
        | readonly InitialExperienceCommandInput[]
        | Promise<readonly InitialExperienceCommandInput[]>)
  readonly locale?: string
  readonly pagePayload: PageViewBuilderArgs
  readonly profile?: PartialProfile
  readonly request: NextjsEdgeRequest
}

export interface NextjsEdgeRequestHandoff {
  readonly data: OptimizationData | undefined
  readonly handoff: BrowserOptimizationHandoff
  readonly pageResult: EventEmissionResult
  /** @deprecated Preview identity is not persisted by Edge request handoffs. */
  readonly persist: (response: Response) => void
  readonly requestOptimization: CoreStatelessRequest
}

export interface NextjsEdgeOptimization {
  readonly createEdgeRequestHandoff: (
    options: NextjsEdgeRequestHandoffOptions,
  ) => Promise<NextjsEdgeRequestHandoff>
  readonly createHandoffFromSelections: typeof createHandoffFromSelections
  readonly createOptimizationCacheKey: typeof createOptimizationCacheKey
  readonly createPublicPermutationHandoff: typeof createPublicPermutationHandoff
}

export function configureNextjsEdgeOptimization(
  config: NextjsEdgeOptimizationConfig,
): NextjsEdgeOptimization {
  const sdk = createEdgeOptimizationRuntime(config)

  async function createEdgeRequestHandoff(
    options: NextjsEdgeRequestHandoffOptions,
  ): Promise<NextjsEdgeRequestHandoff> {
    const cache: OptimizationCacheMetadata = options.cache ?? { scope: 'private-request' }
    assertEdgeRequestHandoffCacheMetadata(cache)

    const request = createEdgeRequestSnapshot(options.request)
    const result = await resolveRequestPreview(
      async () => {
        const consent = await resolveServerConsent(config.consent?.server, {
          cookies: request.cookies ?? EMPTY_COOKIE_READER,
          headers: request.headers,
        })
        const profile = resolveEdgeProfile(options, request.cookies)
        const requestOptimization = sdk.forRequest({
          consent,
          eventContext: createEdgeRequestContext(request, options, options.locale ?? config.locale),
          experienceOptions: options.experienceOptions,
          insightsOptions: options.insightsOptions,
          locale: options.locale ?? config.locale,
          profile,
        })
        const initialExperienceEvents = await resolveInitialExperienceEvents(
          options.initialExperienceEvents,
          request,
        )
        const preview = await requestOptimization.previewInitialExperience({
          ...(initialExperienceEvents === undefined ? {} : { events: initialExperienceEvents }),
          page: options.pagePayload,
        })
        const data = preview.accepted ? preview.data : undefined
        const pageResult: EventEmissionResult = preview.accepted
          ? { accepted: true, data: preview.data }
          : { accepted: false }
        const handoff = createEdgeRequestHandoffFromPreview({ cache, options, preview, request })

        return {
          data,
          handoff,
          pageResult,
          persist: (_response: Response) => undefined,
          requestOptimization,
        }
      },
      () => ({
        data: undefined,
        handoff: createPrivateRequestPreviewFallbackHandoff({
          entries: options.entries,
          hydration: options.hydration,
        }),
        pageResult: { accepted: false },
        persist: (_response: Response) => undefined,
        requestOptimization: sdk.forRequest({
          consent: false,
          eventContext: options.eventContext,
          experienceOptions: options.experienceOptions,
          insightsOptions: options.insightsOptions,
          locale: options.locale ?? config.locale,
        }),
      }),
    )

    return result.value
  }

  return {
    createEdgeRequestHandoff,
    createHandoffFromSelections,
    createOptimizationCacheKey,
    createPublicPermutationHandoff,
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

function resolveEdgeProfile(
  options: NextjsEdgeRequestHandoffOptions,
  cookies: NextjsCookieReader | undefined,
): PartialProfile | undefined {
  const anonymousId = readNextjsAnonymousId(cookies, options.anonymousIdCookieName)
  return options.profile ?? (anonymousId === undefined ? undefined : { id: anonymousId })
}

async function resolveInitialExperienceEvents(
  input: NextjsEdgeRequestHandoffOptions['initialExperienceEvents'],
  request: NextjsEdgeRequestSnapshot,
): Promise<readonly InitialExperienceCommandInput[] | undefined> {
  if (typeof input === 'function') return await input(request)
  return input
}

function createEdgeRequestHandoffFromPreview({
  cache,
  options,
  preview,
  request,
}: {
  readonly cache: PrivateRequestOptimizationCacheMetadata
  readonly options: NextjsEdgeRequestHandoffOptions
  readonly preview: Awaited<ReturnType<CoreStatelessRequest['previewInitialExperience']>>
  readonly request: NextjsEdgeRequestSnapshot
}): BrowserOptimizationHandoff {
  const handoff = preview.accepted
    ? createRequestHandoffFromPreview({
        cache,
        entries: options.entries,
        preview,
        routeKey: createEdgeRequestRouteKey(request.url),
      })
    : createRequestHandoffFromData({ cache, entries: options.entries })

  return addBrowserHandoffMetadata(handoff, { hydration: options.hydration })
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

function createEdgeRequestRouteKey(requestUrl: string): string {
  const url = new URL(requestUrl)
  return `${url.pathname}${url.search}`
}

function assertEdgeRequestHandoffCacheMetadata(
  cache: OptimizationCacheMetadata,
): asserts cache is PrivateRequestOptimizationCacheMetadata {
  if (cache.scope === 'private-request') return

  throw new TypeError(
    'Request handoffs must use private-request cache scope. Use public permutation handoffs for public cache scopes, or a non-request handoff for static output.',
  )
}

function resolveServerConsent(
  consent: NextjsOptimizationServerConsent | NextjsOptimizationServerConsentResolver | undefined,
  context: Parameters<NextjsOptimizationServerConsentResolver>[0],
): CoreStatelessRequestConsent | Promise<CoreStatelessRequestConsent> {
  if (consent === undefined) return false

  return typeof consent === 'function' ? consent(context) : consent
}

export {
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationCacheMetadata,
  createPublicPermutationHandoff,
}
