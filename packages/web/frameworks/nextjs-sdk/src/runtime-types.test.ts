import type NodeContentfulOptimization from '@contentful/optimization-node'
import type { ResolvedData } from '@contentful/optimization-node/core-sdk'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import type {
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  NextjsOptimizationComponents as NextjsAppClientComponents,
  NextjsBoundOptimizedEntryProps,
} from './app-router-client'
import type { NextjsOptimizationComponents as NextjsAppServerComponents } from './app-router-server'
import type {
  OptimizationSdk,
  OptimizationWebRuntime,
  OptimizedEntryProps,
  OptimizedEntryRenderContext,
} from './client'
import type { NextjsPagesRouterOptimization } from './pages-router'
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

describe('Next.js runtime type contracts', () => {
  it('keeps client and server runtimes distinct', () => {
    expect(true).toBe(true)
  })
})
