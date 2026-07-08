# React Web (`@contentful/optimization-react-web`) — SDK knowledge

> Internal, verified reference. Not a guide. Facts only, each with a source pointer. Last verified
> against packages/\*\*/src during the guide rewrite.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only React-Web specifics.
Wraps the lower-level `@contentful/optimization-web` browser SDK in React providers/hooks/component.
Package source root: `packages/web/frameworks/react-web-sdk/src`; underlying Web SDK:
`packages/web/web-sdk/src`; shared core: `packages/universal/core-sdk/src`.

## Package & entry points

| Import path                                                 | Purpose                                                                                                                                                                                                                                                      | source                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-react-web`                        | `OptimizationRoot`, `OptimizationProvider`, `LiveUpdatesProvider`, `OptimizedEntry`, all hooks                                                                                                                                                               | `package.json` exports; `src/index.ts`                                                                                 |
| `@contentful/optimization-react-web/router/react-router`    | `ReactRouterAutoPageTracker`                                                                                                                                                                                                                                 | `package.json:95`; `src/router/react-router.tsx:55`                                                                    |
| `@contentful/optimization-react-web/router/tanstack-router` | TanStack Router auto page tracker                                                                                                                                                                                                                            | `package.json:105`; `src/router/tanstack-router.tsx:23`                                                                |
| `@contentful/optimization-react-web/router/next-pages`      | Next.js Pages Router auto page tracker (React-Web-only setups)                                                                                                                                                                                               | `package.json:75`; `src/router/next-pages.tsx:49-58`                                                                   |
| `@contentful/optimization-react-web/router/next-app`        | Next.js App Router auto page tracker (React-Web-only setups)                                                                                                                                                                                                 | `package.json:85`; `src/router/next-app.tsx:40-42`                                                                     |
| `@contentful/optimization-react-web/api-schemas`            | Type guards `isMergeTagEntry`, `isRichTextDocument`                                                                                                                                                                                                          | `package.json:65`; `src/api-schemas.ts`                                                                                |
| `@contentful/optimization-core/entry-source`                | Framework-adapter primitives for managed fetch: `prefetchManagedEntries`, `createOptimizedEntryLoadingEntry`, `getOptimizedEntrySourceKey`, `OptimizedEntrySourceController`, `ManagedEntryDescriptor`, `ManagedEntryHandoff`, `ManagedEntryPrefetchRuntime` | `packages/universal/core-sdk/src/entry-source.ts`; `packages/universal/core-sdk/src/OptimizedEntrySourceController.ts` |
| `@contentful/optimization-react-web/logger`                 | `createScopedLogger`                                                                                                                                                                                                                                         | `package.json:25`; `src/logger.ts:1`                                                                                   |

## Setup / factory

- **No factory** (unlike the Next.js adapters). Configure by passing props directly to
  `OptimizationRoot`; mount it exactly once around the subtree that uses the SDK. It composes
  `OptimizationProvider` + `LiveUpdatesProvider`, creates the Web SDK instance after React commits,
  and destroys it on unmount. source: `src/root/OptimizationRoot.tsx:9-22`.
- `OptimizationRootProps` = `OptimizationProviderConfigProps & { liveUpdates? }`. source:
  `src/root/OptimizationRoot.tsx:9-11`. Config props:
  - `clientId`, `environment`, `fetchOptions?` — `CoreConfig` via `core-sdk` `CoreBase.ts:42,107`.
  - `locale`, `logLevel?` — `core-sdk` `CoreBase.ts:46,54`.
  - `defaults` (`consent`, `persistenceConsent`), `api?`, `allowedEventTypes?`, `onEventBlocked?`,
    `queuePolicy?` — `core-sdk` `CoreStateful.ts:175-199`. `api` = `experienceBaseUrl`,
    `insightsBaseUrl` — `core-sdk` `CoreApiConfig.ts:11-18`.
  - `app` (`name`, `version`), `cookie?` (`domain`, `expires` days) — `web-sdk`
    `ContentfulOptimization.ts:68-91`; `web-sdk` `lib/cookies.ts:11-23`.
  - `trackEntryInteraction?`, `onStatesReady?`, `serverOptimizationState?` —
    `src/provider/OptimizationProvider.tsx:53-69`.
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
    `OptimizationProviderConfigProps` → `OptimizationRootProps`. source:
    `packages/universal/core-sdk/src/CoreBase.ts` `ContentfulConfig`, `ContentfulEntryClient`,
    `ContentfulEntryQuery`, `CoreConfig.contentful`, `fetchContentfulEntries`,
    `fetchContentfulEntry`, `fetchOptimizedEntry`, `clearContentfulEntryCache`;
    `packages/web/frameworks/react-web-sdk/src/provider/OptimizationProvider.tsx:38-82`;
    `packages/web/frameworks/react-web-sdk/src/root/OptimizationRoot.tsx:9-22`.
  - **`prefetchedManagedEntries?: readonly ManagedEntryHandoff[]` (SSR handoff):** forwarded to the
    provider; seeds baseline entries prefetched on the server so managed-`entryId` entries render
    without a client round-trip. source:
    `packages/web/frameworks/react-web-sdk/src/provider/OptimizationProvider.tsx:47-64,215-239`;
    `packages/web/frameworks/react-web-sdk/src/optimized-entry/useOptimizedEntry.ts:85-98`;
    `packages/web/frameworks/react-web-sdk/src/server-optimized-entries.ts`.
  - **`prefetchManagedEntries?: readonly ManagedEntryDescriptor[]` (client cache warming):** after
    the live SDK is ready, the provider calls `runtime.prefetchManagedEntries(descriptors)` to warm
    the configured managed-entry cache. source:
    `packages/web/frameworks/react-web-sdk/src/provider/OptimizationProvider.tsx:47-64,316-336`.
- Mount once. A second **owned** instance in the same browser runtime throws
  `ContentfulOptimization is already initialized`. source: `web-sdk`
  `ContentfulOptimization.ts:290-291`.

## Components & hooks

| Name                                                | Kind      | Import path                        | Key props/args                                                                                                                                                                                                                              | Returns                                                                                                                                                                                                            | source                                                                                                                                                          |
| --------------------------------------------------- | --------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OptimizationRoot`                                  | component | root                               | config props above; `liveUpdates?`; `prefetchedManagedEntries?`; `prefetchManagedEntries?`; `children`                                                                                                                                      | element                                                                                                                                                                                                            | `packages/web/frameworks/react-web-sdk/src/root/OptimizationRoot.tsx:9-22`; `packages/web/frameworks/react-web-sdk/src/provider/OptimizationProvider.tsx:47-64` |
| `OptimizationProvider`                              | provider  | root                               | `sdk={optimization}` (injected) OR config; `onStatesReady?`, `serverOptimizationState?`, `prefetchedManagedEntries?`, `prefetchManagedEntries?`                                                                                             | always renders children                                                                                                                                                                                            | `packages/web/frameworks/react-web-sdk/src/provider/OptimizationProvider.tsx:47-98,215-239,316-336`                                                             |
| `LiveUpdatesProvider`                               | provider  | root                               | required for `OptimizedEntry`/`useOptimizedEntry`/`useLiveUpdates` when composing providers by hand                                                                                                                                         | element                                                                                                                                                                                                            | `src/hooks/useLiveUpdates.ts:7-9`                                                                                                                               |
| `OptimizedEntry`                                    | component | root                               | **discriminated union:** `baselineEntry` (manual) XOR `entryId` (+`entryQuery?`, managed) — never both; render-prop child, `liveUpdates?`, `loadingFallback?`, `errorFallback?`, `onEntryError?`, `as?` (`'div'`\|`'span'`), tracking props | element / `null`                                                                                                                                                                                                   | `src/optimized-entry/OptimizedEntry.tsx:81-90,118-133`                                                                                                          |
| `ReactRouterAutoPageTracker`                        | component | `/router/react-router`             | `getPagePayload?`, `pagePayload?` (no `initialPageEvent`)                                                                                                                                                                                   | `null`                                                                                                                                                                                                             | `src/router/react-router.tsx:53-55`                                                                                                                             |
| next-pages / next-app tracker                       | component | `/router/next-pages` \| `next-app` | also accept `initialPageEvent`                                                                                                                                                                                                              | `null`                                                                                                                                                                                                             | `src/router/next-pages.tsx:49-51`; `next-app.tsx:40-42`                                                                                                         |
| `useOptimizationContext`                            | hook      | root                               | —                                                                                                                                                                                                                                           | `{ sdk, error }` (`sdk` seeded, defined from 1st render; `error` on init fail)                                                                                                                                     | `src/context/OptimizationContext.tsx:7-10`; `provider/OptimizationProvider.tsx:191-197,238-242`                                                                 |
| `useOptimization`                                   | hook      | root                               | —                                                                                                                                                                                                                                           | SDK instance; **throws** if unavailable / no provider                                                                                                                                                              | `src/hooks/useOptimization.ts:31-45`                                                                                                                            |
| `useOptimizedEntry`                                 | hook      | root                               | same discriminated union: `{ baselineEntry }` XOR `{ entryId, entryQuery? }` + `liveUpdates?`, `onEntryError?`                                                                                                                              | `{ entry, baselineEntry, error?, isLoading, canOptimize, selectedOptimization, isPresentationReady, resolvedData, selectedOptimizations, … }` (`entry`/`baselineEntry` `undefined` while managed fetch unresolved) | `src/optimized-entry/useOptimizedEntry.ts:16-35,47-60`                                                                                                          |
| `prefetchManagedEntries`                            | function  | root / `entry-source`              | `(runtime: ManagedEntryPrefetchRuntime, descriptors: ManagedEntryDescriptor[])`                                                                                                                                                             | `Promise<ManagedEntryHandoff[]>` (each `{ entryId, entryQuery?, baselineEntry }`); feed to `prefetchedManagedEntries`                                                                                              | `packages/web/frameworks/react-web-sdk/src/server-optimized-entries.ts`; `packages/universal/core-sdk/src/OptimizedEntrySourceController.ts:32-36,91-96`        |
| `useConsentState`                                   | hook      | root                               | —                                                                                                                                                                                                                                           | `boolean \| undefined`                                                                                                                                                                                             | `src/hooks/useOptimizationState.ts:49-52`                                                                                                                       |
| `useProfileState` / `useSelectedOptimizationsState` | hook      | root                               | —                                                                                                                                                                                                                                           | profile (`id`, `traits`) / selected optimizations                                                                                                                                                                  | `src/hooks/useOptimizationState.ts:79-94`                                                                                                                       |
| `useOptimizationActions`                            | hook      | root                               | —                                                                                                                                                                                                                                           | `{ setConsent, identifyUser, resetUser, … }`                                                                                                                                                                       | `src/hooks/useOptimizationActions.ts:11-19,44-58`                                                                                                               |
| `useMergeTagResolver`                               | hook      | root                               | —                                                                                                                                                                                                                                           | `{ getMergeTagValue }`                                                                                                                                                                                             | `src/hooks/useMergeTagResolver.ts:11-16,29-39`                                                                                                                  |

Note: `useOptimizationContext` is safe during render (returns the seeded snapshot runtime, whose
actions are inert no-ops until live); `useOptimization` throws only on init failure / missing
provider, so it is safe during render too, but is framed for post-mount code (handlers/effects).
source: `core-sdk` `SnapshotRuntime.ts:52-87,191-198`.

## Render / entry resolution

- **Entry source (managed or manual):** `OptimizedEntry` / `useOptimizedEntry` take a discriminated
  union — either `baselineEntry` (app fetched it: manual) OR `entryId` + optional `entryQuery` (SDK
  fetches it via `OptimizationRoot`'s `contentful.client`: managed). Never both. Managed fetch
  requires `contentful: { client }` on the root; without it the managed path has no client.
  `errorFallback` / `onEntryError` handle a managed-fetch failure. source:
  `src/optimized-entry/OptimizedEntry.tsx:81-90,118-133`; `useOptimizedEntry.ts:16-35`. See
  [`../shared/concepts.md`](../shared/concepts.md#entry-source-boundary-managed-or-manual).
- Render prop = `(resolvedEntry: Entry, { getMergeTagValue }) => ReactNode`; `resolvedEntry` is a
  base `contentful` `Entry` ⇒ cast `resolved as YourType` (`as unknown as YourType` only for
  genuinely disjoint types; direct cast works for `.withoutUnresolvableLinks`-narrowed types).
  source: `src/optimized-entry/optimizedEntryUtils.ts:8-11`; `OptimizedEntry.tsx:137-143`. Baseline
  fallback: see [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
- **Loading model:** while resolving, renders baseline as a HIDDEN layout target (no jump), reveals
  resolved content when resolution settles; if it never settles, reveals baseline after a **5s**
  timeout; `loadingFallback` shows custom UI in that window. source: `web-sdk`
  `presentation/OptimizedEntryController.ts:9,167` (`BASELINE_REVEAL_TIMEOUT_MS = 5000`),
  `:462-467,517-534`; `src/optimized-entry/OptimizedEntry.tsx:178-203`.
- **Double-wrap:** nested `OptimizedEntry` sharing a baseline id returns `null` + dev-only warning
  (gated `NODE_ENV !== 'production'`); different baseline ids are fine. source:
  `OptimizedEntry.tsx:104-116,164-166`.
- **Host element:** wraps in a layout-neutral element, `display: contents` by default; `as` accepts
  only `'div'`/`'span'` (default `'div'`). Plain-node children still emit tracking attributes.
  source: `optimizedEntryUtils.ts:7`; `OptimizedEntry.tsx:89,125,207`; `web-sdk`
  `OptimizedEntryController.ts:23` (`OPTIMIZED_ENTRY_HOST_DISPLAY = 'contents'`).

## Identifier ownership

| Identifier                              | Owner  | Notes                                                                                              | source                                                                      |
| --------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `ctfl-opt-aid` (profile/anon-id cookie) | SDK    | Browser-readable; the one persistence value the SDK owns                                           | `core-sdk` `constants.ts:38`; `web-sdk` `ContentfulOptimization.ts:299-373` |
| app consent cookie/record               | reader | Reader names/writes/reads; SDK only reflects what you pass to `setConsent`                         | shared concept; guide                                                       |
| browser env vars (`PUBLIC_*` / bundler) | reader | Match the bundler's browser-var convention (Vite `import.meta.env`, CRA `process.env.REACT_APP_*`) | bundler convention                                                          |

## Events & tracking

- Page events: auto-page trackers emit on navigation; each dedupes consecutive route keys incl.
  Strict Mode double effects. Mount ONE tracker per router tree. React Router / TanStack trackers do
  NOT take `initialPageEvent`; only next-pages / next-app trackers do (React-Web-only Next setups).
  source: `src/router/react-router.tsx:53`, `tanstack-router.tsx:23`, `next-pages.tsx:49-51`,
  `next-app.tsx:40-42`; `web-sdk` `ContentfulOptimization.ts:460-481` (routeKey dedup).
- `getPagePayload` receives `{ context, routeKey, isInitialEmission }`; React Router `context` has
  `pathname`. Payload layer merge order: router-derived → static `pagePayload` → dynamic
  `getPagePayload` (later wins). source: `src/auto-page/types.ts:10-19`,
  `router/react-router.tsx:43-51`, `auto-page/pagePayload.ts:49-58`.
- Interaction tracking (views/clicks/hovers): on by default with `OptimizedEntry`; opt out per-type
  via `OptimizationRoot` `trackEntryInteraction`; per-entry props `clickable`/`trackViews`/
  `trackClicks`/`trackHovers` + duration props; uses RESOLVED entry id. Manual DOM:
  `sdk.tracking.enableElement('views', el, { data })` / `clearElement`. source: `web-sdk`
  `entry-tracking/EntryInteractionRuntime.ts:199-219`;
  `presentation/OptimizedEntryTrackingAttributes.ts:66-72`.
- Flags: `getFlag(name)` nonreactive read (defaults to current changes signal, emits flag-view
  tracking when consent+profile allow); `states.flag(name)` reactive. source: `core-sdk`
  `CoreStatefulEventEmitter.ts:87-92,379-384,455-461`; `CoreStateful.ts:228`.
- Analytics forwarding: `states.eventStream.current?.messageId` + `.subscribe`; dedupe by
  `messageId`; `states.blockedEventStream` for blocked-event diagnostics;
  `subscription.unsubscribe()`. source: `api-schemas`
  `experience/event/UniversalEventProperties.ts:88-94`; `core-sdk` `CoreStateful.ts:144,227`;
  `signals/Observable.ts:11,40`.

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence). Two axes
  `consent` / `persistenceConsent`. Default pre-consent allow-list = `['identify','page']`; other
  events blocked until consent. source: `web-sdk` `constants.ts:13`.
- `setConsent(true|false)` sets both axes; object form `setConsent({ events, persistence })` when
  they differ. source: `core-sdk` `CoreStateful.ts:467-478`.
- `identifyUser({ userId, traits })`; `resetUser()` preserves consent (does not touch consent/
  persistence signals) and clears profile + selected optimizations + route dedupe. Clear your own
  consent record separately on withdrawal. source: `core-sdk` `CoreStatefulEventEmitter.ts:114-122`,
  `CoreStateful.ts:451-461`; `web-sdk` `ContentfulOptimization.ts:443-449`.

## Version / runtime quirks

- Browser-only: no server first paint; the SDK is **not ready on first render** (created after React
  commits, then queries the Experience API). Readiness/loading/error is first-class. source:
  `src/provider/OptimizationProvider.tsx:184-266`.
- Injected-SDK path (`OptimizationProvider sdk={optimization}`):
  `injectedSdkBacksInitialRender = props.sdk !== undefined && props.serverOptimizationState === undefined`
  ⇒ with an injected `sdk` and no `serverOptimizationState`, children render against the LIVE
  injected SDK from the first render; `onStatesReady` alone adds NO snapshot phase. Only
  `serverOptimizationState` routes the injected path through the read-only snapshot (hydrated in a
  layout effect via `hydrateOptimizationData`). Provider always renders children (never withheld/
  unmounted). The provider does NOT `destroy()` an instance it did not create
  (`ownsInstance:false`). source: `src/provider/OptimizationProvider.tsx:180-198,206,131-144`;
  `web-sdk` `presentation/optimizationRootRuntime.ts:146-152,167-174`.
- Owned/config `OptimizationRoot` path always seeds a snapshot runtime initially. source:
  `OptimizationProvider.tsx:191-197`.
- Live updates precedence: preview panel open → per-entry `liveUpdates` → root `liveUpdates` →
  default (locked to first resolved state). source: `web-sdk` `OptimizedEntryController.ts:214-226`;
  `src/optimized-entry/OptimizedEntry.tsx:45`.
- `locale` prop change updates the SDK's Experience/event locale; the app still refetches Contentful
  and re-emits page events itself. source: guide; `core-sdk` `CoreBase.ts:46`.

## Failure & fallback behavior

- Baseline fallback on denied consent / no variant / unresolved links / all-locale payloads: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
- On SDK **initialization failure**, `useOptimizationContext().error` is set; `OptimizedEntry`
  throws rather than rendering baseline, so it must render under an ancestor that handles `error`
  (an unguarded subtree crashes). source: `src/provider/OptimizationProvider.tsx:238-242`; guide
  readiness section.
- Storage-write failure ⇒ SDK continues with in-memory state. source: `web-sdk`
  `ContentfulOptimization.ts:299-373`.
- **Managed fetch failure:** when `entryId` is used and `contentful.client.getEntry()` rejects, the
  source snapshot carries `error`; `onEntryError(error)` fires and `errorFallback` renders. Distinct
  from baseline fallback (which is for resolution outcomes on a present entry). source: `core-sdk`
  `OptimizedEntrySourceController.ts:19-28`; `OptimizedEntry.tsx:81-90`.
