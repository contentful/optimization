# React Web (`@contentful/optimization-react-web`) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-react-web-sdk-in-a-react-app.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer verified against
> packages/\*\*/src.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only React-Web specifics.
Wraps the lower-level `@contentful/optimization-web` browser SDK in React providers/hooks/component.
Package source root: `packages/web/frameworks/react-web-sdk/src`; underlying Web SDK:
`packages/web/web-sdk/src`; shared core: `packages/universal/core-sdk/src`.

## Package & entry points

| Import path                                              | Purpose                                                                                                                                                                                      | source                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-react-web`                     | `OptimizationRoot`, `OptimizationProvider`, `LiveUpdatesProvider`, `OptimizedEntry`, all hooks                                                                                               | react-web-sdk#root/OptimizationRoot.tsx#OptimizationRoot; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry                                                                                     |
| `@contentful/optimization-react-web/react-router`        | Context-bound React Web runtime plus `ReactRouterAutoPageTracker`                                                                                                                            | react-web-sdk#react-router-facade.ts; react-web-sdk#router/react-router.tsx#ReactRouterAutoPageTracker                                                                                                                                                                                                                                                  |
| `@contentful/optimization-react-web/tanstack-router`     | Context-bound React Web runtime plus `TanStackRouterAutoPageTracker`                                                                                                                         | react-web-sdk#tanstack-router.ts; react-web-sdk#router/tanstack-router.tsx#TanStackRouterAutoPageTracker                                                                                                                                                                                                                                                |
| `@contentful/optimization-react-web/next-pages`          | Context-bound React Web runtime plus `NextPagesAutoPageTracker`                                                                                                                              | react-web-sdk#next-pages.ts; react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker                                                                                                                                                                                                                                                               |
| `@contentful/optimization-react-web/next-app`            | Context-bound React Web runtime plus `NextAppAutoPageTracker`                                                                                                                                | react-web-sdk#next-app.ts; react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker                                                                                                                                                                                                                                                                     |
| `@contentful/optimization-react-web/api-schemas`         | Type guards `isMergeTagEntry`, `isRichTextDocument`                                                                                                                                          | react-web-sdk#api-schemas.ts; api-schemas#contentful/typeGuards.ts#isMergeTagEntry; api-schemas#contentful/typeGuards.ts#isRichTextDocument                                                                                                                                                                                                             |
| `@contentful/optimization-core/entry-source`             | Framework-adapter primitives for managed fetch: `prefetchManagedEntries`, `createOptimizedEntryLoadingEntry`, `getOptimizedEntrySourceKey`, `OptimizedEntrySourceController` + handoff types | core-sdk#entry-source.ts; core-sdk#OptimizedEntrySourceController.ts#prefetchManagedEntries; core-sdk#OptimizedEntrySourceController.ts#createOptimizedEntryLoadingEntry; core-sdk#managed-entry-key.ts#getOptimizedEntrySourceKey; core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceController; core-sdk#CoreBase.ts#ManagedEntryHandoff |
| `@contentful/optimization-react-web/handoff`             | Pass-through Web handoff types and content hydration helper                                                                                                                                  | react-web-sdk#handoff.ts; web-sdk#handoff.ts#BrowserOptimizationHandoff; web-sdk#handoff.ts#hydrateOptimizationHandoff                                                                                                                                                                                                                                  |
| `@contentful/optimization-react-web/analytics`           | Pass-through analytics-only Web runtime helpers                                                                                                                                              | react-web-sdk#analytics.ts; web-sdk#analytics.ts#initializeOptimizationAnalyticsRuntime; web-sdk#analytics.ts#hydrateOptimizationAnalyticsHandoff                                                                                                                                                                                                       |
| `@contentful/optimization-react-web/tracking-attributes` | Pass-through server/static tracking-attribute resolver                                                                                                                                       | react-web-sdk#tracking-attributes.ts; web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes                                                                                                                                                                                                                  |
| `@contentful/optimization-react-web/logger`              | `createScopedLogger`                                                                                                                                                                         | react-web-sdk#logger.ts; api-client#lib/logger/Logger.ts#createScopedLogger                                                                                                                                                                                                                                                                             |

## Setup / initialization and binding

- Each router-integrated facade owns the generic context-bound runtime plus exactly its matching
  auto-page tracker. Keep roots, providers, components, hooks, contexts, and the tracker for one
  router tree on that single facade so they share one bundled React context identity. Support
  helpers and type-only imports do not create context identity and may use their dedicated paths.
  source: react-web-sdk#react-router-facade.ts; react-web-sdk#tanstack-router.ts; react-web-sdk#next-pages.ts; react-web-sdk#next-app.ts
- `prefetchManagedEntries(runtime, sources)` is context-free: it delegates through the explicit
  runtime argument and does not read React context. It is safe to import through any integrated
  facade or the dedicated entry-source support path without determining context identity.
  source: react-web-sdk#react-router-facade.ts; react-web-sdk#tanstack-router.ts; react-web-sdk#next-pages.ts; react-web-sdk#next-app.ts; react-web-sdk#server-optimized-entries.ts; core-sdk#OptimizedEntrySourceController.ts#prefetchManagedEntries
- Configure by passing props directly to `OptimizationRoot`; mount it exactly once around the subtree
  that uses the SDK. It composes `OptimizationProvider` + `LiveUpdatesProvider`, creates the Web SDK
  instance after React commits, and destroys it on unmount.
  source: react-web-sdk#root/OptimizationRoot.tsx#OptimizationRoot
- `OptimizationRootProps` extends `OptimizationProviderConfigProps` and adds `liveUpdates`,
  `routeKey`, `buildPagePayload`, and `initialPagePayload`.
  source: react-web-sdk#root/OptimizationRoot.tsx#OptimizationRootProps
  - `clientId`, `environment`, `fetchOptions?` — `CoreConfig` via `api-client` `ApiConfig`.
    source: core-sdk#CoreBase.ts#CoreConfig; api-client#ApiClientBase.ts#ApiConfig
  - `locale`, `logLevel?` — `core-sdk` `CoreConfig`.
    source: core-sdk#CoreBase.ts#CoreConfig
  - `defaults` (`consent`, `persistenceConsent`), `api?`, `allowedEventTypes?`, `onEventBlocked?`,
    `queuePolicy?` — `core-sdk` `CoreStatefulConfig`. `api` = `experienceBaseUrl`,
    `insightsBaseUrl` — `core-sdk` `CoreSharedApiConfig`.
    source: core-sdk#CoreStateful.ts#CoreStatefulConfig; core-sdk#StatefulDefaults.ts#StatefulDefaults; core-sdk#CoreApiConfig.ts#CoreSharedApiConfig
  - `app` (`name`, `version`), `cookie?` (`domain`, `expires` days) — `web-sdk`
    `OptimizationWebConfig`; `web-sdk` `CookieAttributes`.
    source: web-sdk#ContentfulOptimization.ts#OptimizationWebConfig; web-sdk#lib/cookies.ts#CookieAttributes
  - `trackEntryInteraction?`, `onStatesReady?`, `handoff?`, `hydration?`.
    source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProviderConfigProps; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationHandoffProps
  - **Managed entry fetching:** the component and hook surfaces inherit the shared opt-in behavior
    through the app-owned Contentful client: flat `entryId` + `entryQuery`, or an ID/slug object
    descriptor under `managedEntry`; see
    [`../shared/concepts.md`](../shared/concepts.md#entry-source-boundary-managed-or-manual).
    Prop-surface chain: `CoreConfig.contentful` →
    `CoreStatefulConfig` → `OptimizationWebConfig` → `OptimizationRootSdkConfig` →
    `OptimizationProviderConfigProps` → `OptimizationRootProps`.
    source: core-sdk#CoreBase.ts#ContentfulConfig; core-sdk#CoreBase.ts#ContentfulEntryClient; core-sdk#CoreBase.ts#ContentfulEntryQuery; core-sdk#CoreBase.ts#CoreConfig; core-sdk#CoreBase.ts#fetchContentfulEntry; core-sdk#CoreBase.ts#fetchOptimizedEntry; core-sdk#CoreBase.ts#clearContentfulEntryCache
  - **`handoff.entries?: readonly ManagedEntryHandoff[]` (server/static/edge handoff):** seeds
    baseline entries produced before browser startup so matching managed ID or slug sources render
    without a client round-trip. Slug handoffs are indexed under both their lookup descriptor and
    resolved `sys.id`, so default and explicit `slug` field descriptors match the same snapshot.
    source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationHandoffProps; react-web-sdk#provider/OptimizationProvider.tsx#createPrefetchedManagedEntries; react-web-sdk#server-optimized-entries.ts; core-sdk#CoreBase.ts#ManagedEntryHandoff
  - **`prefetchManagedEntries?: readonly ManagedEntryDescriptor[]` (client cache warming):** after
    the live SDK is ready, the provider calls `runtime.prefetchManagedEntries(descriptors)` to warm
    the configured managed-entry cache.
    source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationHandoffProps; core-sdk#CoreBase.ts#ManagedEntryDescriptor; core-sdk#OptimizedEntrySourceController.ts#ManagedEntryPrefetchRuntime
- `OptimizationProvider` publishes content handoff hydration mode through React context; its
  `hydration` prop overrides `handoff.hydration` before optimized entries consume the handoff.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#context/OptimizationHydrationContext.tsx#OptimizationHydrationContext
- Mount once. A second **owned** instance in the same browser runtime throws
  `ContentfulOptimization is already initialized`.
  source: web-sdk#ContentfulOptimization.ts#ContentfulOptimization
- Analytics-only root: `OptimizationAnalyticsRoot` initializes a narrow analytics runtime after
  commit, hydrates an analytics-only handoff in a layout effect, emits or skips the initial route
  through the handoff's `initialPageEvent`, and renders children without providing content
  resolution context. A skipped initial route remains skipped across React StrictMode effect replay;
  after the route key changes, later hydrations emit route changes through the analytics runtime.
  Unmounts and newer analytics or content hydrations cancel in-flight analytics hydration before it
  can apply state, warn, build the page payload, or track the page.
  source: react-web-sdk#root/OptimizationAnalyticsRoot.tsx#OptimizationAnalyticsRoot; react-web-sdk#root/OptimizationAnalyticsRoot.tsx#initializeAnalyticsRuntime; web-sdk#analytics.ts#initializeOptimizationAnalyticsRuntime; web-sdk#analytics.ts#hydrateOptimizationAnalyticsHandoff; web-sdk#handoff-internal.ts#hydrateOptimizationHandoffStateInternal; web-sdk#handoff-internal.ts#isCurrentHydration
- First-render runtime depends on SDK ownership and handoff presence, not on `onStatesReady`: an
  owned/config provider starts with a snapshot while it creates the live SDK after commit; an
  injected provider with no handoff uses that live SDK from the first render; and an injected
  provider with a handoff starts from the handoff snapshot, then hydrates the injected live SDK after
  commit. `onStatesReady` runs during live setup—after handoff hydration when present—before a
  snapshot-backed path publishes the live runtime and before child effects emit. On an injected,
  no-handoff path, adding `onStatesReady` runs that callback after commit without replacing the live
  first-render context.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/OptimizationProvider.tsx#createInitialRuntime; react-web-sdk#provider/OptimizationProvider.tsx#injectedSdkBacksInitialRender; react-web-sdk#provider/OptimizationProvider.tsx#canUseInjectedSdkDuringInitialRender; react-web-sdk#provider/OptimizationProvider.tsx#getOnStatesReadyCleanup; react-web-sdk#provider/OptimizationProvider.tsx#hydrateProviderHandoff; web-sdk#presentation/optimizationRootRuntime.ts#createOptimizationRootSdkBinding; react-web-sdk#provider/OptimizationProvider.onStatesReady.test.tsx
- Initial committed setup owns one effect-local SDK binding and hydration-currentness guard. React
  Strict Mode cleanup disposes the first owned binding before the replayed setup owns the runtime;
  unmount cancels in-flight hydration and disposes an owned binding exactly once. An injected
  binding is never destroyed by provider cleanup, but its in-flight hydration is still cancelled.
  For an in-flight initial handoff, `onStatesReady` runs only for the surviving setup after
  hydration.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/OptimizationProvider.tsx#createProviderSdkBinding; react-web-sdk#provider/OptimizationProvider.tsx#hydrateProviderHandoff; web-sdk#presentation/optimizationRootRuntime.ts#disposeOptimizationRootSdkBinding

## Components & hooks

| Name                                                | Kind      | Import path                         | Key props/args                                                                                                                                               | Returns                                                                                                                                                                                                                                                                                                    | source                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | --------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OptimizationRoot`                                  | component | root                                | config props above; `handoff?`; `hydration?`; `routeKey?`; `buildPagePayload?`; `initialPagePayload?`; `liveUpdates?`; `prefetchManagedEntries?`; `children` | element                                                                                                                                                                                                                                                                                                    | react-web-sdk#root/OptimizationRoot.tsx#OptimizationRoot; react-web-sdk#root/OptimizationRoot.tsx#OptimizationRootProps; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationHandoffProps                                                                           |
| `OptimizationAnalyticsRoot`                         | component | root                                | analytics-only `handoff`; `routeKey`; `buildPagePayload`; `children`                                                                                         | element                                                                                                                                                                                                                                                                                                    | react-web-sdk#root/OptimizationAnalyticsRoot.tsx#OptimizationAnalyticsRoot; react-web-sdk#root/OptimizationAnalyticsRoot.tsx#OptimizationAnalyticsRootProps                                                                                                                 |
| `OptimizationProvider`                              | provider  | root                                | `sdk={optimization}` (injected) OR config; `onStatesReady?`, `handoff?`, `hydration?`, `prefetchManagedEntries?`                                             | always renders children                                                                                                                                                                                                                                                                                    | react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationHandoffProps                                                                                                                              |
| `LiveUpdatesProvider`                               | provider  | root                                | optional for entry surfaces; required for public `useLiveUpdates`                                                                                            | element                                                                                                                                                                                                                                                                                                    | react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider; react-web-sdk#hooks/useLiveUpdates.ts#useLiveUpdates                                                                                                                                                    |
| `OptimizedEntry`                                    | component | root                                | Manual `baselineEntry`, flat `entryId` + `entryQuery`, or object descriptor under `managedEntry`                                                             | element or `null`                                                                                                                                                                                                                                                                                          | react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntrySourceProps                                                                                                                                 |
| `ReactRouterAutoPageTracker`                        | component | `/react-router`                     | `getPagePayload?`, `pagePayload?` (no `initialPageEvent`)                                                                                                    | `null`                                                                                                                                                                                                                                                                                                     | react-web-sdk#react-router-facade.ts; react-web-sdk#router/react-router.tsx#ReactRouterAutoPageTracker                                                                                                                                                                      |
| `TanStackRouterAutoPageTracker`                     | component | `/tanstack-router`                  | `getPagePayload?`, `pagePayload?` (no `initialPageEvent`)                                                                                                    | `null`                                                                                                                                                                                                                                                                                                     | react-web-sdk#tanstack-router.ts; react-web-sdk#router/tanstack-router.tsx#TanStackRouterAutoPageTracker                                                                                                                                                                    |
| next-pages / next-app tracker                       | component | `/next-pages` or `/next-app`        | also accept `initialPageEvent`                                                                                                                               | `null`                                                                                                                                                                                                                                                                                                     | react-web-sdk#next-pages.ts; react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker; react-web-sdk#next-app.ts; react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker                                                                                              |
| `useOptimizationContext`                            | hook      | root                                | —                                                                                                                                                            | `{ sdk, error }` (`sdk` seeded, defined from 1st render; `error` on init fail)                                                                                                                                                                                                                             | react-web-sdk#hooks/useOptimization.ts#useOptimizationContext; react-web-sdk#context/OptimizationContext.tsx#OptimizationContextValue                                                                                                                                       |
| `useOptimization`                                   | hook      | root                                | —                                                                                                                                                            | SDK instance; **throws** if unavailable / no provider                                                                                                                                                                                                                                                      | react-web-sdk#hooks/useOptimization.ts#useOptimization                                                                                                                                                                                                                      |
| `useOptimizedEntry`                                 | hook      | root                                | Same `baselineEntry`, flat ID, or `managedEntry` object-descriptor source model                                                                              | `{ canOptimize, baselineEntry, entry, error, isLoading, isPresentationReady, isResolved, metadata, resolvedData, selectedOptimization, selectedOptimizations }` (`error` is `Error \| undefined`; `entry`/`baselineEntry`/`metadata`/`selectedOptimization(s)` `undefined` while managed fetch unresolved) | react-web-sdk#optimized-entry/useOptimizedEntry.ts#useOptimizedEntry; react-web-sdk#optimized-entry/useOptimizedEntry.ts#UseOptimizedEntryResult                                                                                                                            |
| `prefetchManagedEntries`                            | function  | any runtime facade / `entry-source` | Context-free managed entry prefetch                                                                                                                          | Handoffs retain their normalized source and baseline; slug handoffs use the fetched `sys.id`                                                                                                                                                                                                               | react-web-sdk#server-optimized-entries.ts; core-sdk#OptimizedEntrySourceController.ts#prefetchManagedEntries; core-sdk#OptimizedEntrySourceController.ts#ManagedEntryPrefetchRuntime; core-sdk#CoreBase.ts#ManagedEntryDescriptor; core-sdk#CoreBase.ts#ManagedEntryHandoff |
| `useConsentState`                                   | hook      | root                                | —                                                                                                                                                            | `boolean` or `undefined`                                                                                                                                                                                                                                                                                   | react-web-sdk#hooks/useConsentState.ts#useConsentState                                                                                                                                                                                                                      |
| `useEventStreamState`                               | hook      | root                                | —                                                                                                                                                            | latest accepted event payload or `undefined`; a current value, not an observable                                                                                                                                                                                                                           | react-web-sdk#hooks/useOptimizationState.ts#useEventStreamState                                                                                                                                                                                                             |
| `useProfileState` / `useSelectedOptimizationsState` | hook      | root                                | —                                                                                                                                                            | profile (`id`, `traits`) / selected optimizations                                                                                                                                                                                                                                                          | react-web-sdk#hooks/useOptimizationState.ts#useProfileState; react-web-sdk#hooks/useOptimizationState.ts#useSelectedOptimizationsState                                                                                                                                      |
| `useOptimizationActions`                            | hook      | root                                | —                                                                                                                                                            | `{ setConsent, flushEvents, identifyUser, trackPageView, resetUser, trackScreen, trackEvent }` (each bound to the SDK method named in its type: `consent`/`flush`/`identify`/`page`/`reset`/`screen`/`track`)                                                                                              | react-web-sdk#hooks/useOptimizationActions.ts#useOptimizationActions; react-web-sdk#hooks/useOptimizationActions.ts#UseOptimizationActionsResult                                                                                                                            |
| `useMergeTagResolver`                               | hook      | root                                | —                                                                                                                                                            | `{ getMergeTagValue }`                                                                                                                                                                                                                                                                                     | react-web-sdk#hooks/useMergeTagResolver.ts#useMergeTagResolver; react-web-sdk#hooks/useMergeTagResolver.ts#UseMergeTagResolverResult                                                                                                                                        |

Note: `useOptimizationContext` is safe during render (returns the seeded snapshot runtime, whose
actions are inert until live and whose `trackCurrentPage()` returns a rejected result with reason
`not-allowed`);
`useOptimization` throws only on init failure / missing provider, so it is safe during render too,
but is framed for post-mount code (handlers/effects).
source: core-sdk#runtime/SnapshotRuntime.ts#SnapshotRuntime; core-sdk#runtime/SnapshotRuntime.ts#createSnapshotRuntime; web-sdk#runtime.ts#createWebSnapshotRuntime

The provider's seeded snapshot runtime and later live SDK share the fallback-only merge-tag
resolution. `useMergeTagResolver` and the `OptimizedEntry` render context continue to resolve
merge tags through their profile-backed callbacks. See
[`../shared/concepts.md`](../shared/concepts.md#entry-resolution).
source: core-sdk#runtime/OptimizationRuntime.ts#OptimizationRuntime; core-sdk#runtime/SnapshotRuntime.ts#getMergeTagFallbackValue; web-sdk#runtime.ts#createWebSnapshotRuntime; react-web-sdk#hooks/useMergeTagResolver.ts#useMergeTagResolver; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry

`OptimizedEntry` and `useOptimizedEntry` work under a standalone `OptimizationProvider` without a
`LiveUpdatesProvider`: root live updates and preview visibility default off, while per-entry
`liveUpdates` still applies. Calling public `useLiveUpdates` without its provider throws.
source: react-web-sdk#optimized-entry/useOptimizedEntry.ts#useOptimizedEntrySnapshot; react-web-sdk#hooks/useOptimizationRuntime.ts#useOptimizationRuntime; react-web-sdk#hooks/useLiveUpdates.ts#useLiveUpdates

## Render / entry resolution

- **Entry source (managed or manual):** `OptimizedEntry` / `useOptimizedEntry` use `baselineEntry`
  for an app-fetched entry, use `entryId` + `entryQuery` for the flat managed ID path, and put
  object descriptors under `managedEntry`. A slug descriptor's field defaults to `slug`; changing
  any lookup part refetches, while stale results are ignored. Managed fetch requires
  `contentful: { client }` on the root; without it the managed path has no client. Successful
  metadata, callbacks, and tracking use the fetched entry's `sys.id` rather than its lookup slug.
  `errorFallback` / `onEntryError` handle either managed lookup failure. See
  [`../shared/concepts.md`](../shared/concepts.md#entry-source-boundary-managed-or-manual).
  source: react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntrySourceProps; react-web-sdk#optimized-entry/useOptimizedEntry.ts#UseOptimizedEntryParams; core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceController; concept:entry-personalization-and-variant-resolution
- `OptimizedEntry` and `useOptimizedEntry` carry one caller-supplied skeleton set through hook state,
  metadata, render props, and resolution callbacks; baseline and resolved metadata entries use that
  same set. The set does not affect runtime variant choice. Shared modeling and narrowing behavior:
  see
  [`../shared/concepts.md`](../shared/concepts.md#entry-resolution).
  source: react-web-sdk#optimized-entry/optimizedEntryUtils.ts#RenderProp; react-web-sdk#optimized-entry/useOptimizedEntry.ts#UseOptimizedEntryResult; core-sdk#OptimizedEntryMetadata.ts#OptimizedEntryMetadata; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry
- `OptimizedEntry` keeps its host and tracking attributes for an empty result but does not invoke or
  render its consumer children. An absent empty-variant flag renders normally.
  source: react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry
- `useEntryResolver().resolveEntry()` returns only the entry, so an empty result is indistinguishable
  from its retained baseline entry. Manual render decisions use `resolveEntryData()` or
  `resolveOptimizedEntry()` and inspect the full result.
  source: react-web-sdk#hooks/useEntryResolver.ts#useEntryResolver
- **Loading and presentation model:** snapshot state readiness and live presentation readiness are
  independent. A snapshot runtime can resolve a handoff selection, but default
  `client-only-hidden-until-ready` hydration keeps optimized content in a hidden layout target until
  the runtime is live; content without optimization references is presentation-ready immediately.
  The **5s** baseline reveal timer (`BASELINE_REVEAL_TIMEOUT_MS = 5000`) covers both unresolved state
  and settled-but-presentation-pending content; `loadingFallback` shows custom UI before the baseline
  reveal. `preserve-server` hydration suppresses loading fallback, baseline-while-loading, and hidden
  layout target behavior, leaving snapshot-resolved server content visible.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#optimized-entry/useOptimizedEntry.ts#useOptimizedEntrySnapshot; react-web-sdk#hooks/useOptimizationRuntime.ts#useOptimizationRuntime; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry; web-sdk#presentation/OptimizedEntryController.ts#BASELINE_REVEAL_TIMEOUT_MS; web-sdk#presentation/OptimizedEntryController.ts#OptimizedEntryController; web-sdk#presentation/OptimizedEntryLoadingPresentation.ts#resolveLoadingPresentation
- Every shared auto-page tracker starts internal route-scoped presentation state before emitting.
  The provider follows the shared one-object-per-occurrence handoff contract. While its route or
  handoff is pending, `OptimizedEntry`, `useOptimizedEntry`,
  and the component's render-context merge tags use that route snapshot, while managed baseline
  fetching and the public `useEntryResolver` / `useMergeTagResolver` hooks continue through the live
  SDK. During render, a retained entry controller masks an unsynchronized baseline, presentation
  readiness, or runtime with a pending baseline that does not consult SDK state, then synchronizes
  the retained controller in layout. It therefore cannot commit prior selected content; a configured
  loading fallback is visible in that transition render. A handoff-backed snapshot delays auto-page
  emission until live hydration completes. Same-key
  in-flight replays, including Strict Mode effects, join the singleton-owned page attempt instead of
  settling independently. Only terminal success for an emitted Experience response establishes
  live presentation authority. Initial-page skip and response-less `already-accepted` results
  satisfy tracking without establishing it. A `not-allowed` result settles the route to fallback.
  The mounted tracker does not retry on reconnect, but it recognizes an accepted explicit
  same-route retry only while Core retains the same route key and generation. Consent changes can
  also cause the mounted effect to retry the same route. Both paths promote fallback only after the
  current Experience request becomes terminal: success satisfies the route, while failure or
  invalidation keeps fallback. A newer route or generation, effect cleanup, or a `superseded` result
  prevents stale settlement. Remounting a settled route's tracker does not reopen a pending
  transition. A `public-permutation` or `static` handoff remains locked presentation after
  settlement. Successful hydration establishes live authority for a private handoff; a successful
  emitted response establishes it for private and no-handoff routes. Otherwise fallback keeps the
  route handoff, or an empty baseline-safe snapshot without one.
  A successfully hydrated private handoff remains available as dormant fallback data until route
  settlement, so failed page tracking can reactivate its server selection. A no-handoff route while
  tracking is pending or failed, and a failed handoff hydration, retain their snapshot even under
  live-update or preview overrides. After authority exists, those overrides may select the live SDK.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationHandoffProps; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#context/OptimizationRouteTransitionContext.tsx#OptimizationRouteTransitionContext; react-web-sdk#auto-page/useAutoPageEmitter.ts#useAutoPageEmitter; web-sdk#ContentfulOptimization.ts#TrackCurrentPageResult; web-sdk#ContentfulOptimization.ts#trackCurrentPage; core-sdk#tracking/CurrentStateCoordinator.ts#CurrentStateCoordinator; core-sdk#queues/ExperienceQueue.ts#ExperienceQueue; react-web-sdk#hooks/useOptimizationRuntime.ts#useOptimizationRuntime; react-web-sdk#hooks/useEntryResolver.ts#useEntryResolver; react-web-sdk#hooks/useMergeTagResolver.ts#useMergeTagResolver; react-web-sdk#optimized-entry/useOptimizedEntry.ts#useManagedBaselineEntry; react-web-sdk#optimized-entry/useOptimizedEntry.ts#useOptimizedEntrySnapshot; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry; kb:shared/concepts.md
- A later handoff hydration failure records the error, retains the current handoff snapshot, marks
  that handoff settled, keeps its snapshot authoritative under live-update and preview overrides,
  and unblocks page tracking instead of leaving presentation pending. The
  provider passes a mount-currentness guard to handoff hydration, so a superseded or unmounted
  completion neither applies singleton state nor terminalizes provider presentation. This differs
  from initial SDK initialization failure, which remains fatal to the provider subtree.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; web-sdk#handoff.ts#OptimizationHandoffHydrationOptions; web-sdk#handoff.ts#OptimizationHandoffHydrationTarget; web-sdk#handoff.ts#hydrateOptimizationHandoff; web-sdk#handoff-internal.ts#isCurrentHydration
- Removing a provider handoff replaces a retained handoff-backed route presentation with an empty,
  settled snapshot and clears the settled handoff. A later route occurrence supplies a fresh
  handoff object.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationHandoffProps
- **Double-wrap:** nested `OptimizedEntry` sharing a baseline id returns `null` + dev-only warning
  (gated `NODE_ENV !== 'production'`); different baseline ids are fine.
  source: react-web-sdk#optimized-entry/OptimizedEntry.tsx#useDuplicateBaselineGuard; web-sdk#presentation/OptimizedEntryController.ts#resolveOptimizedEntryNestingState
- **Host element:** wraps in a layout-neutral element, `display: contents` by default
  (`OPTIMIZED_ENTRY_HOST_DISPLAY = 'contents'`); `as` accepts only `'div'`/`'span'` (default
  `'div'`). Plain-node children still emit tracking attributes.
  source: react-web-sdk#optimized-entry/optimizedEntryUtils.ts#WrapperElement; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry; web-sdk#presentation/OptimizedEntryController.ts#OPTIMIZED_ENTRY_HOST_DISPLAY

## Identifier ownership

| Identifier                              | Owner  | Notes                                                                                              | source                                                                                                                               |
| --------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ctfl-opt-aid` (profile/anon-id cookie) | SDK    | Browser-readable; the one persistence value the SDK owns                                           | core-sdk#constants.ts#ANONYMOUS_ID_COOKIE; web-sdk#ContentfulOptimization.ts#ContentfulOptimization                                  |
| app consent cookie/record               | reader | Reader names/writes/reads; SDK only reflects what you pass to `setConsent`                         | concept:consent-management-in-the-optimization-sdk-suite; react-web-sdk#hooks/useOptimizationActions.ts#UseOptimizationActionsResult |
| browser env vars (`PUBLIC_*` / bundler) | reader | Match the bundler's browser-var convention (Vite `import.meta.env`, CRA `process.env.REACT_APP_*`) | extern:bundler exposes only its prefixed vars to the browser (Vite import.meta.env, CRA process.env.REACT*APP*\*)                    |

## Events & tracking

- Page events: auto-page trackers emit on navigation; each dedupes consecutive accepted route keys.
  Strict Mode replays of a pending route join its single SDK-owned attempt, and superseded or
  unmounted completions do not settle the active route. Automatic current-page tracking is
  online-only: an offline attempt is neither published nor enqueued, and the tracker does not retry
  it on reconnect. Retry the current route explicitly after reconnecting. Ordinary event methods
  still queue offline. Mount one tracker per router tree and import it with the tree's other
  context-bound runtime values from the matching integrated facade. React Router / TanStack trackers
  do not take `initialPageEvent`; only next-pages / next-app trackers do.
  source: react-web-sdk#react-router-facade.ts; react-web-sdk#tanstack-router.ts; react-web-sdk#next-pages.ts; react-web-sdk#next-app.ts; react-web-sdk#router/react-router.tsx#ReactRouterAutoPageTracker; react-web-sdk#router/tanstack-router.tsx#TanStackRouterAutoPageTracker; react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker; react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker; react-web-sdk#auto-page/useAutoPageEmitter.ts#useAutoPageEmitter; web-sdk#ContentfulOptimization.ts#trackCurrentPage
- Initial page event is auto-emitted on mount, not only on navigation: the shared emitter
  `useAutoPageEmitter` defaults `initialPageEvent` to `'emit'` and calls `sdk.trackCurrentPage()` in a
  mount effect, so the first route emits its `page` event as soon as the tracker mounts. Trackers that
  do not expose `initialPageEvent` (React Router / TanStack) always emit the initial page; only the
  next-pages / next-app trackers can pass `'skip'` to suppress it. With the `['identify','page']`
  pre-consent allow-list this initial `page` is admitted before any explicit consent call.
  source: react-web-sdk#auto-page/useAutoPageEmitter.ts#useAutoPageEmitter; kb:shared/concepts.md
- `OptimizationRoot` emits a handoff-owned initial page event only when it has a route key and either
  `buildPagePayload` or `initialPagePayload`. For `initialPageEvent: 'skip'`, it can mark the
  initial route accepted with the initial route key even without a payload builder. If
  `initialPageEvent: 'emit'` lacks a route key or page payload source, it warns and skips browser
  emission.
  source: react-web-sdk#root/OptimizationRoot.tsx#resolveInitialPageEmitterProps; react-web-sdk#root/OptimizationRoot.tsx#shouldWarnMissingInitialPagePayload; react-web-sdk#root/OptimizationRoot.tsx#MissingInitialPagePayloadWarning; react-web-sdk#auto-page/useAutoPageEmitter.ts#useAutoPageEmitter
- `getPagePayload` receives `{ context, routeKey, isInitialEmission }`; React Router `context` has
  `pathname`. It returns `AutoPagePayload | undefined`, the argument shape accepted by `sdk.page()`.
  Put application-specific route values under `properties` rather than returning arbitrary
  top-level keys. Payload layers compose in order: router-derived → static `pagePayload` → dynamic
  `getPagePayload`. Each layer deep-merges over the previous one for nested record values; later
  non-record values replace earlier values, and `undefined` layers are skipped.
  source: react-web-sdk#auto-page/types.ts#AutoPageEmissionContext; react-web-sdk#auto-page/types.ts#AutoPagePayloadOptions; react-web-sdk#router/react-router.tsx#ReactRouterAutoPageContext; react-web-sdk#auto-page/pagePayload.ts#buildAutoPagePayload; core-sdk#events/EventBuilder.ts#PageViewBuilderArgs
- Interaction tracking (views/clicks/hovers): on by default with `OptimizedEntry`; opt out per-type
  via `OptimizationRoot` `trackEntryInteraction`; per-entry props `clickable`/`trackViews`/
  `trackClicks`/`trackHovers` + duration props; uses RESOLVED entry id. Manual DOM:
  `sdk.tracking.enableElement('views', el, { data })` / `clearElement`.
  source: web-sdk#entry-tracking/EntryInteractionRuntime.ts#EntryInteractionRuntime; web-sdk#entry-tracking/resolveAutoTrackEntryInteractionOptions.ts#EntryInteractionApi; web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes
- Automatic interaction detectors run only while the corresponding event method is allowed by
  consent/`allowedEventTypes`. Insights delivery also requires a current Optimization profile; when
  no profile exists, the queue warns and drops the interaction instead of emitting it. Therefore a
  missing view/click/hover can mean consent policy, a root/per-entry opt-out, missing tracking
  attributes, or missing profile continuity.
  source: web-sdk#entry-tracking/EntryInteractionRuntime.ts#reconcileInteraction; web-sdk#entry-tracking/EntryInteractionRuntime.ts#isInteractionAllowed; core-sdk#queues/InsightsQueue.ts#send
- Flags: `getFlag(name)` nonreactive reads and `states.flag(name)` reactive reads auto-attempt
  flag-view tracking; explicit/manual replacement is `trackFlagView()` on the live `sdk`. See
  [`../shared/concepts.md`](../shared/concepts.md#custom-flag-views).
  source: core-sdk#CoreStatefulEventEmitter.ts#getFlag; core-sdk#CoreStatefulEventEmitter.ts#getFlagObservable; core-sdk#CoreStatefulEventEmitter.ts#trackFlagView; react-web-sdk#hooks/useOptimization.ts#useOptimizationContext
- Analytics forwarding: subscribe to the live `sdk.states.eventStream` for accepted events and
  `sdk.states.blockedEventStream` for consent-blocked diagnostics; dedupe accepted events by
  `messageId` and clean up subscriptions with `.unsubscribe()`. See
  [`../shared/concepts.md`](../shared/concepts.md#stateful-event-forwarding-streams).
  source: core-sdk#CoreStateful.ts#CoreStates; core-sdk#events/OptimizationEventStreamEvent.ts#OptimizationEventStreamEvent; core-sdk#events/BlockedEvent.ts#BlockedEvent; core-sdk#signals/Observable.ts#Subscription; react-web-sdk#hooks/useOptimization.ts#useOptimizationContext; kb:shared/concepts.md
- `useEventStreamState()` subscribes internally and returns only the latest accepted event payload;
  it has no `.subscribe()` method. Code that needs accepted and blocked diagnostics or forwarding
  subscriptions must obtain a guarded live `sdk` from `useOptimizationContext()`, then subscribe to
  `sdk.states.eventStream` and `sdk.states.blockedEventStream` with cleanup. There is no
  `useBlockedEventStreamState` hook.
  source: react-web-sdk#hooks/useOptimizationState.ts#useEventStreamState; react-web-sdk#hooks/useObservableState.ts#useObservableState; react-web-sdk#hooks/useOptimization.ts#useOptimizationContext; core-sdk#CoreStateful.ts#CoreStates

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence). Two axes
  `consent` / `persistenceConsent`. Default pre-consent allow-list = `['identify','page']`; other
  events blocked until consent. source: web-sdk#constants.ts#DEFAULT_WEB_ALLOWED_EVENT_TYPES
- `setConsent(true|false)` sets both axes; object form `setConsent({ events, persistence })` when
  they differ (SDK method `consent(accept)`, `accept: ConsentInput`).
  source: react-web-sdk#hooks/useOptimizationActions.ts#UseOptimizationActionsResult; core-sdk#CoreStateful.ts#consent; core-sdk#consent/Consent.ts#ConsentInput
- `identifyUser({ userId, traits })`; `resetUser()` preserves consent (does not touch consent/
  persistence signals) and clears profile + selected optimizations + route dedupe. Clear your own
  consent record separately on withdrawal (SDK methods `identify` / `reset`).
  source: react-web-sdk#hooks/useOptimizationActions.ts#UseOptimizationActionsResult; core-sdk#CoreStatefulEventEmitter.ts#identify; core-sdk#CoreStateful.ts#reset; web-sdk#ContentfulOptimization.ts#reset

## Version / runtime quirks

- The owned/config path does not create a live SDK during server render; it creates one after React
  commits. Readiness/loading/error is first-class.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider
- Provider setup never withholds or unmounts children. The provider disposes only an SDK instance it
  created; an injected instance remains app-owned, while cleanup returned by `onStatesReady` still
  runs synchronously before owned-SDK teardown. That cleanup must be non-throwing and non-reentrant;
  the provider does not add exception isolation around it.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/OptimizationProvider.tsx#getOnStatesReadyCleanup; web-sdk#presentation/optimizationRootRuntime.ts#disposeOptimizationRootSdkBinding; web-sdk#presentation/optimizationRootRuntime.ts#OptimizationRootSdkBinding
- Handoff-backed initial render validates cache safety before the snapshot runtime consumes
  `handoff.state`; unsafe public/static handoffs with profile state throw before provider children
  render.
  source: react-web-sdk#provider/OptimizationProvider.tsx#createInitialRuntime; core-sdk#handoff.ts#assertOptimizationCacheSafety
- Live updates precedence: preview panel open → per-entry `liveUpdates` → root `liveUpdates` →
  default (locked to first resolved state).
  source: web-sdk#presentation/OptimizedEntryController.ts#resolveShouldLiveUpdate; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry
- Preview panel is a separate published package `@contentful/optimization-web-preview-panel` (NOT
  part of `@contentful/optimization-react-web`); `attachOptimizationPreviewPanel` is its DEFAULT
  export, called imperatively (e.g. in an effect / dynamic import) with
  `{ contentful?, entries?, optimization?, nonce? }` — pass a `contentful.js` client as `contentful`,
  `nonce` for a CSP style nonce; `optimization` defaults to `window.contentfulOptimization` (the
  React-Web root's owned instance registers there). Requires `contentful` or pre-fetched `entries`.
  When using `useOptimizationContext`, wait for `isLive === true` before passing `sdk`: the initial
  owned-root value is a read-only snapshot runtime, while the attachment requires the initialized
  Web SDK and its preview bridge. `entries`, when supplied, is used instead of fetching through
  `contentful`.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; preview-panel#attachOptimizationPreviewPanel.ts#attachOptimizationPreviewPanel; preview-panel#attachOptimizationPreviewPanel.ts#attachOptimizationPreviewPanelToSdk; preview-panel#attachOptimizationPreviewPanel.ts#AttachOptimizationPreviewPanelArgs
- Preview overrides force audiences, variants, and inline-variable flag values by mutating
  stateful SDK signals from an API baseline; panel-open state forces optimized entries to
  live-update. See [`../shared/concepts.md`](../shared/concepts.md#preview-overrides).
  source: preview-panel#attachOptimizationPreviewPanel.ts#attachOptimizationPreviewPanelToSdk; core-sdk#preview-support/PreviewOverrideManager.ts#setVariantOverride; core-sdk#preview-support/applyChangeOverrides.ts#applyChangeOverrides; react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider
- `locale` prop change updates the SDK's Experience/event locale; the app still refetches Contentful
  and re-emits page events itself.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; core-sdk#CoreStateful.ts#setLocale

## Failure & fallback behavior

- Baseline fallback when event policy produced no selections / no variant / unresolved links /
  all-locale payloads: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
  source: react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry; concept:entry-personalization-and-variant-resolution
- Initial live setup failure—including rejection from the still-current initial handoff or an
  `onStatesReady` throw—is fatal to the provider runtime. The binding is disposed, an owned SDK is
  destroyed once, `useOptimizationContext()` exposes the error with no live SDK, and
  `onStatesReady` does not run after failed hydration. `OptimizedEntry` throws rather than rendering
  baseline, so it must render under an ancestor that handles `error` (an unguarded subtree crashes).
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/OptimizationProvider.tsx#hydrateProviderHandoff; react-web-sdk#provider/OptimizationProvider.tsx#getOnStatesReadyCleanup; react-web-sdk#context/OptimizationContext.tsx#OptimizationContextValue; react-web-sdk#hooks/useOptimization.ts#useOptimization
- Storage-write failure ⇒ SDK continues with in-memory state.
  source: web-sdk#storage/LocalStore.ts#LocalStore
- **Managed fetch failure:** when an ID or slug source rejects, the
  source snapshot carries `error`; `onEntryError(error)` fires and `errorFallback` renders. Distinct
  from baseline fallback (which is for resolution outcomes on a present entry).
  source: core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceSnapshot; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntrySourceProps
