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

| Import path                                                 | Purpose                                                                                                                                                                                      | source                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-react-web`                        | `OptimizationRoot`, `OptimizationProvider`, `LiveUpdatesProvider`, `OptimizedEntry`, all hooks                                                                                               | react-web-sdk#root/OptimizationRoot.tsx#OptimizationRoot; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry                                                                                     |
| `@contentful/optimization-react-web/router/react-router`    | `ReactRouterAutoPageTracker`                                                                                                                                                                 | react-web-sdk#router/react-router.tsx#ReactRouterAutoPageTracker                                                                                                                                                                                                                                                                                        |
| `@contentful/optimization-react-web/router/tanstack-router` | TanStack Router auto page tracker                                                                                                                                                            | react-web-sdk#router/tanstack-router.tsx#TanStackRouterAutoPageTracker                                                                                                                                                                                                                                                                                  |
| `@contentful/optimization-react-web/router/next-pages`      | Next.js Pages Router auto page tracker (React-Web-only setups)                                                                                                                               | react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker                                                                                                                                                                                                                                                                                            |
| `@contentful/optimization-react-web/router/next-app`        | Next.js App Router auto page tracker (React-Web-only setups)                                                                                                                                 | react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker                                                                                                                                                                                                                                                                                                |
| `@contentful/optimization-react-web/api-schemas`            | Type guards `isMergeTagEntry`, `isRichTextDocument`                                                                                                                                          | react-web-sdk#api-schemas.ts; api-schemas#contentful/typeGuards.ts#isMergeTagEntry; api-schemas#contentful/typeGuards.ts#isRichTextDocument                                                                                                                                                                                                             |
| `@contentful/optimization-core/entry-source`                | Framework-adapter primitives for managed fetch: `prefetchManagedEntries`, `createOptimizedEntryLoadingEntry`, `getOptimizedEntrySourceKey`, `OptimizedEntrySourceController` + handoff types | core-sdk#entry-source.ts; core-sdk#OptimizedEntrySourceController.ts#prefetchManagedEntries; core-sdk#OptimizedEntrySourceController.ts#createOptimizedEntryLoadingEntry; core-sdk#managed-entry-key.ts#getOptimizedEntrySourceKey; core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceController; core-sdk#CoreBase.ts#ManagedEntryHandoff |
| `@contentful/optimization-react-web/logger`                 | `createScopedLogger`                                                                                                                                                                         | react-web-sdk#logger.ts; api-client#lib/logger/Logger.ts#createScopedLogger                                                                                                                                                                                                                                                                             |

## Setup / factory

- **No factory** (unlike the Next.js adapters). Configure by passing props directly to
  `OptimizationRoot`; mount it exactly once around the subtree that uses the SDK. It composes
  `OptimizationProvider` + `LiveUpdatesProvider`, creates the Web SDK instance after React commits,
  and destroys it on unmount. source: react-web-sdk#root/OptimizationRoot.tsx#OptimizationRoot.
- `OptimizationRootProps` = `OptimizationProviderConfigProps & { liveUpdates? }`.
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
  - `trackEntryInteraction?`, `onStatesReady?`, `serverOptimizationState?`.
    source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProviderConfigProps
  - **`contentful?: ContentfulConfig` (managed entry fetching):** opt-in. `{ client:`
    `ContentfulEntryClient, defaultQuery?: ContentfulEntryQuery, cache?: false | { maxEntries?,`
    `ttlMs? } }`. Enables `<OptimizedEntry entryId>` / `useOptimizedEntry({ entryId })` to fetch by
    ID through the app's `contentful.js` client. `ContentfulEntryClient` =
    `{ getEntry(entryId, query?), getEntries(query?) }`;
    `ContentfulEntryQuery = EntryQueries<undefined>`. Managed query merges `defaultQuery` +
    per-entry query + SDK locale fallback + `include: 10`. One uncached normalized entry uses
    `getEntry()`; multiple uncached entries with the same normalized query use `getEntries()`;
    same-tick uncached single-entry calls with the same normalized query can share `getEntries()`;
    large `getEntries()` fetches split into 100-ID chunks. Cache default
    `{ maxEntries: 100, ttlMs: 300_000 }`; `cache: false` disables. Manual `baselineEntry` /
    `resolveOptimizedEntry()` is the alternative. Prop-surface chain: `CoreConfig.contentful` →
    `CoreStatefulConfig` → `OptimizationWebConfig` → `OptimizationRootSdkConfig` →
    `OptimizationProviderConfigProps` → `OptimizationRootProps`.
    source: core-sdk#CoreBase.ts#ContentfulConfig; core-sdk#CoreBase.ts#ContentfulEntryClient; core-sdk#CoreBase.ts#ContentfulEntryQuery; core-sdk#CoreBase.ts#CoreConfig; core-sdk#CoreBase.ts#fetchContentfulEntry; core-sdk#CoreBase.ts#fetchOptimizedEntry; core-sdk#CoreBase.ts#clearContentfulEntryCache
  - **`prefetchedManagedEntries?: readonly ManagedEntryHandoff[]` (SSR handoff):** forwarded
    to the provider; seeds baseline entries prefetched on the server so managed-`entryId` entries
    render without a client round-trip.
    source: react-web-sdk#provider/OptimizationProvider.tsx#ServerOptimizationStateProps; react-web-sdk#server-optimized-entries.ts; core-sdk#CoreBase.ts#ManagedEntryHandoff
  - **`prefetchManagedEntries?: readonly ManagedEntryDescriptor[]` (client cache warming):** after
    the live SDK is ready, the provider calls `runtime.prefetchManagedEntries(descriptors)` to warm
    the configured managed-entry cache.
    source: react-web-sdk#provider/OptimizationProvider.tsx#ServerOptimizationStateProps; core-sdk#CoreBase.ts#ManagedEntryDescriptor; core-sdk#OptimizedEntrySourceController.ts#ManagedEntryPrefetchRuntime
- Mount once. A second **owned** instance in the same browser runtime throws
  `ContentfulOptimization is already initialized`.
  source: web-sdk#ContentfulOptimization.ts#ContentfulOptimization

## Components & hooks

| Name                                                | Kind      | Import path                      | Key props/args                                                                                                                                                                                                                                | Returns                                                                                                                                                                                                                                                                                                    | source                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | --------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OptimizationRoot`                                  | component | root                             | config props above; `liveUpdates?`; `prefetchedManagedEntries?`; `prefetchManagedEntries?`; `children`                                                                                                                                        | element                                                                                                                                                                                                                                                                                                    | react-web-sdk#root/OptimizationRoot.tsx#OptimizationRoot; react-web-sdk#provider/OptimizationProvider.tsx#ServerOptimizationStateProps                                                                                                                                      |
| `OptimizationProvider`                              | provider  | root                             | `sdk={optimization}` (injected) OR config; `onStatesReady?`, `serverOptimizationState?`, `prefetchedManagedEntries?`, `prefetchManagedEntries?`                                                                                               | always renders children                                                                                                                                                                                                                                                                                    | react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/OptimizationProvider.tsx#ServerOptimizationStateProps                                                                                                                          |
| `LiveUpdatesProvider`                               | provider  | root                             | required for `OptimizedEntry`/`useOptimizedEntry`/`useLiveUpdates` when composing providers by hand                                                                                                                                           | element                                                                                                                                                                                                                                                                                                    | react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider; react-web-sdk#hooks/useLiveUpdates.ts#useLiveUpdates                                                                                                                                                    |
| `OptimizedEntry`                                    | component | root                             | **discriminated union:** `baselineEntry` (manual) XOR `entryId` (+`entryQuery?`, managed) — never both; render-prop child, `liveUpdates?`, `loadingFallback?`, `errorFallback?`, `onEntryError?`, `as?` (`'div'` or `'span'`), tracking props | element or `null`                                                                                                                                                                                                                                                                                          | react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntrySourceProps                                                                                                                                 |
| `ReactRouterAutoPageTracker`                        | component | `/router/react-router`           | `getPagePayload?`, `pagePayload?` (no `initialPageEvent`)                                                                                                                                                                                     | `null`                                                                                                                                                                                                                                                                                                     | react-web-sdk#router/react-router.tsx#ReactRouterAutoPageTracker                                                                                                                                                                                                            |
| next-pages / next-app tracker                       | component | `/router/next-pages` or next-app | also accept `initialPageEvent`                                                                                                                                                                                                                | `null`                                                                                                                                                                                                                                                                                                     | react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker; react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker                                                                                                                                                      |
| `useOptimizationContext`                            | hook      | root                             | —                                                                                                                                                                                                                                             | `{ sdk, error }` (`sdk` seeded, defined from 1st render; `error` on init fail)                                                                                                                                                                                                                             | react-web-sdk#hooks/useOptimization.ts#useOptimizationContext; react-web-sdk#context/OptimizationContext.tsx#OptimizationContextValue                                                                                                                                       |
| `useOptimization`                                   | hook      | root                             | —                                                                                                                                                                                                                                             | SDK instance; **throws** if unavailable / no provider                                                                                                                                                                                                                                                      | react-web-sdk#hooks/useOptimization.ts#useOptimization                                                                                                                                                                                                                      |
| `useOptimizedEntry`                                 | hook      | root                             | same discriminated union: `{ baselineEntry }` XOR `{ entryId, entryQuery? }` + `liveUpdates?`, `onEntryError?`                                                                                                                                | `{ canOptimize, baselineEntry, entry, error, isLoading, isPresentationReady, isResolved, metadata, resolvedData, selectedOptimization, selectedOptimizations }` (`error` is `Error \| undefined`; `entry`/`baselineEntry`/`metadata`/`selectedOptimization(s)` `undefined` while managed fetch unresolved) | react-web-sdk#optimized-entry/useOptimizedEntry.ts#useOptimizedEntry; react-web-sdk#optimized-entry/useOptimizedEntry.ts#UseOptimizedEntryResult                                                                                                                            |
| `prefetchManagedEntries`                            | function  | root / `entry-source`            | `(runtime: ManagedEntryPrefetchRuntime, descriptors: ManagedEntryDescriptor[])`                                                                                                                                                               | `Promise<ManagedEntryHandoff[]>` (each `{ entryId, entryQuery?, baselineEntry }`); feed to `prefetchedManagedEntries`                                                                                                                                                                                      | react-web-sdk#server-optimized-entries.ts; core-sdk#OptimizedEntrySourceController.ts#prefetchManagedEntries; core-sdk#OptimizedEntrySourceController.ts#ManagedEntryPrefetchRuntime; core-sdk#CoreBase.ts#ManagedEntryDescriptor; core-sdk#CoreBase.ts#ManagedEntryHandoff |
| `useConsentState`                                   | hook      | root                             | —                                                                                                                                                                                                                                             | `boolean` or `undefined`                                                                                                                                                                                                                                                                                   | react-web-sdk#hooks/useOptimizationState.ts#useConsentState                                                                                                                                                                                                                 |
| `useEventStreamState`                               | hook      | root                             | —                                                                                                                                                                                                                                             | latest accepted event payload or `undefined`; a current value, not an observable                                                                                                                                                                                                                           | react-web-sdk#hooks/useOptimizationState.ts#useEventStreamState                                                                                                                                                                                                             |
| `useProfileState` / `useSelectedOptimizationsState` | hook      | root                             | —                                                                                                                                                                                                                                             | profile (`id`, `traits`) / selected optimizations                                                                                                                                                                                                                                                          | react-web-sdk#hooks/useOptimizationState.ts#useProfileState; react-web-sdk#hooks/useOptimizationState.ts#useSelectedOptimizationsState                                                                                                                                      |
| `useOptimizationActions`                            | hook      | root                             | —                                                                                                                                                                                                                                             | `{ setConsent, flushEvents, identifyUser, trackPageView, resetUser, trackScreen, trackEvent }` (each bound to the SDK method named in its type: `consent`/`flush`/`identify`/`page`/`reset`/`screen`/`track`)                                                                                              | react-web-sdk#hooks/useOptimizationActions.ts#useOptimizationActions; react-web-sdk#hooks/useOptimizationActions.ts#UseOptimizationActionsResult                                                                                                                            |
| `useMergeTagResolver`                               | hook      | root                             | —                                                                                                                                                                                                                                             | `{ getMergeTagValue }`                                                                                                                                                                                                                                                                                     | react-web-sdk#hooks/useMergeTagResolver.ts#useMergeTagResolver; react-web-sdk#hooks/useMergeTagResolver.ts#UseMergeTagResolverResult                                                                                                                                        |

Note: `useOptimizationContext` is safe during render (returns the seeded snapshot runtime, whose
actions are inert no-ops until live); `useOptimization` throws only on init failure / missing
provider, so it is safe during render too, but is framed for post-mount code (handlers/effects).
source: core-sdk#runtime/SnapshotRuntime.ts#SnapshotRuntime; core-sdk#runtime/SnapshotRuntime.ts#createSnapshotRuntime

## Render / entry resolution

- **Entry source (managed or manual):** `OptimizedEntry` / `useOptimizedEntry` take a discriminated
  union — either `baselineEntry` (app fetched it: manual) OR `entryId` + optional `entryQuery` (SDK
  fetches it via `OptimizationRoot`'s `contentful.client`: managed). Never both. Managed fetch
  requires `contentful: { client }` on the root; without it the managed path has no client.
  `errorFallback` / `onEntryError` handle a managed-fetch failure. See
  [`../shared/concepts.md`](../shared/concepts.md#entry-source-boundary-managed-or-manual).
  source: react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntrySourceProps; react-web-sdk#optimized-entry/useOptimizedEntry.ts#UseOptimizedEntryParams; concept:entry-personalization-and-variant-resolution
- Render prop = `(resolvedEntry: Entry, { getMergeTagValue }) => ReactNode`; `resolvedEntry` is a
  base `contentful` `Entry` ⇒ cast `resolved as YourType` (`as unknown as YourType` only for
  genuinely disjoint types; direct cast works for `.withoutUnresolvableLinks`-narrowed types).
  Baseline fallback: see [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
  source: react-web-sdk#optimized-entry/optimizedEntryUtils.ts#RenderProp; react-web-sdk#optimized-entry/optimizedEntryUtils.ts#OptimizedEntryRenderContext
- **Loading model:** while resolving, renders baseline as a HIDDEN layout target (no jump), reveals
  resolved content when resolution settles; if it never settles, reveals baseline after a **5s**
  timeout (`BASELINE_REVEAL_TIMEOUT_MS = 5000`); `loadingFallback` shows custom UI in that window.
  source: web-sdk#presentation/OptimizedEntryController.ts#BASELINE_REVEAL_TIMEOUT_MS; web-sdk#presentation/OptimizedEntryController.ts#OptimizedEntryController; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry
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

- Page events: auto-page trackers emit on navigation; each dedupes consecutive route keys incl.
  Strict Mode double effects. Mount ONE tracker per router tree. React Router / TanStack trackers do
  NOT take `initialPageEvent`; only next-pages / next-app trackers do (React-Web-only Next setups).
  source: react-web-sdk#router/react-router.tsx#ReactRouterAutoPageTracker; react-web-sdk#router/tanstack-router.tsx#TanStackRouterAutoPageTracker; react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker; react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker; web-sdk#ContentfulOptimization.ts#trackCurrentPage
- Initial page event is auto-emitted on mount, not only on navigation: the shared emitter
  `useAutoPageEmitter` defaults `initialPageEvent` to `'emit'` and calls `sdk.trackCurrentPage()` in a
  mount effect, so the first route emits its `page` event as soon as the tracker mounts. Trackers that
  do not expose `initialPageEvent` (React Router / TanStack) always emit the initial page; only the
  next-pages / next-app trackers can pass `'skip'` to suppress it. With the `['identify','page']`
  pre-consent allow-list this initial `page` is admitted before any explicit consent call.
  source: react-web-sdk#auto-page/useAutoPageEmitter.ts#useAutoPageEmitter; kb:shared/concepts.md
- `getPagePayload` receives `{ context, routeKey, isInitialEmission }`; React Router `context` has
  `pathname`. It returns `AutoPagePayload | undefined`, the argument shape accepted by `sdk.page()`.
  Put application-specific route values under `properties` rather than returning arbitrary
  top-level keys. Payload layer merge order: router-derived → static `pagePayload` → dynamic
  `getPagePayload` (later wins).
  source: react-web-sdk#auto-page/types.ts#AutoPageEmissionContext; react-web-sdk#auto-page/types.ts#AutoPagePayloadOptions; react-web-sdk#router/react-router.tsx#ReactRouterAutoPageContext; react-web-sdk#auto-page/pagePayload.ts#buildAutoPagePayload; core-sdk#events/EventBuilder.ts#PageViewBuilderArgs
- Interaction tracking (views/clicks/hovers): on by default with `OptimizedEntry`; opt out per-type
  via `OptimizationRoot` `trackEntryInteraction`; per-entry props `clickable`/`trackViews`/
  `trackClicks`/`trackHovers` + duration props; uses RESOLVED entry id. Manual DOM:
  `sdk.tracking.enableElement('views', el, { data })` / `clearElement`.
  source: web-sdk#entry-tracking/EntryInteractionRuntime.ts#EntryInteractionRuntime; web-sdk#entry-tracking/resolveAutoTrackEntryInteractionOptions.ts#EntryInteractionApi; web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes
- Automatic interaction detectors run only while the corresponding event method is allowed by
  consent/`allowedEventTypes`. Insights delivery also requires a current Optimization profile; when
  no profile exists, the queue warns and drops the interaction instead of emitting it. Therefore a
  missing view/click/hover can mean consent policy, a factory/per-entry opt-out, missing tracking
  attributes, or missing profile continuity.
  source: web-sdk#entry-tracking/EntryInteractionRuntime.ts#reconcileInteraction; web-sdk#entry-tracking/EntryInteractionRuntime.ts#isInteractionAllowed; core-sdk#queues/InsightsQueue.ts#send
- Flags: `getFlag(name)` nonreactive read (defaults to current changes signal, emits flag-view
  tracking when consent+profile allow); `states.flag(name)` reactive.
  source: core-sdk#CoreStatefulEventEmitter.ts#getFlag; core-sdk#CoreStatefulEventEmitter.ts#getFlagObservable; core-sdk#CoreStateful.ts#CoreStates
- Analytics forwarding: `states.eventStream.current?.messageId` + `.subscribe`; dedupe by
  `messageId`; `states.blockedEventStream` for blocked-event diagnostics;
  `subscription.unsubscribe()`.
  source: api-schemas#experience/event/UniversalEventProperties.ts#UniversalEventProperties; core-sdk#CoreStateful.ts#CoreStates; core-sdk#signals/Observable.ts#Subscription; core-sdk#signals/Observable.ts#Observable
- `useEventStreamState()` subscribes internally and returns only the latest accepted event payload;
  it has no `.subscribe()` method. Code that needs accepted and blocked diagnostics or forwarding
  subscriptions must obtain a guarded live `sdk` from `useOptimizationContext()`, then subscribe to
  `sdk.states.eventStream` and `sdk.states.blockedEventStream` with cleanup. There is no
  `useBlockedEventStreamState` hook.
  source: react-web-sdk#hooks/useOptimizationState.ts#useEventStreamState; react-web-sdk#hooks/useOptimizationState.ts#useObservableState; react-web-sdk#hooks/useOptimization.ts#useOptimizationContext; core-sdk#CoreStateful.ts#CoreStates

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

- Browser-only: no server first paint; the SDK is **not ready on first render** (created after React
  commits, then queries the Experience API). Readiness/loading/error is first-class.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider
- Injected-SDK path (`OptimizationProvider sdk={optimization}`): `injectedSdkBacksInitialRender`
  ⇒ with an injected `sdk` and no `serverOptimizationState`, children render against the LIVE
  injected SDK from the first render; `onStatesReady` alone adds NO snapshot phase. Only
  `serverOptimizationState` routes the injected path through the read-only snapshot (hydrated in a
  layout effect via `hydrateOptimizationData`). Provider always renders children (never withheld/
  unmounted). The provider does NOT `destroy()` an instance it did not create (`ownsInstance:false`).
  source: react-web-sdk#provider/OptimizationProvider.tsx#injectedSdkBacksInitialRender; web-sdk#presentation/optimizationRootRuntime.ts#OptimizationRootSdkBinding; web-sdk#presentation/optimizationRootRuntime.ts#disposeOptimizationRootSdkBinding
- Owned/config `OptimizationRoot` path always seeds a snapshot runtime initially.
  source: react-web-sdk#provider/OptimizationProvider.tsx#createInitialRuntime; web-sdk#runtime.ts#createWebSnapshotRuntime
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
- `locale` prop change updates the SDK's Experience/event locale; the app still refetches Contentful
  and re-emits page events itself.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; core-sdk#CoreStateful.ts#setLocale

## Failure & fallback behavior

- Baseline fallback when event policy produced no selections / no variant / unresolved links /
  all-locale payloads: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
  source: react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry; concept:entry-personalization-and-variant-resolution
- On SDK **initialization failure**, `useOptimizationContext().error` is set; `OptimizedEntry`
  throws rather than rendering baseline, so it must render under an ancestor that handles `error`
  (an unguarded subtree crashes).
  source: react-web-sdk#context/OptimizationContext.tsx#OptimizationContextValue; react-web-sdk#hooks/useOptimization.ts#useOptimization
- Storage-write failure ⇒ SDK continues with in-memory state.
  source: web-sdk#storage/LocalStore.ts#LocalStore
- **Managed fetch failure:** when `entryId` is used and `contentful.client.getEntry()` rejects, the
  source snapshot carries `error`; `onEntryError(error)` fires and `errorFallback` renders. Distinct
  from baseline fallback (which is for resolution outcomes on a present entry).
  source: core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceSnapshot; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntrySourceProps
