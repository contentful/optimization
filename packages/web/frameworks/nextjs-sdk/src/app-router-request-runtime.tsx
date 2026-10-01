import type {
  InitialExperienceCommandInput,
  OptimizationCacheMetadata,
  PrivateRequestOptimizationCacheMetadata,
} from '@contentful/optimization-react-web/core-sdk'
import { NextAppAutoPageTracker } from '@contentful/optimization-react-web/router/next-app'
import { cookies, headers } from 'next/headers'
import { cache, createElement, type ReactElement } from 'react'
import { assertRequestHandoffCacheMetadata, toHandoffDefaults } from './app-router-request-handoff'
import type {
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  NextjsAppRouterRequestOptimization,
  NextjsAppRouterRequestOptimizationProviderProps,
  NextjsAppRouterRequestOptimizationRootProps,
  NextjsAppRouterServerOptimizationConfig,
  NextjsBoundOptimizedEntryComponent,
  NextjsBoundOptimizedEntryProps,
  NextjsOptimizationServerConsent,
  NextjsOptimizationServerConsentResolver,
} from './bound-component-types'
import type {
  BrowserOptimizationHandoff,
  ContentOptimizationHandoff,
  ContentOptimizationHydrationMode,
} from './handoff'
import { NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER } from './request-context'
import {
  createPrivateRequestPreviewFallbackHandoff,
  reportRequestPreviewFallback,
  resolveRequestPreview,
} from './request-preview-fallback'
import {
  createNextjsRequestHandoff,
  type ContentfulOptimization,
  type CoreStatelessRequestConsent,
  type NextjsRequestHandoffOptions,
  type NextjsRequestLike,
} from './server'

const EMPTY_COOKIE_READER = { get: () => undefined }

export type AppRouterCreateRequestHandoffOptions = Omit<
  NextjsRequestHandoffOptions,
  'cache' | 'consent' | 'cookies' | 'headers' | 'hydration' | 'locale' | 'request'
> & {
  readonly cache?: PrivateRequestOptimizationCacheMetadata
  readonly hydration: ContentOptimizationHydrationMode
  readonly locale?: string
  readonly request: NextjsRequestLike
  /** @deprecated This compatibility field is no longer read. */
  readonly trustedRequestHandoff?: true
}

interface BindNextjsAppRouterRequestRuntimeOptions {
  readonly config: NextjsAppRouterServerOptimizationConfig
  readonly OptimizationProvider: (
    props: BoundNextjsOptimizationProviderProps,
  ) => Promise<ReactElement | null>
  readonly OptimizationRoot: (props: BoundNextjsOptimizationRootProps) => Promise<ReactElement>
  readonly OptimizedEntry: (
    props: NextjsBoundOptimizedEntryProps,
    requestBarrier?: Promise<unknown>,
  ) => Promise<ReactElement>
  readonly rememberRequestHandoff: (
    handoff: BrowserOptimizationHandoff | undefined,
    defaults?: ReturnType<typeof toHandoffDefaults>,
  ) => void
  readonly resolveHandoffEntries: (
    handoff:
      | BoundNextjsOptimizationProviderProps['handoff']
      | Promise<BoundNextjsOptimizationProviderProps['handoff']>,
    prefetchManagedEntries: BoundNextjsOptimizationProviderProps['prefetchManagedEntries'],
  ) => Promise<BoundNextjsOptimizationProviderProps['handoff']>
  readonly sdk: ContentfulOptimization
}

export function bindNextjsAppRouterRequestRuntime({
  config,
  OptimizationProvider,
  OptimizationRoot,
  OptimizedEntry,
  rememberRequestHandoff,
  resolveHandoffEntries,
  sdk,
}: BindNextjsAppRouterRequestRuntimeOptions): {
  readonly createRequestHandoff: (
    options: AppRouterCreateRequestHandoffOptions,
  ) => Promise<ContentOptimizationHandoff>
  readonly request: NextjsAppRouterRequestOptimization
} {
  async function createRequestHandoff(
    options: AppRouterCreateRequestHandoffOptions,
  ): Promise<ContentOptimizationHandoff> {
    const cacheMetadata: OptimizationCacheMetadata = options.cache ?? {
      scope: 'private-request',
    }
    assertRequestHandoffCacheMetadata(cacheMetadata)

    const result = await resolveRequestPreview(
      async () => {
        const consent = await resolveServerConsent(config.consent?.server, {
          cookies: options.request.cookies ?? EMPTY_COOKIE_READER,
          headers: options.request.headers,
        })
        const { handoff } = await createNextjsRequestHandoff(sdk, {
          ...options,
          cache: cacheMetadata,
          consent,
          locale: options.locale ?? config.locale,
          request: options.request,
        })
        return { defaults: toHandoffDefaults(consent), handoff }
      },
      () => ({
        defaults: toHandoffDefaults(false),
        handoff: createPrivateRequestPreviewFallbackHandoff({
          entries: options.entries,
          hydration: options.hydration,
        }),
      }),
    )
    const { value } = result
    const { defaults, handoff } = value
    rememberRequestHandoff(handoff, defaults)

    return handoff
  }

  const getRequestRenderInputs = cache(async () => {
    const cookieStore = await cookies()
    const requestHeaders = new Headers(await headers())
    const requestUrl = requestHeaders.get(NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER)

    if (requestUrl === null) {
      const hydration = getFallbackHydration(config)
      reportRequestPreviewFallback(
        new Error(
          'Missing x-ctfl-opt-request-url. Configure the Contentful Optimization request handler in your Next.js proxy before using request components.',
        ),
      )
      const handoff = createPrivateRequestPreviewFallbackHandoff({ hydration })
      rememberRequestHandoff(handoff, toHandoffDefaults(false))
      return {
        handoff,
        hydration,
        pagePayload: undefined,
        routeKey: undefined,
      }
    }

    let url: URL | undefined = undefined
    try {
      url = new URL(requestUrl)
    } catch (error) {
      const hydration = getFallbackHydration(config)
      reportRequestPreviewFallback(error)
      const handoff = createPrivateRequestPreviewFallbackHandoff({ hydration })
      rememberRequestHandoff(handoff, toHandoffDefaults(false))
      return {
        handoff,
        hydration,
        pagePayload: undefined,
        routeKey: undefined,
      }
    }

    const resolvedRouteKey = `${url.pathname}${url.search}`
    const resolvedPagePayload = {
      properties: { path: url.pathname, search: url.search, url: requestUrl },
    }
    const fallbackHydration = getFallbackHydration(config)
    let hydration = fallbackHydration
    const result = await resolveRequestPreview(
      async () => {
        hydration =
          typeof config.request?.hydration === 'function'
            ? config.request.hydration({ requestUrl, routeKey: resolvedRouteKey })
            : fallbackHydration
        const initialExperienceEvents = await resolveInitialExperienceEvents(
          config.request?.initialExperienceEvents,
          { requestUrl, routeKey: resolvedRouteKey },
        )
        const handoff = await createRequestHandoff({
          hydration,
          ...(initialExperienceEvents === undefined ? {} : { initialExperienceEvents }),
          pagePayload: resolvedPagePayload,
          request: { cookies: cookieStore, headers: requestHeaders, url: requestUrl },
        })
        return { handoff, hydration, pagePayload: resolvedPagePayload, routeKey: resolvedRouteKey }
      },
      () => ({
        handoff: createPrivateRequestPreviewFallbackHandoff({ hydration }),
        hydration,
        pagePayload: resolvedPagePayload,
        routeKey: resolvedRouteKey,
      }),
    )
    const { value } = result
    if (result.degraded) rememberRequestHandoff(value.handoff, toHandoffDefaults(false))

    return value
  })

  async function RequestOptimizationRoot(
    props: NextjsAppRouterRequestOptimizationRootProps,
  ): Promise<ReactElement> {
    const { prefetchManagedEntries, ...rootProps } = props
    const requestInputs = getRequestRenderInputs()
    const [{ hydration, pagePayload, routeKey }, handoff] = await Promise.all([
      requestInputs,
      resolveHandoffEntries(
        requestInputs.then((inputs) => inputs.handoff),
        prefetchManagedEntries,
      ),
    ])

    return await OptimizationRoot({
      ...rootProps,
      handoff,
      hydration,
      ...(pagePayload === undefined ? {} : { initialPagePayload: pagePayload }),
      ...(routeKey === undefined ? {} : { routeKey }),
    })
  }

  async function RequestOptimizationProvider(
    props: NextjsAppRouterRequestOptimizationProviderProps,
  ): Promise<ReactElement | null> {
    const { prefetchManagedEntries, ...providerProps } = props
    const requestInputs = getRequestRenderInputs()
    const [{ hydration }, handoff] = await Promise.all([
      requestInputs,
      resolveHandoffEntries(
        requestInputs.then((inputs) => inputs.handoff),
        prefetchManagedEntries,
      ),
    ])

    return await OptimizationProvider({ ...providerProps, handoff, hydration })
  }

  const RequestOptimizedEntry: NextjsBoundOptimizedEntryComponent<Promise<ReactElement>> = async (
    props: NextjsBoundOptimizedEntryProps,
  ) => await OptimizedEntry(props, getRequestRenderInputs())

  async function RequestNextAppAutoPageTracker(
    props: Parameters<NextjsAppRouterRequestOptimization['NextAppAutoPageTracker']>[0],
  ): Promise<ReactElement> {
    await getRequestRenderInputs()
    return createElement(NextAppAutoPageTracker, props)
  }

  return {
    createRequestHandoff,
    request: {
      NextAppAutoPageTracker: RequestNextAppAutoPageTracker,
      OptimizationProvider: RequestOptimizationProvider,
      OptimizationRoot: RequestOptimizationRoot,
      OptimizedEntry: RequestOptimizedEntry,
    },
  }
}

function getFallbackHydration(
  config: NextjsAppRouterServerOptimizationConfig,
): ContentOptimizationHydrationMode {
  return typeof config.request?.hydration === 'string'
    ? config.request.hydration
    : 'preserve-server'
}

async function resolveInitialExperienceEvents(
  input:
    | readonly InitialExperienceCommandInput[]
    | ((context: {
        readonly requestUrl: string
        readonly routeKey: string
      }) =>
        | readonly InitialExperienceCommandInput[]
        | Promise<readonly InitialExperienceCommandInput[]>)
    | undefined,
  context: { readonly requestUrl: string; readonly routeKey: string },
): Promise<readonly InitialExperienceCommandInput[] | undefined> {
  if (typeof input === 'function') return await input(context)
  return input
}

function resolveServerConsent(
  consent: NextjsOptimizationServerConsent | NextjsOptimizationServerConsentResolver | undefined,
  context: Parameters<NextjsOptimizationServerConsentResolver>[0],
): CoreStatelessRequestConsent | Promise<CoreStatelessRequestConsent> {
  if (consent === undefined) return false

  return typeof consent === 'function' ? consent(context) : consent
}
