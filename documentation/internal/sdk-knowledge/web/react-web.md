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

| Import path                                                 | Purpose                                                                                                                                                                                        | source                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-react-web`                        | `OptimizationRoot`, `OptimizationProvider`, `LiveUpdatesProvider`, `OptimizedEntry`, all hooks                                                                                                 | react-web-sdk#root/OptimizationRoot.tsx#OptimizationRoot; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry                                                                                                                                  |
| `@contentful/optimization-react-web/router/react-router`    | `ReactRouterAutoPageTracker`                                                                                                                                                                   | react-web-sdk#router/react-router.tsx#ReactRouterAutoPageTracker                                                                                                                                                                                                                                                                                                                                     |
| `@contentful/optimization-react-web/router/tanstack-router` | TanStack Router auto page tracker                                                                                                                                                              | react-web-sdk#router/tanstack-router.tsx#TanStackRouterAutoPageTracker                                                                                                                                                                                                                                                                                                                               |
| `@contentful/optimization-react-web/router/next-pages`      | Next.js Pages Router auto page tracker (React-Web-only setups)                                                                                                                                 | react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker                                                                                                                                                                                                                                                                                                                                         |
| `@contentful/optimization-react-web/router/next-app`        | Next.js App Router auto page tracker (React-Web-only setups)                                                                                                                                   | react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker                                                                                                                                                                                                                                                                                                                                             |
| `@contentful/optimization-react-web/api-schemas`            | Type guards `isMergeTagEntry`, `isRichTextDocument`                                                                                                                                            | react-web-sdk#api-schemas.ts; api-schemas#contentful/typeGuards.ts#isMergeTagEntry; api-schemas#contentful/typeGuards.ts#isRichTextDocument                                                                                                                                                                                                                                                          |
| `@contentful/optimization-core/entry-source`                | Framework-adapter primitives for managed fetch: `prefetchOptimizedEntries`, `createOptimizedEntryLoadingEntry`, `getOptimizedEntrySourceKey`, `OptimizedEntrySourceController` + handoff types | core-sdk#entry-source.ts; core-sdk#OptimizedEntrySourceController.ts#prefetchOptimizedEntries; core-sdk#OptimizedEntrySourceController.ts#createOptimizedEntryLoadingEntry; core-sdk#OptimizedEntrySourceController.ts#getOptimizedEntrySourceKey; core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceController; core-sdk#OptimizedEntrySourceController.ts#ServerOptimizedEntryHandoff |
| `@contentful/optimization-react-web/logger`                 | `createScopedLogger`                                                                                                                                                                           | react-web-sdk#logger.ts; api-client#lib/logger/Logger.ts#createScopedLogger                                                                                                                                                                                                                                                                                                                          |

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
    ID through the app's `contentful.js` client. `ContentfulEntryClient` = `{ getEntry(entryId,`
    `query?) }`; `ContentfulEntryQuery = EntryQueries<undefined>`. Managed query merges
    `defaultQuery` + per-call query + SDK locale fallback + `include: 10`. Cache default
    `{ maxEntries: 100, ttlMs: 300_000 }`; `cache: false` disables. Manual `baselineEntry` /
    `resolveOptimizedEntry()` is the alternative. Prop-surface chain: `CoreConfig.contentful` →
    `CoreStatefulConfig` → `OptimizationWebConfig` → `OptimizationRootSdkConfig` →
    `OptimizationProviderConfigProps` → `OptimizationRootProps`.
    source: core-sdk#CoreBase.ts#ContentfulConfig; core-sdk#CoreBase.ts#ContentfulEntryClient; core-sdk#CoreBase.ts#ContentfulEntryQuery; core-sdk#CoreBase.ts#CoreConfig; core-sdk#CoreBase.ts#fetchContentfulEntry; core-sdk#CoreBase.ts#fetchOptimizedEntry; core-sdk#CoreBase.ts#clearContentfulEntryCache
  - **`serverOptimizedEntries?: readonly ServerOptimizedEntryHandoff[]` (SSR handoff):** forwarded
    to the provider; seeds baseline entries prefetched on the server so managed-`entryId` entries
    render without a client round-trip.
    source: react-web-sdk#provider/OptimizationProvider.tsx#ServerOptimizationStateProps; react-web-sdk#server-optimized-entries.ts; core-sdk#OptimizedEntrySourceController.ts#ServerOptimizedEntryHandoff
- Mount once. A second **owned** instance in the same browser runtime throws
  `ContentfulOptimization is already initialized`.
  source: web-sdk#ContentfulOptimization.ts#ContentfulOptimization

## Components & hooks

| Name                                                | Kind      | Import path                      | Key props/args                                                                                                                                                                                                                                | Returns                                                                                                                                                                                                            | source                                                                                                                                                                                 |
| --------------------------------------------------- | --------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OptimizationRoot`                                  | component | root                             | config props above; `liveUpdates?`; `children`                                                                                                                                                                                                | element                                                                                                                                                                                                            | react-web-sdk#root/OptimizationRoot.tsx#OptimizationRoot                                                                                                                               |
| `OptimizationProvider`                              | provider  | root                             | `sdk={optimization}` (injected) OR config; `onStatesReady?`, `serverOptimizationState?`                                                                                                                                                       | always renders children                                                                                                                                                                                            | react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider                                                                                                                   |
| `LiveUpdatesProvider`                               | provider  | root                             | required for `OptimizedEntry`/`useOptimizedEntry`/`useLiveUpdates` when composing providers by hand                                                                                                                                           | element                                                                                                                                                                                                            | react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider; react-web-sdk#hooks/useLiveUpdates.ts#useLiveUpdates                                                               |
| `OptimizedEntry`                                    | component | root                             | **discriminated union:** `baselineEntry` (manual) XOR `entryId` (+`entryQuery?`, managed) — never both; render-prop child, `liveUpdates?`, `loadingFallback?`, `errorFallback?`, `onEntryError?`, `as?` (`'div'` or `'span'`), tracking props | element or `null`                                                                                                                                                                                                  | react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntrySourceProps                                            |
| `ReactRouterAutoPageTracker`                        | component | `/router/react-router`           | `getPagePayload?`, `pagePayload?` (no `initialPageEvent`)                                                                                                                                                                                     | `null`                                                                                                                                                                                                             | react-web-sdk#router/react-router.tsx#ReactRouterAutoPageTracker                                                                                                                       |
| next-pages / next-app tracker                       | component | `/router/next-pages` or next-app | also accept `initialPageEvent`                                                                                                                                                                                                                | `null`                                                                                                                                                                                                             | react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker; react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker                                                                 |
| `useOptimizationContext`                            | hook      | root                             | —                                                                                                                                                                                                                                             | `{ sdk, error }` (`sdk` seeded, defined from 1st render; `error` on init fail)                                                                                                                                     | react-web-sdk#hooks/useOptimization.ts#useOptimizationContext; react-web-sdk#context/OptimizationContext.tsx#OptimizationContextValue                                                  |
| `useOptimization`                                   | hook      | root                             | —                                                                                                                                                                                                                                             | SDK instance; **throws** if unavailable / no provider                                                                                                                                                              | react-web-sdk#hooks/useOptimization.ts#useOptimization                                                                                                                                 |
| `useOptimizedEntry`                                 | hook      | root                             | same discriminated union: `{ baselineEntry }` XOR `{ entryId, entryQuery? }` + `liveUpdates?`, `onEntryError?`                                                                                                                                | `{ entry, baselineEntry, error?, isLoading, canOptimize, selectedOptimization, isPresentationReady, resolvedData, selectedOptimizations, … }` (`entry`/`baselineEntry` `undefined` while managed fetch unresolved) | react-web-sdk#optimized-entry/useOptimizedEntry.ts#useOptimizedEntry; react-web-sdk#optimized-entry/useOptimizedEntry.ts#UseOptimizedEntryResult                                       |
| `prefetchOptimizedEntries`                          | function  | root / `entry-source`            | `(runtime: { fetchContentfulEntry }, descriptors: { entryId, entryQuery? }[])`                                                                                                                                                                | `Promise<ServerOptimizedEntryHandoff[]>` (each `{ entryId, entryQuery?, baselineEntry }`); feed to `serverOptimizedEntries`                                                                                        | react-web-sdk#server-optimized-entries.ts; core-sdk#OptimizedEntrySourceController.ts#prefetchOptimizedEntries; core-sdk#OptimizedEntrySourceController.ts#ServerOptimizedEntryHandoff |
| `useConsentState`                                   | hook      | root                             | —                                                                                                                                                                                                                                             | `boolean` or `undefined`                                                                                                                                                                                           | react-web-sdk#hooks/useOptimizationState.ts#useConsentState                                                                                                                            |
| `useProfileState` / `useSelectedOptimizationsState` | hook      | root                             | —                                                                                                                                                                                                                                             | profile (`id`, `traits`) / selected optimizations                                                                                                                                                                  | react-web-sdk#hooks/useOptimizationState.ts#useProfileState; react-web-sdk#hooks/useOptimizationState.ts#useSelectedOptimizationsState                                                 |
| `useOptimizationActions`                            | hook      | root                             | —                                                                                                                                                                                                                                             | `{ setConsent, identifyUser, resetUser, … }`                                                                                                                                                                       | react-web-sdk#hooks/useOptimizationActions.ts#useOptimizationActions; react-web-sdk#hooks/useOptimizationActions.ts#UseOptimizationActionsResult                                       |
| `useMergeTagResolver`                               | hook      | root                             | —                                                                                                                                                                                                                                             | `{ getMergeTagValue }`                                                                                                                                                                                             | react-web-sdk#hooks/useMergeTagResolver.ts#useMergeTagResolver; react-web-sdk#hooks/useMergeTagResolver.ts#UseMergeTagResolverResult                                                   |

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
- `getPagePayload` receives `{ context, routeKey, isInitialEmission }`; React Router `context` has
  `pathname`. Payload layer merge order: router-derived → static `pagePayload` → dynamic
  `getPagePayload` (later wins).
  source: react-web-sdk#auto-page/types.ts#AutoPageEmissionContext; react-web-sdk#router/react-router.tsx#ReactRouterAutoPageContext; react-web-sdk#auto-page/pagePayload.ts#buildAutoPagePayload
- Interaction tracking (views/clicks/hovers): on by default with `OptimizedEntry`; opt out per-type
  via `OptimizationRoot` `trackEntryInteraction`; per-entry props `clickable`/`trackViews`/
  `trackClicks`/`trackHovers` + duration props; uses RESOLVED entry id. Manual DOM:
  `sdk.tracking.enableElement('views', el, { data })` / `clearElement`.
  source: web-sdk#entry-tracking/EntryInteractionRuntime.ts#EntryInteractionRuntime; web-sdk#entry-tracking/resolveAutoTrackEntryInteractionOptions.ts#EntryInteractionApi; web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes
- Flags: `getFlag(name)` nonreactive read (defaults to current changes signal, emits flag-view
  tracking when consent+profile allow); `states.flag(name)` reactive.
  source: core-sdk#CoreStatefulEventEmitter.ts#getFlag; core-sdk#CoreStatefulEventEmitter.ts#getFlagObservable; core-sdk#CoreStateful.ts#CoreStates
- Analytics forwarding: `states.eventStream.current?.messageId` + `.subscribe`; dedupe by
  `messageId`; `states.blockedEventStream` for blocked-event diagnostics;
  `subscription.unsubscribe()`.
  source: api-schemas#experience/event/UniversalEventProperties.ts#UniversalEventProperties; core-sdk#CoreStateful.ts#CoreStates; core-sdk#signals/Observable.ts#Subscription; core-sdk#signals/Observable.ts#Observable

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
- `locale` prop change updates the SDK's Experience/event locale; the app still refetches Contentful
  and re-emits page events itself.
  source: react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider; core-sdk#CoreStateful.ts#setLocale

## Failure & fallback behavior

- Baseline fallback on denied consent / no variant / unresolved links / all-locale payloads: see
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
