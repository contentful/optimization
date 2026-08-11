import { createRequestHandoffFromData } from '@contentful/optimization-node'
import type {
  OptimizationCacheMetadata,
  PrivateRequestOptimizationCacheMetadata,
} from '@contentful/optimization-react-web/core-sdk'
import { NextAppAutoPageTracker } from '@contentful/optimization-react-web/next-app'
import { cookies, headers } from 'next/headers'
import { cache, createElement, type ReactElement } from 'react'
import {
  assertRequestHandoffCacheMetadata,
  readNextjsForwardedServerData,
  toForwardedProfileOptions,
  toHandoffDefaults,
} from './app-router-request-handoff'
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
import {
  addBrowserHandoffMetadata,
  type BrowserOptimizationHandoff,
  type ContentOptimizationHandoff,
  type ContentOptimizationHydrationMode,
} from './handoff'
import { NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER } from './request-context'
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

    const forwardedServerData = readNextjsForwardedServerData(
      options.request.headers,
      options.trustedRequestHandoff,
    )
    if (forwardedServerData !== undefined) {
      const data =
        forwardedServerData.profileId === undefined
          ? undefined
          : await sdk.api.experience.getProfile(
              forwardedServerData.profileId,
              toForwardedProfileOptions(options, config.locale),
            )
      const handoff = addBrowserHandoffMetadata(
        createRequestHandoffFromData({
          cache: cacheMetadata,
          data,
          entries: options.entries,
        }),
        {
          hydration: options.hydration,
          initialPageEvent: forwardedServerData.pageAccepted ? 'skip' : 'emit',
        },
      )
      rememberRequestHandoff(handoff, toHandoffDefaults(forwardedServerData.consent))

      return handoff
    }

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

    rememberRequestHandoff(handoff, toHandoffDefaults(consent))

    return handoff
  }

  const getRequestRenderInputs = cache(async () => {
    const cookieStore = await cookies()
    const requestHeaders = new Headers(await headers())
    const requestUrl = requestHeaders.get(NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER)

    if (requestUrl === null) {
      throw new Error(
        'Missing x-ctfl-opt-request-url. Configure the Contentful Optimization request handler in your Next.js proxy before using request components.',
      )
    }

    const url = new URL(requestUrl)
    const routeKey = `${url.pathname}${url.search}`
    const pagePayload = {
      properties: { path: url.pathname, search: url.search, url: requestUrl },
    }
    const hydration =
      typeof config.request?.hydration === 'function'
        ? config.request.hydration({ requestUrl, routeKey })
        : (config.request?.hydration ?? 'preserve-server')
    const handoff = await createRequestHandoff({
      hydration,
      pagePayload,
      request: { cookies: cookieStore, headers: requestHeaders, url: requestUrl },
      trustedRequestHandoff: config.request?.trustedRequestHandoff,
    })

    return { handoff, hydration, pagePayload, routeKey }
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
      initialPagePayload: pagePayload,
      routeKey,
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
    const { handoff } = await getRequestRenderInputs()

    return createElement(NextAppAutoPageTracker, {
      ...props,
      initialPageEvent: handoff.initialPageEvent,
    })
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

function resolveServerConsent(
  consent: NextjsOptimizationServerConsent | NextjsOptimizationServerConsentResolver | undefined,
  context: Parameters<NextjsOptimizationServerConsentResolver>[0],
): CoreStatelessRequestConsent | Promise<CoreStatelessRequestConsent> {
  if (consent === undefined) return false

  return typeof consent === 'function' ? consent(context) : consent
}
