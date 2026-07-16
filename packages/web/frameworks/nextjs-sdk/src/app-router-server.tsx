import {
  LiveUpdatesProvider as ReactWebLiveUpdatesProvider,
  OptimizationAnalyticsRoot as ReactWebOptimizationAnalyticsRoot,
  OptimizationProvider as ReactWebOptimizationProvider,
  OptimizationRoot as ReactWebOptimizationRoot,
  type OptimizedEntryRenderContext,
  type OptimizationAnalyticsRootProps as ReactWebOptimizationAnalyticsRootProps,
  type OptimizationRootProps as ReactWebOptimizationRootProps,
  type OptimizedEntryProps as ReactWebOptimizedEntryProps,
} from '@contentful/optimization-react-web'
import {
  resolveEntriesForSelections,
  type StatefulDefaults,
} from '@contentful/optimization-react-web/core-sdk'
import {
  NextAppAutoPageTracker,
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
} from '@contentful/optimization-react-web/router/next-app'
import { cache, createElement, type ReactElement, type ReactNode } from 'react'
import type {
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  NextjsBoundOptimizedEntryProps,
  NextjsBoundProviderConfig,
  NextjsOptimizationComponentsConfig,
  NextjsOptimizationServerConsent,
  NextjsOptimizationServerConsentResolver,
} from './bound-component-types'
import {
  createNextjsCacheMiddleware,
  type NextjsCacheMiddleware,
  type NextjsCacheMiddlewareOptions,
} from './cache-middleware'
import {
  createHandoffFromSelections,
  createOptimizationCacheKey,
  type AnalyticsOptimizationHandoff,
  type BrowserOptimizationHandoff,
  type ContentOptimizationHandoff,
  type ContentOptimizationHydrationMode,
  type NextjsCreateHandoffFromSelectionsOptions,
} from './handoff'
import {
  configureNextjsServerOptimization,
  createNextjsRequestHandoff,
  type CoreStatelessRequestConsent,
  type NextjsRequestHandoffOptions,
  type NextjsRequestLike,
  type OptimizationNodeConfig,
} from './server'
import { renderOptimizedEntryOnServer } from './server-entry-renderer'
import {
  getServerTrackingAttributes,
  type ServerTrackingBaselineEntry,
  type ServerTrackingResolvedData,
} from './tracking-attributes'

export type { OptimizedEntryRenderContext } from '@contentful/optimization-react-web'
export type {
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  NextjsBoundOptimizedEntryProps,
  NextjsOptimizationComponentsConfig,
  NextjsOptimizationConsentConfig,
  NextjsOptimizationCookieConfig,
  NextjsOptimizationServerConsent,
  NextjsOptimizationServerConsentContext,
  NextjsOptimizationServerConsentResolver,
  NextjsServerOptimizedEntryProps,
} from './bound-component-types'
export {
  prefetchManagedEntries,
  type ManagedEntryDescriptor,
  type ManagedEntryHandoff,
} from './server'
export {
  createHandoffFromSelections,
  createOptimizationCacheKey,
  getServerTrackingAttributes,
  NextAppAutoPageTracker,
  resolveEntriesForSelections,
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
}
export type { NextjsCacheMiddleware, NextjsCacheMiddlewareOptions }

type IgnoredReactWebOptimizedEntryProps = Pick<
  ReactWebOptimizedEntryProps,
  'liveUpdates' | 'loadingFallback'
>
type NextjsBoundManagedEntryQuery = Extract<
  NextjsBoundOptimizedEntryProps,
  { entryId: string }
>['entryQuery']
type AppRouterCreateRequestHandoffOptions = Omit<
  NextjsRequestHandoffOptions,
  'consent' | 'cookies' | 'headers' | 'hydration' | 'locale' | 'request'
> & {
  readonly hydration: ContentOptimizationHydrationMode
  readonly locale?: string
  readonly request: NextjsRequestLike
}

export interface NextjsOptimizationComponents {
  readonly OptimizationRoot: (props: BoundNextjsOptimizationRootProps) => Promise<ReactElement>
  readonly OptimizationProvider: (
    props: BoundNextjsOptimizationProviderProps,
  ) => Promise<ReactElement | null>
  readonly OptimizationAnalyticsRoot: (
    props: BoundNextjsOptimizationAnalyticsRootProps,
  ) => ReactElement
  readonly OptimizedEntry: (props: NextjsBoundOptimizedEntryProps) => Promise<ReactElement>
  readonly NextAppAutoPageTracker: typeof NextAppAutoPageTracker
  readonly createRequestHandoff: (
    options: AppRouterCreateRequestHandoffOptions,
  ) => Promise<ContentOptimizationHandoff>
  readonly createHandoffFromSelections: typeof createHandoffFromSelections
  readonly createOptimizationCacheKey: typeof createOptimizationCacheKey
  readonly createCacheMiddleware: (options: NextjsCacheMiddlewareOptions) => NextjsCacheMiddleware
  readonly getServerTrackingAttributes: typeof getServerTrackingAttributes
  readonly resolveEntriesForSelections: typeof resolveEntriesForSelections
}

const EMPTY_COOKIE_READER = {
  get: () => undefined,
}

interface AppRouterRequestHandoffStore {
  defaults?: StatefulDefaults
  state?: BrowserOptimizationHandoff['state']
}

const getRequestHandoffStore = cache((): AppRouterRequestHandoffStore => ({}))

/**
 * Bind one App Router SDK component set per app, outside React render, and reuse the returned
 * methods. React may re-render the bound components; binding calls themselves are not
 * isolation boundaries because request handoff state is shared through React cache.
 */
export function bindNextjsAppRouterOptimization(
  config: NextjsOptimizationComponentsConfig,
): NextjsOptimizationComponents {
  const sdk = configureNextjsServerOptimization(toServerOptimizationConfig(config))
  const rootConfig = toClientRootConfig(config)
  const providerConfig = toClientProviderConfig(config)
  const analyticsRootConfig = toAnalyticsRootConfig(config)

  async function createRequestHandoff(
    options: AppRouterCreateRequestHandoffOptions,
  ): Promise<ContentOptimizationHandoff> {
    const consent = await resolveServerConsent(config.consent?.server, {
      cookies: options.request.cookies ?? EMPTY_COOKIE_READER,
      headers: options.request.headers,
    })
    const { handoff } = await createNextjsRequestHandoff(sdk, {
      ...options,
      consent,
      locale: options.locale ?? config.locale,
      request: options.request,
    })

    rememberRequestHandoff(handoff, toHandoffDefaults(consent))

    return handoff
  }

  function createBoundHandoffFromSelections(
    input: NextjsCreateHandoffFromSelectionsOptions & { readonly hydration: 'analytics-only' },
  ): AnalyticsOptimizationHandoff
  function createBoundHandoffFromSelections(
    input: NextjsCreateHandoffFromSelectionsOptions & {
      readonly hydration: ContentOptimizationHydrationMode
    },
  ): ContentOptimizationHandoff
  function createBoundHandoffFromSelections(
    input: NextjsCreateHandoffFromSelectionsOptions,
  ): BrowserOptimizationHandoff
  function createBoundHandoffFromSelections(
    input: NextjsCreateHandoffFromSelectionsOptions,
  ): BrowserOptimizationHandoff {
    const handoff = createHandoffFromSelections(input)
    rememberRequestHandoff(handoff)

    return handoff
  }

  async function renderBoundRootTree({
    children,
    handoff,
    prefetchManagedEntries,
    ...rootProps
  }: BoundNextjsOptimizationRootProps): Promise<ReactElement> {
    const effectiveHandoff = await resolveHandoffEntries(handoff, prefetchManagedEntries)
    rememberRequestHandoff(effectiveHandoff)
    const { buildPagePayload, ...serializableRootProps } = withRequestDefaults({
      ...rootConfig,
      ...rootProps,
    })

    return createElement(
      ReactWebOptimizationRoot,
      {
        ...serializableRootProps,
        handoff: effectiveHandoff,
        ...(buildPagePayload === undefined
          ? {}
          : { initialPagePayload: buildPagePayload({ isInitialEmission: true }) }),
      },
      children,
    )
  }

  async function OptimizationRoot(props: BoundNextjsOptimizationRootProps): Promise<ReactElement> {
    return await renderBoundRootTree(props)
  }

  async function OptimizationProvider({
    children,
    handoff,
    hydration,
    prefetchManagedEntries,
  }: BoundNextjsOptimizationProviderProps): Promise<ReactElement | null> {
    const effectiveHandoff = await resolveHandoffEntries(handoff, prefetchManagedEntries)
    rememberRequestHandoff(effectiveHandoff)

    return createElement(
      ReactWebOptimizationProvider,
      { ...withRequestDefaults(providerConfig), handoff: effectiveHandoff, hydration },
      createElement(
        ReactWebLiveUpdatesProvider,
        { globalLiveUpdates: config.liveUpdates },
        children,
      ),
    )
  }

  function OptimizationAnalyticsRoot(
    props: BoundNextjsOptimizationAnalyticsRootProps,
  ): ReactElement {
    const { buildPagePayload, handoff, ...analyticsProps } = props
    rememberRequestHandoff(handoff)

    return createElement(ReactWebOptimizationAnalyticsRoot, {
      ...analyticsRootConfig,
      ...analyticsProps,
      handoff,
      ...(buildPagePayload === undefined
        ? {}
        : { initialPagePayload: buildPagePayload({ isInitialEmission: true }) }),
    })
  }

  async function resolveHandoffEntries(
    handoff: BoundNextjsOptimizationProviderProps['handoff'],
    prefetchManagedEntries: BoundNextjsOptimizationProviderProps['prefetchManagedEntries'],
  ): Promise<BoundNextjsOptimizationProviderProps['handoff']> {
    if (prefetchManagedEntries === undefined) return handoff

    const entries = await sdk.prefetchManagedEntries(prefetchManagedEntries)

    if (handoff === undefined) {
      return createHandoffFromSelections({
        cache: { scope: 'static' },
        entries,
        hydration: 'preserve-server',
        initialPageEvent: 'emit',
        selectedOptimizations: [],
      })
    }

    const mergedHandoff: BoundNextjsOptimizationProviderProps['handoff'] = {
      ...handoff,
      entries: [...(handoff.entries ?? []), ...entries],
    }

    return mergedHandoff
  }

  async function OptimizedEntry(props: NextjsBoundOptimizedEntryProps): Promise<ReactElement> {
    const {
      baselineEntry: suppliedBaselineEntry,
      children,
      entryId,
      entryQuery,
      errorFallback: _errorFallback,
      liveUpdates: _liveUpdates,
      loadingFallback: _loadingFallback,
      onEntryError: _onEntryError,
      onEntryResolved: _onEntryResolved,
      testId,
      'data-testid': dataTestId,
      ...serverEntryProps
    } = props as NextjsBoundOptimizedEntryProps & Partial<IgnoredReactWebOptimizedEntryProps>
    const handoffState = getRequestHandoffState()
    const { baselineEntry, resolvedData } =
      suppliedBaselineEntry === undefined
        ? await resolveManagedServerOptimizedEntry(entryId, entryQuery, handoffState)
        : {
            baselineEntry: suppliedBaselineEntry,
            resolvedData: sdk.resolveOptimizedEntry(
              suppliedBaselineEntry,
              handoffState?.selectedOptimizations,
            ),
          }
    const renderContext: OptimizedEntryRenderContext = {
      baselineEntry,
      baselineEntryId: baselineEntry.sys.id,
      entry: resolvedData.entry,
      entryId: resolvedData.entry.sys.id,
      getMergeTagValue: (embeddedEntryNodeTarget, profile = handoffState?.profile) =>
        sdk.getMergeTagValue(embeddedEntryNodeTarget, profile),
      optimizationContextId: resolvedData.optimizationContextId,
      resolvedData,
      selectedOptimization: resolvedData.selectedOptimization,
      selectedOptimizations: handoffState?.selectedOptimizations,
    }
    const testAttributes =
      dataTestId === undefined && testId === undefined
        ? {}
        : {
            'data-testid': dataTestId ?? testId,
          }

    return renderOptimizedEntryOnServer({
      ...serverEntryProps,
      ...testAttributes,
      baselineEntry,
      children: resolveOptimizedEntryChildren(children, resolvedData.entry, renderContext),
      resolvedData,
    })
  }

  async function resolveManagedServerOptimizedEntry(
    entryId: string | undefined,
    entryQuery: NextjsBoundManagedEntryQuery,
    handoffState: BrowserOptimizationHandoff['state'] | undefined,
  ): Promise<{
    readonly baselineEntry: ServerTrackingBaselineEntry
    readonly resolvedData: ServerTrackingResolvedData
  }> {
    if (entryId === undefined) {
      throw new Error('Bound Next.js OptimizedEntry requires either baselineEntry or entryId.')
    }

    const result = await sdk.fetchOptimizedEntry(entryId, {
      query: entryQuery,
      selectedOptimizations: handoffState?.selectedOptimizations,
    })

    return { baselineEntry: result.baselineEntry, resolvedData: result }
  }

  return {
    NextAppAutoPageTracker,
    OptimizationAnalyticsRoot,
    OptimizationProvider,
    OptimizationRoot,
    OptimizedEntry,
    createCacheMiddleware: createNextjsCacheMiddleware,
    createHandoffFromSelections: createBoundHandoffFromSelections,
    createOptimizationCacheKey,
    createRequestHandoff,
    getServerTrackingAttributes,
    resolveEntriesForSelections,
  }
}

function rememberRequestHandoff(
  handoff: BrowserOptimizationHandoff | undefined,
  defaults?: StatefulDefaults,
): void {
  if (handoff === undefined) return

  const store = getRequestHandoffStore()

  if (handoff.hydration === 'analytics-only') {
    delete store.state
    return
  }

  const { state } = handoff
  store.state = state
  if (defaults !== undefined) {
    store.defaults = defaults
  }
}

function getRequestHandoffState(): BrowserOptimizationHandoff['state'] | undefined {
  return getRequestHandoffStore().state
}

function withRequestDefaults<T extends object>(
  props: T,
): T & { readonly defaults?: StatefulDefaults } {
  const { defaults } = getRequestHandoffStore()

  if (defaults === undefined) return props

  return {
    ...props,
    defaults: {
      ...(props as { readonly defaults?: StatefulDefaults }).defaults,
      ...defaults,
    },
  }
}

function toHandoffDefaults(consent: CoreStatelessRequestConsent): StatefulDefaults {
  if (typeof consent === 'boolean') {
    return { consent, persistenceConsent: consent }
  }

  return {
    ...(consent.events === undefined ? {} : { consent: consent.events }),
    ...(consent.persistence === undefined ? {} : { persistenceConsent: consent.persistence }),
  }
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

function toClientRootConfig(
  config: NextjsOptimizationComponentsConfig,
): NextjsBoundProviderConfig & Pick<ReactWebOptimizationRootProps, 'liveUpdates'> {
  const { consent, cookie: _cookie, ...clientConfig } = config

  return {
    ...clientConfig,
    defaults: consent?.clientDefaults,
  }
}

function toClientProviderConfig(
  config: NextjsOptimizationComponentsConfig,
): NextjsBoundProviderConfig {
  const { liveUpdates: _liveUpdates, ...rootConfig } = toClientRootConfig(config)

  return rootConfig
}

function toAnalyticsRootConfig(
  config: NextjsOptimizationComponentsConfig,
): Omit<ReactWebOptimizationAnalyticsRootProps, keyof BoundNextjsOptimizationAnalyticsRootProps> {
  const { liveUpdates: _liveUpdates, ...rootConfig } = toClientRootConfig(config)

  return rootConfig
}

function resolveOptimizedEntryChildren(
  children: ReactWebOptimizedEntryProps['children'],
  entry: ServerTrackingResolvedData['entry'],
  context: OptimizedEntryRenderContext,
): ReactNode {
  return typeof children === 'function' ? children(entry, context) : children
}

function resolveServerConsent(
  consent: NextjsOptimizationServerConsent | NextjsOptimizationServerConsentResolver | undefined,
  context: Parameters<NextjsOptimizationServerConsentResolver>[0],
): CoreStatelessRequestConsent | Promise<CoreStatelessRequestConsent> {
  if (consent === undefined) return false

  return typeof consent === 'function' ? consent(context) : consent
}
