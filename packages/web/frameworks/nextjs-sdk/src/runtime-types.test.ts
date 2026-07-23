import type NodeContentfulOptimization from '@contentful/optimization-node'
import type {
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  NextjsOptimizationComponents as NextjsAppClientComponents,
  NextjsBoundOptimizedEntryProps,
} from './app-router-client'
import type { NextjsOptimizationComponents as NextjsAppServerComponents } from './app-router-server'
import type { OptimizationSdk, OptimizationWebRuntime, OptimizedEntryProps } from './client'
import type { NextjsPagesRouterOptimization } from './pages-router'
import type { ContentfulOptimization as NextjsServerOptimization } from './server'

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
