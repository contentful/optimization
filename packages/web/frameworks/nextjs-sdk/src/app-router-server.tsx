import {
  LiveUpdatesProvider as ReactWebLiveUpdatesProvider,
  OptimizationAnalyticsRoot as ReactWebOptimizationAnalyticsRoot,
  OptimizationProvider as ReactWebOptimizationProvider,
  OptimizationRoot as ReactWebOptimizationRoot,
  type OptimizedEntryRenderContext,
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
import { cache, createElement, type ReactElement } from 'react'
import {
  bindNextjsAppRouterRequestRuntime,
  type AppRouterCreateRequestHandoffOptions,
} from './app-router-request-runtime'
import type {
  BoundNextjsAppRouterRequestClientRootProps,
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  NextjsAppRouterRequestOptimization,
  NextjsAppRouterServerOptimizationConfig,
  NextjsBoundOptimizedEntryComponent,
  NextjsBoundOptimizedEntryProps,
  NextjsBoundProviderConfig,
} from './bound-component-types'
import {
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationCacheMetadata,
  createPublicPermutationHandoff,
  type AnalyticsOptimizationHandoff,
  type BrowserOptimizationHandoff,
  type ContentOptimizationHandoff,
  type ContentOptimizationHydrationMode,
  type NextjsCreateHandoffFromSelectionsOptions,
  type NextjsCreatePublicPermutationHandoffOptions,
} from './handoff'
import { configureNextjsServerOptimization, type OptimizationNodeConfig } from './server'
import {
  renderOptimizedEntryOnServer,
  resolveOptimizedEntryChildren,
  toServerOptimizedEntryChildren,
} from './server-entry-renderer'
import type { ServerTrackingBaselineEntry } from './tracking-attributes'

export type { OptimizedEntryRenderContext } from '@contentful/optimization-react-web'
export type {
  BoundNextjsAppRouterRequestClientRootProps,
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  NextjsAppRouterRequestAutoPageTrackerProps,
  NextjsAppRouterRequestConfig,
  NextjsAppRouterRequestContext,
  NextjsAppRouterRequestHydration,
  NextjsAppRouterRequestOptimization,
  NextjsAppRouterRequestOptimizationProviderProps,
  NextjsAppRouterRequestOptimizationRootProps,
  NextjsAppRouterServerOptimizationConfig,
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
  createPublicPermutationCacheMetadata,
  createPublicPermutationHandoff,
  NextAppAutoPageTracker,
  resolveEntriesForSelections,
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
}

type IgnoredReactWebOptimizedEntryProps = Pick<
  ReactWebOptimizedEntryProps,
  'liveUpdates' | 'loadingFallback'
>
export interface NextjsAppRouterServerOptimization {
  readonly OptimizationRoot: (props: BoundNextjsOptimizationRootProps) => Promise<ReactElement>
  readonly OptimizationProvider: (
    props: BoundNextjsOptimizationProviderProps,
  ) => Promise<ReactElement | null>
  readonly OptimizationAnalyticsRoot: (
    props: BoundNextjsOptimizationAnalyticsRootProps,
  ) => ReactElement
  readonly OptimizedEntry: NextjsBoundOptimizedEntryComponent<Promise<ReactElement>>
  readonly NextAppAutoPageTracker: typeof NextAppAutoPageTracker
  readonly request: NextjsAppRouterRequestOptimization
  readonly createRequestHandoff: (
    options: AppRouterCreateRequestHandoffOptions,
  ) => Promise<ContentOptimizationHandoff>
  readonly createHandoffFromSelections: typeof createHandoffFromSelections
  readonly createOptimizationCacheKey: typeof createOptimizationCacheKey
  readonly createPublicPermutationHandoff: typeof createPublicPermutationHandoff
  readonly resolveEntriesForSelections: typeof resolveEntriesForSelections
}

export interface NextjsAppRouterServerOptimizationOptions {
  readonly request: {
    readonly OptimizationRoot: (props: BoundNextjsAppRouterRequestClientRootProps) => ReactElement
  }
}

interface AppRouterRequestHandoffStore {
  defaults?: StatefulDefaults
  state?: BrowserOptimizationHandoff['state']
}

const getRequestHandoffStore = cache((): AppRouterRequestHandoffStore => ({}))

export function bindNextjsAppRouterServerOptimization(
  config: NextjsAppRouterServerOptimizationConfig,
  options?: NextjsAppRouterServerOptimizationOptions,
): NextjsAppRouterServerOptimization {
  const sdk = configureNextjsServerOptimization(toServerOptimizationConfig(config))
  const rootConfig = toClientRootConfig(config)
  const providerConfig = toClientProviderConfig(config)
  const analyticsRootConfig = providerConfig

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

  function createBoundPublicPermutationHandoff(
    input: NextjsCreatePublicPermutationHandoffOptions & { readonly hydration: 'analytics-only' },
  ): AnalyticsOptimizationHandoff
  function createBoundPublicPermutationHandoff(
    input: NextjsCreatePublicPermutationHandoffOptions & {
      readonly hydration: ContentOptimizationHydrationMode
    },
  ): ContentOptimizationHandoff
  function createBoundPublicPermutationHandoff(
    input: NextjsCreatePublicPermutationHandoffOptions,
  ): BrowserOptimizationHandoff
  function createBoundPublicPermutationHandoff(
    input: NextjsCreatePublicPermutationHandoffOptions,
  ): BrowserOptimizationHandoff {
    const handoff = createPublicPermutationHandoff(input)
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

  const OptimizationRoot = renderBoundRootTree

  async function renderBoundRequestRootTree({
    children,
    handoff,
    prefetchManagedEntries,
    ...rootProps
  }: BoundNextjsOptimizationRootProps): Promise<ReactElement> {
    const RequestOptimizationRoot = options?.request.OptimizationRoot
    if (RequestOptimizationRoot === undefined) {
      return await renderBoundRootTree({
        ...rootProps,
        children,
        handoff,
        prefetchManagedEntries,
      })
    }

    const effectiveHandoff = await resolveHandoffEntries(handoff, prefetchManagedEntries)
    rememberRequestHandoff(effectiveHandoff)
    const { defaults } = withRequestDefaults(rootConfig)

    return createElement(
      RequestOptimizationRoot,
      {
        defaults,
        handoff: effectiveHandoff,
        hydration: rootProps.hydration,
      },
      children,
    )
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
    handoff:
      | BoundNextjsOptimizationProviderProps['handoff']
      | Promise<BoundNextjsOptimizationProviderProps['handoff']>,
    prefetchManagedEntries: BoundNextjsOptimizationProviderProps['prefetchManagedEntries'],
  ): Promise<BoundNextjsOptimizationProviderProps['handoff']> {
    if (prefetchManagedEntries === undefined) return await handoff

    const entriesPromise = sdk.prefetchManagedEntries(prefetchManagedEntries)
    void entriesPromise.catch(() => undefined)
    const resolvedHandoff = await handoff
    const entries = await entriesPromise

    if (resolvedHandoff === undefined) {
      return createHandoffFromSelections({
        cache: { scope: 'static' },
        entries,
        hydration: 'preserve-server',
        initialPageEvent: 'emit',
        selectedOptimizations: [],
      })
    }

    const mergedHandoff: BoundNextjsOptimizationProviderProps['handoff'] = {
      ...resolvedHandoff,
      entries: [...(resolvedHandoff.entries ?? []), ...entries],
    }

    return mergedHandoff
  }

  async function OptimizedEntry(
    props: NextjsBoundOptimizedEntryProps,
    requestBarrier?: Promise<unknown>,
  ): Promise<ReactElement> {
    const {
      baselineEntry: _baselineEntry,
      children,
      entryId: _entryId,
      entryQuery: _entryQuery,
      errorFallback: _errorFallback,
      liveUpdates: _liveUpdates,
      loadingFallback: _loadingFallback,
      managedEntry: _managedEntry,
      onEntryError: _onEntryError,
      onEntryResolved: _onEntryResolved,
      testId,
      'data-testid': dataTestId,
      ...serverEntryProps
    } = props as NextjsBoundOptimizedEntryProps & Partial<IgnoredReactWebOptimizedEntryProps>
    const topLevelHandoffState =
      requestBarrier === undefined ? getRequestHandoffStore().state : undefined
    const baselineEntryPromise = Promise.resolve(getAppRouterBaselineEntry(props))
    void baselineEntryPromise.catch(() => undefined)
    await requestBarrier
    const baselineEntry = await baselineEntryPromise
    const handoffState =
      requestBarrier === undefined ? topLevelHandoffState : getRequestHandoffStore().state
    const resolvedData = sdk.resolveOptimizedEntry(
      baselineEntry,
      handoffState?.selectedOptimizations,
    )
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
        : { 'data-testid': dataTestId ?? testId }
    return renderOptimizedEntryOnServer({
      ...serverEntryProps,
      ...testAttributes,
      baselineEntry,
      children: resolveOptimizedEntryChildren(
        toServerOptimizedEntryChildren(children),
        resolvedData.entry,
        renderContext,
      ),
      resolvedData,
    })
  }

  function getAppRouterBaselineEntry({
    baselineEntry,
    entryId,
    entryQuery,
    managedEntry,
  }: NextjsBoundOptimizedEntryProps):
    | ServerTrackingBaselineEntry
    | Promise<ServerTrackingBaselineEntry> {
    const { length: sourceCount } = [baselineEntry, entryId, managedEntry].filter(
      (source) => source !== undefined,
    )

    if (sourceCount !== 1) {
      throw new Error(
        'Bound Next.js OptimizedEntry requires exactly one source: baselineEntry, entryId, or managedEntry.',
      )
    }

    if (baselineEntry !== undefined) {
      return baselineEntry
    }

    return managedEntry !== undefined
      ? sdk.fetchContentfulEntry(managedEntry)
      : sdk.fetchContentfulEntry(entryId, entryQuery)
  }

  const { createRequestHandoff, request } = bindNextjsAppRouterRequestRuntime({
    config,
    OptimizationProvider,
    OptimizationRoot: renderBoundRequestRootTree,
    OptimizedEntry,
    rememberRequestHandoff,
    resolveHandoffEntries,
    sdk,
  })

  return {
    NextAppAutoPageTracker,
    OptimizationAnalyticsRoot,
    OptimizationProvider,
    OptimizationRoot,
    OptimizedEntry: OptimizedEntry as NextjsBoundOptimizedEntryComponent<Promise<ReactElement>>,
    createHandoffFromSelections: createBoundHandoffFromSelections,
    createOptimizationCacheKey,
    createPublicPermutationHandoff: createBoundPublicPermutationHandoff,
    createRequestHandoff,
    request,
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

function toServerOptimizationConfig(
  config: NextjsAppRouterServerOptimizationConfig,
): OptimizationNodeConfig {
  const {
    consent: _consent,
    cookie: _cookie,
    liveUpdates: _liveUpdates,
    onStatesReady: _onStatesReady,
    request: _request,
    trackEntryInteraction: _trackEntryInteraction,
    ...serverConfig
  } = config

  return serverConfig as OptimizationNodeConfig
}

function toClientRootConfig(
  config: NextjsAppRouterServerOptimizationConfig,
): NextjsBoundProviderConfig & Pick<ReactWebOptimizationRootProps, 'liveUpdates'> {
  const {
    consent,
    contentful: _contentful,
    cookie: _cookie,
    request: _request,
    ...clientConfig
  } = config

  return {
    ...clientConfig,
    defaults: consent?.clientDefaults,
  }
}

function toClientProviderConfig(
  config: NextjsAppRouterServerOptimizationConfig,
): NextjsBoundProviderConfig {
  const { liveUpdates: _liveUpdates, ...rootConfig } = toClientRootConfig(config)

  return rootConfig
}
