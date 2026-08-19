import type NodeContentfulOptimization from '@contentful/optimization-node'
import type { ResolvedData } from '@contentful/optimization-node/core-sdk'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import type { ReactElement } from 'react'
import {
  bindNextjsAppRouterClientOptimization,
  type InitialExperienceClient as AppInitialExperienceClient,
  type InitialExperienceOptions as AppInitialExperienceOptions,
  type BoundNextjsAppRouterRequestClientRootProps,
  type BoundNextjsOptimizationAnalyticsRootProps,
  type BoundNextjsOptimizationProviderProps,
  type BoundNextjsOptimizationRootProps,
  type BoundNextjsOptimizationRootWithInitialExperienceProps,
  type NextjsAppRouterClientOptimization as NextjsAppClientComponents,
  type NextjsAppRouterClientOptimizationWithInitialExperience,
  type NextjsBoundOptimizedEntryProps,
  type NextjsClientOptimizationConfig,
  type NextjsClientOptimizationConfigWithInitialExperience,
  type NextjsClientOptimizationConfigWithoutInitialExperience,
} from './app-router-client'
import {
  bindNextjsAppRouterServerOptimization,
  type NextjsAppRouterServerOptimizationConfig,
  type NextjsAppRouterServerOptimizationOptions,
  type NextjsAppRouterServerOptimization as NextjsAppServerComponents,
} from './app-router-server'
import type { NextjsOptimizationComponentsConfig } from './bound-component-types'
import type {
  InitialExperienceClient,
  InitialExperienceOptions,
  OptimizationSdk,
  OptimizationWebRuntime,
  OptimizedEntryProps,
  OptimizedEntryRenderContext,
} from './client'
import type { ContentOptimizationHandoff } from './handoff'
import {
  bindNextjsPagesRouterOptimization,
  type NextjsClientOptimizationConfig as NextjsPagesClientOptimizationConfig,
  type NextjsClientOptimizationConfigWithInitialExperience as NextjsPagesClientOptimizationConfigWithInitialExperience,
  type NextjsClientOptimizationConfigWithoutInitialExperience as NextjsPagesClientOptimizationConfigWithoutInitialExperience,
  type NextjsPagesRouterOptimization,
  type NextjsPagesRouterOptimizationWithInitialExperience,
  type BoundNextjsOptimizationRootWithInitialExperienceProps as PagesBoundNextjsOptimizationRootWithInitialExperienceProps,
  type InitialExperienceClient as PagesInitialExperienceClient,
  type InitialExperienceOptions as PagesInitialExperienceOptions,
} from './pages-router'
import { bindNextjsPagesRouterServerOptimization } from './pages-router-server'
import {
  ServerOptimizedEntry,
  type ContentfulOptimization as NextjsServerOptimization,
  type ServerOptimizedEntryFetchResult,
  type ServerOptimizedEntryProps,
} from './server'
import { getServerTrackingAttributes, type ServerTrackingResolvedData } from './tracking-attributes'

type PageSkeleton = EntrySkeletonType<{ title: EntryFieldTypes.Symbol }, 'page'>
type HeroSkeleton = EntrySkeletonType<{ headline: EntryFieldTypes.Symbol }, 'hero'>
type ModeledSkeleton = PageSkeleton | HeroSkeleton
type Modifier = 'WITHOUT_LINK_RESOLUTION'
type Locale = 'en-US'

export function acceptModeledNextjsEntries(
  baselineEntry: Entry<PageSkeleton, Modifier, Locale>,
  resolvedData: ResolvedData<ModeledSkeleton, Modifier, Locale>,
  result: ServerOptimizedEntryFetchResult<ModeledSkeleton, Modifier, Locale>,
  components: NextjsAppServerComponents,
): void {
  const props: ServerOptimizedEntryProps<'section', ModeledSkeleton, Modifier, Locale> = {
    as: 'section',
    baselineEntry,
    resolvedData,
  }

  ServerOptimizedEntry<'section', ModeledSkeleton, Modifier, Locale>(props)
  ServerOptimizedEntry<'section', ModeledSkeleton, Modifier, Locale>({ as: 'section', result })
  getServerTrackingAttributes<ModeledSkeleton, Modifier, Locale>(baselineEntry, resolvedData)
  void components.OptimizedEntry<ModeledSkeleton, Modifier, Locale>({
    baselineEntry,
    children: (entry, metadata) => `${entry.sys.id}:${metadata.entry.sys.id}`,
  })
  void components.OptimizedEntry<ModeledSkeleton, Locale>({
    entryId: 'page',
    children: (entry) => entry.sys.id,
  })
  void components.OptimizedEntry<ModeledSkeleton, Locale>({
    children: (entry) => entry.sys.id,
    managedEntry: {
      contentType: 'page',
      entryQuery: { locale: 'de-DE' },
      slug: '/products',
      slugField: 'path',
    },
  })
}

export function assertAppRouterChildrenNeedVarianceBridge(
  children: NextjsBoundOptimizedEntryProps['children'],
  entry: ServerTrackingResolvedData['entry'],
  context: OptimizedEntryRenderContext,
): void {
  if (typeof children === 'function') {
    // @ts-expect-error Default props combine callbacks with incompatible modifier variance.
    children(entry, context)
  }
}

export function acceptNextjsClientSdk(runtime: OptimizationWebRuntime): OptimizationSdk {
  return runtime
}

export function acceptNextjsServerSdk(
  runtime: NodeContentfulOptimization,
): NextjsServerOptimization {
  return runtime
}

export function acceptConcreteNodeRuntime(
  sdk: NextjsServerOptimization,
): NodeContentfulOptimization {
  return sdk
}

export function assertBrowserRuntimeIsNotServerRuntime(runtime: OptimizationSdk): void {
  // @ts-expect-error browser runtimes do not expose the required server request binding.
  const serverRuntime: NextjsServerOptimization = runtime
  void serverRuntime
}

export function acceptAppClientOptimizedEntryProps(
  props: Parameters<NextjsAppClientComponents['OptimizedEntry']>[0],
): NextjsBoundOptimizedEntryProps {
  return props
}

export function acceptAppServerOptimizedEntryProps(
  props: Parameters<NextjsAppServerComponents['OptimizedEntry']>[0],
): NextjsBoundOptimizedEntryProps {
  return props
}

export function rejectAppRouterEntryLiveUpdates(
  components: NextjsAppClientComponents,
  props: NextjsBoundOptimizedEntryProps,
): void {
  components.OptimizedEntry({
    ...props,
    // @ts-expect-error App Router bound OptimizedEntry owns live updates at root/provider config.
    liveUpdates: true,
  })
}

export function rejectAppRouterEntryLoadingFallback(
  components: NextjsAppServerComponents,
  props: NextjsBoundOptimizedEntryProps,
): void {
  void components.OptimizedEntry({
    ...props,
    // @ts-expect-error App Router server OptimizedEntry resolves immediately.
    loadingFallback: null,
  })
}

export function acceptAppRouterProviderProps(
  components: NextjsAppClientComponents,
  handoff: BoundNextjsOptimizationProviderProps['handoff'],
): void {
  components.OptimizationProvider({
    children: null,
    handoff,
    hydration: 'preserve-server',
    prefetchManagedEntries: ['hero'],
  })
}

export function acceptAppRouterServerProviderProps(
  components: NextjsAppServerComponents,
  props: BoundNextjsOptimizationProviderProps,
): void {
  void components.OptimizationProvider({
    ...props,
    hydration: 'preserve-server',
    prefetchManagedEntries: ['hero'],
  })
}

export function acceptAppRouterRequestComponents(
  components: NextjsAppServerComponents,
  props: NextjsBoundOptimizedEntryProps,
): void {
  void components.request.OptimizationRoot({ children: null, prefetchManagedEntries: ['hero'] })
  void components.request.OptimizationProvider({
    children: null,
    prefetchManagedEntries: ['hero'],
  })
  void components.request.OptimizedEntry(props)
  void components.request.NextAppAutoPageTracker({})
}

export function acceptAppRouterRequestConfig(
  config: NextjsAppRouterServerOptimizationConfig,
): void {
  const resolvedConfig: NextjsAppRouterServerOptimizationConfig = {
    ...config,
    request: {
      hydration: ({ requestUrl, routeKey }) =>
        requestUrl.includes(routeKey) ? 'preserve-server' : 'client-only-hidden-until-ready',
      trustedRequestHandoff: true,
    },
  }
  void resolvedConfig
}

export function acceptBoundPublicPermutationHandoffOverload(
  components: NextjsAppServerComponents,
): ContentOptimizationHandoff {
  return components.createPublicPermutationHandoff({
    hydration: 'preserve-server',
    initialPageEvent: 'emit',
    permutationKey: 'new-visitor',
    selectedOptimizations: [],
  })
}

export function rejectClientAppRouterRequestConfig(
  config: NextjsOptimizationComponentsConfig,
): void {
  const clientConfig: NextjsOptimizationComponentsConfig = {
    ...config,
    // @ts-expect-error Request configuration belongs only to the App Router server binder.
    request: {},
  }
  void clientConfig
}

export function rejectAppRouterRequestOwnedProps(
  components: NextjsAppServerComponents,
  handoff: BoundNextjsOptimizationProviderProps['handoff'],
): void {
  void components.request.OptimizationRoot({
    children: null,
    // @ts-expect-error Request roots own their handoff.
    handoff,
  })
  void components.request.OptimizationRoot({
    // @ts-expect-error Request roots own their hydration.
    hydration: 'preserve-server',
  })
  void components.request.OptimizationRoot({
    // @ts-expect-error Request roots derive the initial page payload.
    initialPagePayload: {},
  })
  void components.request.OptimizationRoot({
    // @ts-expect-error Request roots derive the page payload builder input.
    buildPagePayload: () => ({}),
  })
  void components.request.OptimizationRoot({
    // @ts-expect-error Request roots derive the route key.
    routeKey: '/products',
  })
  void components.request.OptimizationProvider({
    // @ts-expect-error Request providers own their handoff.
    handoff,
  })
  void components.request.OptimizationProvider({
    children: null,
    // @ts-expect-error Request providers own hydration.
    hydration: 'preserve-server',
  })
  void components.request.NextAppAutoPageTracker({
    // @ts-expect-error Request page trackers own the initial page event.
    initialPageEvent: 'emit',
  })
}

export function acceptAppRouterRootPageEventProps(
  components: NextjsAppClientComponents,
  props: BoundNextjsOptimizationRootProps,
): void {
  components.OptimizationRoot({
    ...props,
    buildPagePayload: () => ({ properties: { route: '/products' } }),
    initialPagePayload: { properties: { route: '/products' } },
    routeKey: '/products',
  })
}

export function rejectAppRouterProviderRouteKey(
  components: NextjsAppClientComponents,
  props: BoundNextjsOptimizationProviderProps,
): void {
  components.OptimizationProvider({
    ...props,
    // @ts-expect-error Bound provider does not own page route wiring.
    routeKey: '/products',
  })
}

export function rejectAppRouterProviderBuildPagePayload(
  components: NextjsAppClientComponents,
  props: BoundNextjsOptimizationProviderProps,
): void {
  components.OptimizationProvider({
    ...props,
    // @ts-expect-error Bound provider does not own initial page payload builders.
    buildPagePayload: () => ({ properties: { route: '/products' } }),
  })
}

export function rejectAppRouterProviderInitialPagePayload(
  components: NextjsAppClientComponents,
  props: BoundNextjsOptimizationProviderProps,
): void {
  components.OptimizationProvider({
    ...props,
    // @ts-expect-error Bound provider does not own initial page payloads.
    initialPagePayload: { properties: { route: '/products' } },
  })
}

export function acceptPagesRouterEntryProps(
  components: NextjsPagesRouterOptimization,
  props: OptimizedEntryProps,
): void {
  components.OptimizedEntry(props)
  components.OptimizedEntry({
    children: (entry) => entry.sys.id,
    managedEntry: { contentType: 'page', slug: '/products' },
  })
}

export function acceptPagesRouterProviderProps(
  components: NextjsPagesRouterOptimization,
  props: BoundNextjsOptimizationProviderProps,
): void {
  components.OptimizationProvider({
    ...props,
    hydration: 'preserve-server',
    prefetchManagedEntries: ['hero'],
  })
}

const clientBindingConfig = {
  clientId: 'test-client-id',
  environment: 'main',
} as const

const initialExperience: InitialExperienceOptions = {
  run: () => undefined,
}

const buildPagePayload = (): { readonly properties: { readonly route: string } } => ({
  properties: { route: '/products' },
})

const initialPagePayload = { properties: { route: '/products' } }

export function acceptInitialExperienceClientTypePassThroughs(
  client: InitialExperienceClient,
  appClient: AppInitialExperienceClient,
  pagesClient: PagesInitialExperienceClient,
): void {
  void [client, appClient, pagesClient]
}

export function acceptInitialExperienceOptionsTypePassThroughs(
  options: InitialExperienceOptions,
  appOptions: AppInitialExperienceOptions,
  pagesOptions: PagesInitialExperienceOptions,
): void {
  void [options, appOptions, pagesOptions]
}

export function assertAppRouterClientConfigBranches(
  absentExport: NextjsClientOptimizationConfigWithoutInitialExperience,
  presentExport: NextjsClientOptimizationConfigWithInitialExperience,
  widenedExport: NextjsClientOptimizationConfig,
  maybeInitialExperience: InitialExperienceOptions | undefined,
): void {
  const absentLiteral = bindNextjsAppRouterClientOptimization({ ...clientBindingConfig })
  absentLiteral.OptimizationRoot({ initialPagePayload, routeKey: '/products' })

  const presentLiteral = bindNextjsAppRouterClientOptimization({
    ...clientBindingConfig,
    initialExperience,
  })
  presentLiteral.OptimizationRoot({ buildPagePayload, routeKey: '/products' })
  // @ts-expect-error Callback-present roots require a route key.
  presentLiteral.OptimizationRoot({ buildPagePayload })
  // @ts-expect-error Callback-present roots require a payload builder.
  presentLiteral.OptimizationRoot({ routeKey: '/products' })
  // @ts-expect-error Callback-present roots require both page inputs.
  presentLiteral.OptimizationRoot({})
  // @ts-expect-error Callback-present roots cannot use an eager initial page payload.
  presentLiteral.OptimizationRoot({ initialPagePayload, routeKey: '/products' })

  const absentSatisfies = {
    ...clientBindingConfig,
  } satisfies NextjsClientOptimizationConfig
  bindNextjsAppRouterClientOptimization(absentSatisfies).OptimizationRoot({
    initialPagePayload,
    routeKey: '/products',
  })

  const presentSatisfies = {
    ...clientBindingConfig,
    initialExperience,
  } satisfies NextjsClientOptimizationConfig
  bindNextjsAppRouterClientOptimization(presentSatisfies).OptimizationRoot({
    buildPagePayload,
    routeKey: '/products',
  })

  bindNextjsAppRouterClientOptimization(absentExport).OptimizationRoot({
    initialPagePayload,
    routeKey: '/products',
  })
  const presentBound: NextjsAppRouterClientOptimizationWithInitialExperience =
    bindNextjsAppRouterClientOptimization(presentExport)
  presentBound.OptimizationRoot({ buildPagePayload, routeKey: '/products' })
  presentBound.RequestOptimizationRoot({ children: null })

  // @ts-expect-error Callback-absent App bindings do not expose a request client root.
  const absentRequestRoot = absentLiteral.RequestOptimizationRoot
  void absentRequestRoot

  const widenedBound = bindNextjsAppRouterClientOptimization(widenedExport)
  widenedBound.OptimizationRoot({ buildPagePayload, routeKey: '/products' })
  // @ts-expect-error A widened branch must satisfy the callback-present root contract.
  widenedBound.OptimizationRoot({})
  // @ts-expect-error A widened branch cannot safely accept an eager initial page payload.
  widenedBound.OptimizationRoot({ initialPagePayload, routeKey: '/products' })

  const widenedMaybeConfig: NextjsClientOptimizationConfig = {
    ...clientBindingConfig,
    initialExperience: maybeInitialExperience,
  }
  const widenedMaybeBound = bindNextjsAppRouterClientOptimization(widenedMaybeConfig)
  widenedMaybeBound.OptimizationRoot({ buildPagePayload, routeKey: '/products' })
  // @ts-expect-error A maybe-undefined branch retains the conservative root contract.
  widenedMaybeBound.OptimizationRoot({})
  // @ts-expect-error A maybe-undefined branch cannot safely accept an eager page payload.
  widenedMaybeBound.OptimizationRoot({ initialPagePayload, routeKey: '/products' })
}

export function assertPagesRouterClientConfigBranches(
  absentExport: NextjsPagesClientOptimizationConfigWithoutInitialExperience,
  presentExport: NextjsPagesClientOptimizationConfigWithInitialExperience,
  widenedExport: NextjsPagesClientOptimizationConfig,
  maybeInitialExperience: InitialExperienceOptions | undefined,
): void {
  const absentLiteral = bindNextjsPagesRouterOptimization({ ...clientBindingConfig })
  absentLiteral.OptimizationRoot({ initialPagePayload, routeKey: '/products' })

  const presentLiteral = bindNextjsPagesRouterOptimization({
    ...clientBindingConfig,
    initialExperience,
  })
  presentLiteral.OptimizationRoot({ buildPagePayload, routeKey: '/products' })
  // @ts-expect-error Callback-present roots require a route key.
  presentLiteral.OptimizationRoot({ buildPagePayload })
  // @ts-expect-error Callback-present roots require a payload builder.
  presentLiteral.OptimizationRoot({ routeKey: '/products' })
  // @ts-expect-error Callback-present roots require both page inputs.
  presentLiteral.OptimizationRoot({})
  // @ts-expect-error Callback-present roots cannot use an eager initial page payload.
  presentLiteral.OptimizationRoot({ initialPagePayload, routeKey: '/products' })

  const absentSatisfies = {
    ...clientBindingConfig,
  } satisfies NextjsPagesClientOptimizationConfig
  bindNextjsPagesRouterOptimization(absentSatisfies).OptimizationRoot({
    initialPagePayload,
    routeKey: '/products',
  })

  const presentSatisfies = {
    ...clientBindingConfig,
    initialExperience,
  } satisfies NextjsPagesClientOptimizationConfig
  bindNextjsPagesRouterOptimization(presentSatisfies).OptimizationRoot({
    buildPagePayload,
    routeKey: '/products',
  })

  bindNextjsPagesRouterOptimization(absentExport).OptimizationRoot({
    initialPagePayload,
    routeKey: '/products',
  })
  const presentBound: NextjsPagesRouterOptimizationWithInitialExperience =
    bindNextjsPagesRouterOptimization(presentExport)
  presentBound.OptimizationRoot({ buildPagePayload, routeKey: '/products' })

  const widenedBound = bindNextjsPagesRouterOptimization(widenedExport)
  widenedBound.OptimizationRoot({ buildPagePayload, routeKey: '/products' })
  // @ts-expect-error A widened branch must satisfy the callback-present root contract.
  widenedBound.OptimizationRoot({})
  // @ts-expect-error A widened branch cannot safely accept an eager initial page payload.
  widenedBound.OptimizationRoot({ initialPagePayload, routeKey: '/products' })

  const widenedMaybeConfig: NextjsPagesClientOptimizationConfig = {
    ...clientBindingConfig,
    initialExperience: maybeInitialExperience,
  }
  const widenedMaybeBound = bindNextjsPagesRouterOptimization(widenedMaybeConfig)
  widenedMaybeBound.OptimizationRoot({ buildPagePayload, routeKey: '/products' })
  // @ts-expect-error A maybe-undefined branch retains the conservative root contract.
  widenedMaybeBound.OptimizationRoot({})
  // @ts-expect-error A maybe-undefined branch cannot safely accept an eager page payload.
  widenedMaybeBound.OptimizationRoot({ initialPagePayload, routeKey: '/products' })
}

export function rejectInitialExperienceFromProviderAndAnalyticsProps(
  appComponents: NextjsAppClientComponents,
  pagesComponents: NextjsPagesRouterOptimization,
  providerProps: BoundNextjsOptimizationProviderProps,
  analyticsProps: BoundNextjsOptimizationAnalyticsRootProps,
): void {
  appComponents.OptimizationProvider({
    ...providerProps,
    // @ts-expect-error The client binder captures initial Experience outside provider props.
    initialExperience,
  })
  pagesComponents.OptimizationAnalyticsRoot({
    ...analyticsProps,
    // @ts-expect-error Analytics roots do not accept initial Experience.
    initialExperience,
  })
}

export function rejectInitialExperienceFromBoundRootProps(
  rootProps: BoundNextjsOptimizationRootProps,
): void {
  const boundRootProps: BoundNextjsOptimizationRootWithInitialExperienceProps = {
    ...rootProps,
    buildPagePayload,
    // @ts-expect-error The client binder captures initial Experience outside bound root props.
    initialExperience,
    routeKey: '/products',
  }
  const pagesBoundRootProps: PagesBoundNextjsOptimizationRootWithInitialExperienceProps = {
    ...rootProps,
    buildPagePayload,
    // @ts-expect-error Pages bound root props also exclude the captured callback.
    initialExperience,
    routeKey: '/products',
  }
  void [boundRootProps, pagesBoundRootProps]
}

export function rejectInitialExperienceFromServerAndSerializedBoundaries(
  presentExport: NextjsClientOptimizationConfigWithInitialExperience,
  handoff: ContentOptimizationHandoff,
): void {
  // @ts-expect-error App server binders reject callback-present client configuration variables.
  bindNextjsAppRouterServerOptimization(presentExport)
  // @ts-expect-error Pages server binders reject callback-present client configuration variables.
  bindNextjsPagesRouterServerOptimization(presentExport)
  const requestConfig: NextjsAppRouterServerOptimizationConfig = {
    ...clientBindingConfig,
    request: {
      // @ts-expect-error App request configuration does not accept initial Experience.
      initialExperience,
    },
  }
  const serializedHandoff: ContentOptimizationHandoff = {
    ...handoff,
    // @ts-expect-error Browser handoff shapes cannot carry callback functions.
    initialExperience,
  }
  void [requestConfig, serializedHandoff]
}

export function acceptAppRouterRequestClientRootComposition(
  config: NextjsAppRouterServerOptimizationConfig,
  ClientRequestOptimizationRoot: (
    props: BoundNextjsAppRouterRequestClientRootProps,
  ) => ReactElement,
): NextjsAppRouterServerOptimizationOptions {
  const options: NextjsAppRouterServerOptimizationOptions = {
    request: { OptimizationRoot: ClientRequestOptimizationRoot },
  }

  bindNextjsAppRouterServerOptimization(config, options)
  ClientRequestOptimizationRoot({
    children: null,
    defaults: { consent: true, persistenceConsent: false },
    handoff: undefined,
    hydration: 'preserve-server',
  })

  return options
}

export function rejectAppRouterRequestClientRootOwnedInputs(
  props: BoundNextjsAppRouterRequestClientRootProps,
): void {
  const withCallback: BoundNextjsAppRouterRequestClientRootProps = {
    ...props,
    // @ts-expect-error The client binder captures initial Experience outside Flight props.
    initialExperience,
  }
  const withRoute: BoundNextjsAppRouterRequestClientRootProps = {
    ...props,
    // @ts-expect-error The request client root derives its route in the browser.
    routeKey: '/products',
  }
  const withPayloadBuilder: BoundNextjsAppRouterRequestClientRootProps = {
    ...props,
    // @ts-expect-error The request client root derives its lazy payload builder in the browser.
    buildPagePayload,
  }
  void [withCallback, withRoute, withPayloadBuilder]
}

export function rejectInvalidAppRouterRequestClientRootReference(
  config: NextjsAppRouterServerOptimizationConfig,
): void {
  const InvalidRequestRoot = (_props: {
    readonly initialExperience: InitialExperienceOptions
  }): ReactElement => {
    throw new Error('type-only invalid request root')
  }

  bindNextjsAppRouterServerOptimization(config, {
    request: {
      // @ts-expect-error Request root references must accept only the serializable request props.
      OptimizationRoot: InvalidRequestRoot,
    },
  })
}

describe('Next.js runtime type contracts', () => {
  it('keeps client and server runtimes distinct', () => {
    expect(true).toBe(true)
  })
})
