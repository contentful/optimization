# React Native (`@contentful/optimization-react-native`) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-react-native-sdk-in-a-react-native-app.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer verified against
> packages/\*\*/src.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). The concepts they capture — consent/persistence
axes, baseline fallback, entry-source managed-vs-manual, live updates, single-locale entry contract —
are SDK-neutral and apply to the whole suite via the shared `core-sdk`.
This file records only React-Native specifics. The RN SDK subclasses the same `CoreStateful` runtime
as the web SDKs and adds React Native providers/hooks/components, AsyncStorage persistence, optional
NetInfo offline detection, `AppState` background flushing, and an in-app preview panel. Package
source root: `packages/react-native-sdk/src`; shared core: `packages/universal/core-sdk/src`.

## Package & entry points

| Import path                                             | Purpose                                                                                                                                                                                                                                       | source                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-react-native`                 | `OptimizationRoot`, `OptimizationProvider`, `LiveUpdatesProvider`, `OptimizedEntry`, `OptimizationScrollProvider`, `OptimizationNavigationContainer`, all hooks, `ContentfulOptimization` (default-exported class), `OptimizationConfig` type | react-native-sdk#index.ts#OptimizationConfig; react-native-sdk#components/OptimizationRoot.tsx#OptimizationRoot; react-native-sdk#components/OptimizationProvider.tsx#OptimizationProvider; react-native-sdk#components/OptimizedEntry.tsx#OptimizedEntry; react-native-sdk#ContentfulOptimization.ts#ContentfulOptimization |
| `@contentful/optimization-react-native/preview`         | `PreviewPanel` (also default), `PreviewPanelOverlay`, preview sections/primitives/hooks, definition-builder utils, theme                                                                                                                      | react-native-sdk#preview/index.ts; react-native-sdk#preview/components/PreviewPanelOverlay.tsx#PreviewPanelOverlay; react-native-sdk#preview/components/PreviewPanel.tsx#PreviewPanel                                                                                                                                        |
| `@contentful/optimization-react-native/constants`       | `OPTIMIZATION_REACT_NATIVE_SDK_VERSION`, `OPTIMIZATION_REACT_NATIVE_SDK_NAME`                                                                                                                                                                 | react-native-sdk#constants.ts#OPTIMIZATION_REACT_NATIVE_SDK_VERSION; react-native-sdk#constants.ts#OPTIMIZATION_REACT_NATIVE_SDK_NAME                                                                                                                                                                                        |
| `@contentful/optimization-react-native/core-sdk`        | Re-export of `@contentful/optimization-core`                                                                                                                                                                                                  | react-native-sdk#core-sdk.ts                                                                                                                                                                                                                                                                                                 |
| `@contentful/optimization-react-native/api-client`      | Re-export of `@contentful/optimization-core/api-client`                                                                                                                                                                                       | react-native-sdk#api-client.ts                                                                                                                                                                                                                                                                                               |
| `@contentful/optimization-react-native/api-schemas`     | Re-export of `@contentful/optimization-core/api-schemas`                                                                                                                                                                                      | react-native-sdk#api-schemas.ts                                                                                                                                                                                                                                                                                              |
| `@contentful/optimization-react-native/logger`          | Re-export of `@contentful/optimization-core/logger` (incl. default)                                                                                                                                                                           | react-native-sdk#logger.ts                                                                                                                                                                                                                                                                                                   |
| `@contentful/optimization-react-native/preview-support` | Re-export of `@contentful/optimization-core/preview-support`                                                                                                                                                                                  | react-native-sdk#preview-support.ts                                                                                                                                                                                                                                                                                          |

## Setup / factory

- Two entry points: the `OptimizationRoot`/`OptimizationProvider` component path (React creates the
  instance) and the `ContentfulOptimization.create(config)` factory (caller creates the instance and
  injects it via `OptimizationProvider sdk={sdk}`). `create` is `async` and returns a
  `Promise<ContentfulOptimization>` because it reads AsyncStorage before constructing.
  source: react-native-sdk#components/OptimizationRoot.tsx#OptimizationRoot; react-native-sdk#ContentfulOptimization.ts#ContentfulOptimization
- Config type is `CoreStatefulConfig` (aliased as `OptimizationConfig`); only `clientId` is
  required, and its keys are: `clientId` (required), `environment?`, `fetchOptions?` (from
  `api-client` `ApiConfig`);
  `locale?`, `logLevel?`, `contentful?`, `eventBuilder?` (from `CoreConfig`); `api?`
  (`experienceBaseUrl`, `insightsBaseUrl`, `enabledFeatures`, `ip`, `plainText`, `preflight`),
  `allowedEventTypes?`, `defaults?` (`consent`, `persistenceConsent`, `profile`, `changes`,
  `selectedOptimizations`), `getAnonymousId?`, `onEventBlocked?`, `queuePolicy?` (`flush`,
  `offlineMaxEvents`, `onOfflineDrop`) — all from `CoreStatefulConfig`.
  source: react-native-sdk#index.ts#OptimizationConfig; core-sdk#CoreStateful.ts#CoreStatefulConfig; core-sdk#CoreBase.ts#CoreConfig; core-sdk#CoreApiConfig.ts#CoreStatefulApiConfig; core-sdk#StatefulDefaults.ts#StatefulDefaults; core-sdk#CoreStateful.ts#QueuePolicy; api-client#ApiClientBase.ts#ApiConfig
- `environment` default: when `environment` is omitted, the API client uses `main`
  (`DEFAULT_ENVIRONMENT`) for Experience/Insights/CDA requests. There is no separate SDK-side
  default; the fallback lives in `api-client` `ApiClientBase`.
  source: api-client#ApiClientBase.ts#DEFAULT_ENVIRONMENT; api-client#ApiClientBase.ts#ApiConfig
- `fetchOptions` shape (`api-client` `ApiConfig`, typed `Omit<ProtectedFetchMethodOptions,
'apiName'>`): `requestTimeout?` (ms, default `3000`), `retries?` (max retry attempts, default `1`),
  `intervalTimeout?` (delay between retries in ms, default `0`), `fetchMethod?` (custom fetch),
  `onRequestTimeout?`, `onFailedAttempt?`. source: api-client#ApiClientBase.ts#ApiConfig; api-client#fetch/createProtectedFetchMethod.ts#ProtectedFetchMethodOptions; api-client#fetch/createTimeoutFetchMethod.ts#TimeoutFetchMethodOptions; api-client#fetch/createRetryFetchMethod.ts#RetryFetchMethodOptions
- Queue/blocked callback argument shapes: `queuePolicy.onOfflineDrop(context)` receives an
  `ExperienceQueueDropContext` object — `{ droppedCount, droppedEvents (oldest-first), maxEvents,
queuedEvents }` — not a single dropped event. `onEventBlocked(event)` receives a `BlockedEvent` —
  `{ reason: 'consent', method: string, args: readonly unknown[] }` (the blocked method name and its
  original call arguments). source: core-sdk#CoreStateful.ts#QueuePolicy; core-sdk#queues/ExperienceQueue.ts#ExperienceQueueDropContext; core-sdk#CoreStateful.ts#CoreStatefulConfig; core-sdk#events/BlockedEvent.ts#BlockedEvent
- `OptimizationRootProps extends CoreStatefulConfig` and adds `liveUpdates?: boolean` (default
  `false`), `trackEntryInteraction?: TrackEntryInteractionOptions` (default `{ views: true,
taps: true }`), `onStatesReady?`, and `children`. `OptimizationRoot` composes
  `OptimizationProvider` + `LiveUpdatesProvider` + `InteractionTrackingProvider`; the extra props are
  stripped and the rest of the config is forwarded to `OptimizationProvider`.
  source: react-native-sdk#components/OptimizationRoot.tsx#OptimizationRootProps; react-native-sdk#components/OptimizationRoot.tsx#OptimizationRoot; react-native-sdk#context/InteractionTrackingContext.tsx#TrackEntryInteractionOptions
- `OptimizationProvider` props are a union: config form (`OptimizationProviderConfigProps extends
OptimizationConfig`, `sdk?: never`) or injected form (`OptimizationProviderSdkProps`, `sdk:
OptimizationSdk`). `onStatesReady(states)` runs once after state init and before children mount;
  returning a function registers a teardown cleanup.
  source: react-native-sdk#components/OptimizationProvider.tsx#OptimizationProviderConfigProps; react-native-sdk#components/OptimizationProvider.tsx#OptimizationProviderSdkProps; react-native-sdk#components/OptimizationProvider.tsx#OnStatesReady
- `ContentfulOptimization.create(config)` merges RN defaults over the caller config: `eventBuilder`
  `channel: 'mobile'` + library name/version; AsyncStorage-backed `defaults` and `getAnonymousId`;
  `logLevel` forced to `debug` when the stored debug flag is set; and `allowedEventTypes` defaulting
  to `['identify', 'screen']` when the caller omits it.
  source: react-native-sdk#ContentfulOptimization.ts#mergeConfig
- Single active instance: `ContentfulOptimization.create` throws `ContentfulOptimization React
Native SDK is already initialized. Reuse the existing instance.` if a live instance already exists.
  `destroy()` (or a failed post-init persistence) clears the singleton so a new instance can be
  created. source: react-native-sdk#ContentfulOptimization.ts#ContentfulOptimization
- Managed entry fetching: `contentful?: ContentfulConfig` (`{ client, defaultQuery?, cache? }`) on
  the root/provider config enables `<OptimizedEntry entryId>` / `useOptimizedEntry({ entryId })` to
  fetch by ID through the app's `contentful.js` client. See
  [`../shared/concepts.md`](../shared/concepts.md#entry-source-boundary-managed-or-manual) for the
  managed-vs-manual boundary, cache defaults (`{ maxEntries: 100, ttlMs: 300_000 }`), and query
  merge (`defaultQuery` + per-call + SDK-locale fallback + `include: 10`).
  source: core-sdk#CoreBase.ts#ContentfulConfig; core-sdk#CoreBase.ts#ContentfulEntryClient; core-sdk#CoreBase.ts#fetchContentfulEntry

## Components & hooks

| Name                                   | Kind      | Import path | Key props/args                                                                                                                                                                                                                                                                                                                                     | Returns                                                                                                                                              | source                                                                                                                                                                                                  |
| -------------------------------------- | --------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OptimizationRoot`                     | component | root        | `CoreStatefulConfig` + `liveUpdates?`, `trackEntryInteraction?`, `onStatesReady?`, `children`                                                                                                                                                                                                                                                      | provider tree element                                                                                                                                | react-native-sdk#components/OptimizationRoot.tsx#OptimizationRoot                                                                                                                                       |
| `OptimizationProvider`                 | provider  | root        | config OR `sdk={instance}`; `onStatesReady?`                                                                                                                                                                                                                                                                                                       | `null` while provider-owned init pending, else context provider element                                                                              | react-native-sdk#components/OptimizationProvider.tsx#OptimizationProvider                                                                                                                               |
| `LiveUpdatesProvider`                  | provider  | root        | `globalLiveUpdates?`, `children`                                                                                                                                                                                                                                                                                                                   | context provider element                                                                                                                             | react-native-sdk#context/LiveUpdatesContext.tsx#LiveUpdatesProvider                                                                                                                                     |
| `OptimizedEntry`                       | component | root        | discriminated union `baselineEntry` (manual) XOR `entryId` (+`entryQuery?`, managed); render-prop OR static `children`; `loadingFallback?`, `errorFallback?`, `onEntryError?`, `onEntryResolved?`, `liveUpdates?`, `trackViews?`, `trackTaps?`, `onTap?`, `dwellTimeMs?`, `minVisibleRatio?`, `viewDurationUpdateIntervalMs?`, `style?`, `testID?` | `View` element, or `null`/fallback                                                                                                                   | react-native-sdk#components/OptimizedEntry.tsx#OptimizedEntry; react-native-sdk#components/OptimizedEntry.tsx#OptimizedEntryProps                                                                       |
| `OptimizationScrollProvider`           | provider  | root        | `ScrollViewProps` + `children` (wraps a `ScrollView`)                                                                                                                                                                                                                                                                                              | `ScrollView` wrapped in scroll context                                                                                                               | react-native-sdk#context/OptimizationScrollContext.tsx#OptimizationScrollProvider                                                                                                                       |
| `OptimizationNavigationContainer`      | component | root        | render prop receiving `{ ref, onReady, onStateChange }`; `onReady?`, `onStateChange?`, `includeParams?` (default `false`)                                                                                                                                                                                                                          | rendered children                                                                                                                                    | react-native-sdk#components/OptimizationNavigationContainer.tsx#OptimizationNavigationContainer                                                                                                         |
| `useOptimization`                      | hook      | root        | —                                                                                                                                                                                                                                                                                                                                                  | `OptimizationSdk` instance; **throws** outside a provider, or if init failed / still initializing                                                    | react-native-sdk#context/OptimizationContext.tsx#useOptimization                                                                                                                                        |
| `useOptimizedEntry`                    | hook      | root        | same union as `OptimizedEntry` + `liveUpdates?`, `onEntryError?`, `onEntryResolved?`                                                                                                                                                                                                                                                               | `{ entry, baselineEntry, error?, isLoading, isPresentationReady, isResolved, metadata?, selectedOptimization, resolvedData, selectedOptimizations }` | react-native-sdk#hooks/useOptimizedEntry.ts#useOptimizedEntry; react-native-sdk#hooks/useOptimizedEntry.ts#UseOptimizedEntryResult                                                                      |
| `useEntryResolver`                     | hook      | root        | —                                                                                                                                                                                                                                                                                                                                                  | `{ resolveEntry, resolveEntryData, resolveOptimizedEntry }` (manual-only helpers; default `selectedOptimizations` = current SDK state)               | react-native-sdk#hooks/useEntryResolver.ts#useEntryResolver; react-native-sdk#hooks/useEntryResolver.ts#UseEntryResolverResult                                                                          |
| `useScreenTracking`                    | hook      | root        | `{ name, properties?, trackOnMount? (default true) }`                                                                                                                                                                                                                                                                                              | `{ trackScreen: () => Promise<EventEmissionResult> }`                                                                                                | react-native-sdk#hooks/useScreenTracking.ts#useScreenTracking; react-native-sdk#hooks/useScreenTracking.ts#UseScreenTrackingOptions                                                                     |
| `useScreenTrackingCallback`            | hook      | root        | —                                                                                                                                                                                                                                                                                                                                                  | `(name, properties?) => void` (imperative direct `screen()` emit)                                                                                    | react-native-sdk#hooks/useScreenTracking.ts#useScreenTrackingCallback                                                                                                                                   |
| `useViewportTracking`                  | hook      | root        | `{ entry, selectedOptimization?, optimizationContextId?, minVisibleRatio?, dwellTimeMs?, viewDurationUpdateIntervalMs?, enabled? }`                                                                                                                                                                                                                | `{ isVisible, onLayout }`                                                                                                                            | react-native-sdk#hooks/useViewportTracking.ts#useViewportTracking; react-native-sdk#hooks/useViewportTracking.ts#UseViewportTrackingOptions                                                             |
| `useTapTracking`                       | hook      | root        | `{ entry, selectedOptimization?, optimizationContextId?, enabled, onTap? }`                                                                                                                                                                                                                                                                        | `{ onTouchStart, onTouchEnd }` (both `undefined` when disabled)                                                                                      | react-native-sdk#hooks/useTapTracking.ts#useTapTracking; react-native-sdk#hooks/useTapTracking.ts#UseTapTrackingOptions                                                                                 |
| `useLiveUpdates`                       | hook      | root        | —                                                                                                                                                                                                                                                                                                                                                  | `LiveUpdatesContextValue` (`{ globalLiveUpdates, previewPanelVisible, setPreviewPanelVisible }`) or `null`                                           | react-native-sdk#context/LiveUpdatesContext.tsx#useLiveUpdates                                                                                                                                          |
| `useScrollContext`                     | hook      | root        | —                                                                                                                                                                                                                                                                                                                                                  | `{ scrollY, viewportHeight }` or `null`                                                                                                              | react-native-sdk#context/OptimizationScrollContext.tsx#useScrollContext                                                                                                                                 |
| `useInteractionTracking`               | hook      | root        | —                                                                                                                                                                                                                                                                                                                                                  | `{ views, taps }` resolved booleans                                                                                                                  | react-native-sdk#context/InteractionTrackingContext.tsx#useInteractionTracking                                                                                                                          |
| `PreviewPanel` / `PreviewPanelOverlay` | component | `/preview`  | `{ contentfulClient, onRefresh?, showHeader?, style?, onVisibilityChange? }`; overlay adds `fabPosition?` and omits `style`                                                                                                                                                                                                                        | panel / floating-button + modal element                                                                                                              | react-native-sdk#preview/components/PreviewPanel.tsx#PreviewPanel; react-native-sdk#preview/components/PreviewPanelOverlay.tsx#PreviewPanelOverlay; react-native-sdk#preview/types.ts#PreviewPanelProps |

There is no `useOptimizationConsentState` public hook; consent-state subscription is an internal
helper (`useOptimizationConsentState`) used by the tracking hooks to re-check `hasConsent()` when
consent changes. source: react-native-sdk#hooks/useOptimizationConsentState.ts#useOptimizationConsentState

## Render / entry resolution

- Entry source (managed or manual): `OptimizedEntry` / `useOptimizedEntry` take a discriminated
  union — `baselineEntry` (app fetched: manual) XOR `entryId` + optional `entryQuery` (SDK fetches
  via `contentful.client`: managed), never both. Managed fetch is driven by
  `OptimizedEntrySourceController`; without `contentful.client` the managed path has no client. See
  [`../shared/concepts.md`](../shared/concepts.md#entry-source-boundary-managed-or-manual).
  source: react-native-sdk#components/OptimizedEntry.tsx#OptimizedEntryProps; react-native-sdk#hooks/useOptimizedEntry.ts#UseOptimizedEntryParams; core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceController
- Render prop = `(resolvedEntry: Entry, metadata: OptimizedEntryMetadata) => ReactNode`;
  `resolvedEntry` is a base `contentful` `Entry` (cast to a narrower type in app code). `metadata`
  carries `baselineEntry`, `baselineEntryId`, `entry`, `entryId`, `optimizationContextId`,
  `resolvedData`, `selectedOptimization`, `selectedOptimizations`. Static (non-function) children are
  rendered as-is (tracking only, no variant data).
  source: react-native-sdk#components/OptimizedEntry.tsx#OptimizedEntryProps; core-sdk#OptimizedEntryMetadata.ts#OptimizedEntryMetadata
- Loading model (RN, no server first paint): while a managed `entryId` fetch is unresolved,
  `useOptimizedEntry` returns `entry === undefined` / `metadata === undefined`, so `OptimizedEntry`
  renders `loadingFallback`. On resolved data it wraps children in a `View` carrying `onLayout`
  (viewport tracking) and `onTouchStart`/`onTouchEnd` (tap tracking). There is no fixed
  baseline-reveal timeout (unlike the web SDK).
  source: react-native-sdk#components/OptimizedEntry.tsx#OptimizedEntry; react-native-sdk#hooks/useOptimizedEntry.ts#useOptimizedEntry
- Resolution itself: non-optimized entries pass through unchanged; optimized entries
  (`isResolvedOptimizedEntry`) resolve via `sdk.resolveOptimizedEntry(baselineEntry,
selectedOptimizations)`. Single-locale CDA contract and baseline fallback are shared: see
  [`../shared/concepts.md`](../shared/concepts.md#entry-resolution) and
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
  source: react-native-sdk#hooks/useOptimizedEntry.ts#useOptimizedEntry; core-sdk#CoreBase.ts#resolveOptimizedEntry; concept:entry-personalization-and-variant-resolution
- `useEntryResolver` returns manual-only helpers (`resolveEntry` → resolved `Entry`;
  `resolveEntryData`/`resolveOptimizedEntry` → full `ResolvedData`). When `selectedOptimizations` is
  omitted, helpers use the current `sdk.states.selectedOptimizations.current`.
  source: react-native-sdk#hooks/useEntryResolver.ts#useEntryResolver
- Include-depth requirement (resolver-driven): the resolver reads SDK-fixed Optimization fields off
  the fetched entry, so the fetch (managed or manual) needs `include` deep enough to resolve them.
  Chain: the optimized entry's `nt_experiences` array (→ `nt_experience` content-type entries), and
  within each of those the linked `nt_variants` array (→ variant entries, the app's own content
  type) and `nt_audience` link (→ `nt_audience` content-type entry). `nt_config` is a JSON/object
  field on the `nt_experience` entry (not a linked entry, so it does not consume include depth). The
  managed path sends `include: 10` by default; a manual fetch must set a comparable depth.
  source: core-sdk#resolvers/OptimizedEntryResolver.ts#OptimizedEntryResolver; api-schemas#contentful/OptimizedEntry.ts#OptimizedEntryFields; api-schemas#contentful/OptimizationEntry.ts#OptimizationEntryFields

## Identifier ownership

| Identifier                                                                                                                                          | Owner  | Notes                                                                                                                                                                                                                                                                                                                                          | source                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__ctfl_opt_anonymous_id__` (AsyncStorage)                                                                                                          | SDK    | Anonymous/profile id. Written only when `persistenceConsent === true`; the default `getAnonymousId` reads it only then, else returns `undefined`. Set to `profile.id` on continuity writes.                                                                                                                                                    | react-native-sdk#storage/AsyncStorageStore.ts#AsyncStorageStore; core-sdk#constants.ts#ANONYMOUS_ID_KEY; react-native-sdk#ContentfulOptimization.ts#mergeConfig                                           |
| `__ctfl_opt_consent__`, `__ctfl_opt_persistence_consent__`, `__ctfl_opt_debug__` (AsyncStorage)                                                     | SDK    | Consent state; persisted on every consent change (debug flag also toggles `logLevel` to `debug`).                                                                                                                                                                                                                                              | react-native-sdk#storage/AsyncStorageStore.ts#AsyncStorageStore; core-sdk#constants.ts#CONSENT_KEY; core-sdk#constants.ts#PERSISTENCE_CONSENT_KEY; core-sdk#constants.ts#DEBUG_FLAG_KEY                   |
| `__ctfl_opt_profile__`, `__ctfl_opt_changes__`, `__ctfl_opt_selected-optimizations__` (AsyncStorage)                                                | SDK    | Profile-continuity cache; loaded/written only when `persistenceConsent === true`, cleared when it is `false`.                                                                                                                                                                                                                                  | react-native-sdk#storage/AsyncStorageStore.ts#AsyncStorageStore; core-sdk#constants.ts#PROFILE_CACHE_KEY; core-sdk#constants.ts#CHANGES_CACHE_KEY; core-sdk#constants.ts#SELECTED_OPTIMIZATIONS_CACHE_KEY |
| app-owned anonymous id                                                                                                                              | reader | Optional `getAnonymousId` config lets the app supply an approved anonymous id instead of the AsyncStorage default.                                                                                                                                                                                                                             | core-sdk#CoreStateful.ts#CoreStatefulConfig                                                                                                                                                               |
| consent record / CMP choice                                                                                                                         | reader | App records the user's choice and calls `consent(...)`; SDK reflects only what is passed.                                                                                                                                                                                                                                                      | concept:consent-management-in-the-optimization-sdk-suite; core-sdk#CoreStateful.ts#consent                                                                                                                |
| `nt_experience`, `nt_audience` (Contentful content types); `nt_experiences`, `nt_variants`, `nt_audience`, `nt_config`, `nt_experience_id` (fields) | SDK    | SDK-fixed Optimization content-model identifiers the resolver keys off — not reader-chosen. `nt_experiences` is the array field on an optimized entry linking `nt_experience` entries; each `nt_experience` carries `nt_variants` (variant links), `nt_audience` (link to an `nt_audience` entry), `nt_config` (JSON), and `nt_experience_id`. | api-schemas#contentful/OptimizedEntry.ts#OptimizedEntrySkeleton; api-schemas#contentful/OptimizationEntry.ts#OptimizationEntrySkeleton; api-schemas#contentful/AudienceEntry.ts#AudienceEntrySkeleton     |

RN uses AsyncStorage keys (`ctfl-opt-*` prefixed with `__…__`), not the browser `ctfl-opt-aid`
cookie the web SDKs use; there is no built-in cross-platform cookie handoff.
source: core-sdk#constants.ts#ANONYMOUS_ID_KEY; core-sdk#constants.ts#ANONYMOUS_ID_COOKIE

## Events & tracking

- Screen events: `useScreenTracking({ name })` auto-tracks on mount (unless `trackOnMount: false`)
  via `trackCurrentScreen`, which dedupes by `routeKey` (defaults to `screen.name`/`name`) through
  an `AcceptedCurrentStateTracker` — a repeat of the same current screen is skipped. The returned
  `trackScreen()` and `useScreenTrackingCallback()` call `screen()` directly (no dedupe).
  source: react-native-sdk#hooks/useScreenTracking.ts#useScreenTracking; react-native-sdk#ContentfulOptimization.ts#TrackCurrentScreenPayload; core-sdk#tracking/AcceptedCurrentStateTracker.ts#AcceptedCurrentStateTracker
- `OptimizationNavigationContainer` calls `trackCurrentScreen` on ready and on route-key change; it
  builds `routeKey` from the screen name, appending JSON-validated params only when
  `includeParams` is true. It skips tracking when `hasConsent('screen')` is false and re-tracks the
  current route when consent changes. source: react-native-sdk#components/OptimizationNavigationContainer.tsx#OptimizationNavigationContainer; react-native-sdk#components/OptimizationNavigationContainer.tsx#createScreenTrackingDescriptor
- Entry view tracking (`useViewportTracking`): defaults `minVisibleRatio = 0.8`, `dwellTimeMs =
2000`, `viewDurationUpdateIntervalMs = 5000`. Lifecycle per visibility cycle: initial `trackView`
  after accumulated visible time ≥ `dwellTimeMs`, periodic duration updates every
  `viewDurationUpdateIntervalMs`, and a final event on visibility end (only if ≥1 event already
  fired). Visibility uses `useScrollContext` when present, else screen `Dimensions` (assumes
  `scrollY = 0`, screen height as viewport). Time accumulation pauses on `AppState` background/
  inactive; a final event is emitted when backgrounded mid-cycle. Consent-gated by
  `hasConsent('trackView')`. source: react-native-sdk#hooks/useViewportTracking.ts#useViewportTracking; core-sdk#tracking/EntryViewTracking.ts#resolveEntryViewTimingOptions; core-sdk#tracking/EntryViewTracking.ts#getRemainingMsUntilNextEntryViewFire
- Entry tap tracking (`useTapTracking`): uses `onTouchStart`/`onTouchEnd` (not a wrapping
  `Pressable`) so taps register even when a child handles the gesture; a touch counts as a tap only
  when movement `< TAP_DISTANCE_THRESHOLD` (10 points). Emits wire type `component_click` via
  `trackClick` when `hasConsent('trackClick')`, then calls `onTap(resolvedEntry)` if provided.
  source: react-native-sdk#hooks/useTapTracking.ts#useTapTracking; react-native-sdk#hooks/useTapTracking.ts#TAP_DISTANCE_THRESHOLD
- Interaction defaults/overrides: `OptimizedEntry` view+tap tracking is on by default. Global
  opt-out via `OptimizationRoot` `trackEntryInteraction={{ views?, taps? }}` (RN uses `taps`, not
  `clicks`, and has no hovers); per-entry `trackViews`/`trackTaps` override, and supplying `onTap`
  keeps taps enabled unless `trackTaps` is explicitly `false`. Tracking uses the RESOLVED entry id
  and the runtime-owned `optimizationContextId`.
  source: react-native-sdk#context/InteractionTrackingContext.tsx#TrackEntryInteractionOptions; react-native-sdk#components/OptimizedEntry.tsx#OptimizedEntry; react-native-sdk#context/InteractionTrackingContext.tsx#EntryInteraction
- `identify({ userId, traits? })`: inherited from Core (`CoreStatefulEventEmitter.identify`), returns
  `Promise<EventEmissionResult>`. Arg is `IdentifyBuilderArgs & { profile? }`: `userId` (required
  string), optional `traits` (record, merged server-side), plus the universal event fields
  (`campaign?`, `locale?`, `location?`, `page?`, `screen?`, `userAgent?`). `identify` is in the RN
  default pre-consent allow-list, so it emits before event consent.
  source: core-sdk#CoreStatefulEventEmitter.ts#CoreStatefulEventEmitter; core-sdk#events/EventBuilder.ts#IdentifyBuilderArgs; core-sdk#events/EventBuilder.ts#UniversalEventBuilderArgs
- Analytics forwarding: subscribe via `onStatesReady` (registers before child effects emit). Read
  `states.eventStream` for accepted events (dedupe by `messageId`) and `states.blockedEventStream`
  for consent/allow-list diagnostics. Flags: `states.flag(name)` is a reactive observable;
  `getFlag(name)` a non-reactive read. source: core-sdk#CoreStateful.ts#CoreStates; core-sdk#CoreStatefulEventEmitter.ts#getFlag
- Experience-response payload: an accepted Experience call returns the `{ profile,
selectedOptimizations, changes }` payload, and this stateful SDK applies it to its Core signals
  (`signals.profile`, `signals.selectedOptimizations`, `signals.changes`) — the origin of the profile
  and the changes the SDK surfaces. See
  [`../shared/concepts.md`](../shared/concepts.md#experience-response-payload).
  source: core-sdk#state/applyOptimizationDataToSignals.ts#applyOptimizationDataToSignals; core-sdk#CoreStateful.ts#CoreStates

## Consent & persistence

- Model: two independent axes `consent` (may personalize + emit events) and `persistenceConsent`
  (may store profile-continuity), see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence).
  Boolean `consent(true|false)` sets both axes; object form `consent({ events?, persistence? })` sets
  them independently (accepts `ConsentInput`). `resolveStatefulDefaults` derives
  `persistenceConsent` from `defaults.persistenceConsent ?? defaults.consent`.
  source: core-sdk#CoreStateful.ts#consent; core-sdk#consent/Consent.ts#ConsentInput; core-sdk#StatefulDefaults.ts#resolveStatefulDefaults
- RN default pre-consent allow-list = `['identify', 'screen']` (set in `mergeConfig`, overriding
  Core's fail-closed `DEFAULT_ALLOWED_EVENT_TYPES = []`). Before event consent, `identify` and
  `screen` emit; entry views (`component`), entry taps (`component_click`), `page`, and custom
  `track` are blocked until consent is accepted or their selectors are allow-listed. `hasConsent`
  maps `trackView`→`component`, `trackClick`→`component_click`.
  source: react-native-sdk#ContentfulOptimization.ts#mergeConfig; core-sdk#events/EventType.ts#DEFAULT_ALLOWED_EVENT_TYPES; core-sdk#consent/ConsentPolicy.ts#hasEventConsent
- AsyncStorage always persists consent state (consent, persistence consent, debug flag). It persists
  profile-continuity (anonymous id, profile, changes, selected optimizations) only when
  `persistenceConsent === true`, and clears it when `false`. It does NOT persist event queues (queues
  are in-memory). `consent(...)` and `reset()`/`destroy()` enqueue the appropriate persistence
  writes; `reset()` also clears profile continuity and the current-screen dedupe tracker.
  source: react-native-sdk#storage/AsyncStorageStore.ts#AsyncStorageStore; react-native-sdk#ContentfulOptimization.ts#ContentfulOptimization
- Persisted consent is decoded via `decodeConsentStorageValue`; persisted persistence-consent falls
  back to the persisted event consent through `resolvePersistedPersistenceConsent`.
  source: core-sdk#consent/ConsentStorage.ts#decodeConsentStorageValue; core-sdk#consent/ConsentStorage.ts#resolvePersistedPersistenceConsent
- AsyncStorage is read only during startup: `AsyncStorage.multiGet` runs only in
  `initializeConsentState` / `initializeProfileContinuity` (each guarded by a one-shot initialized
  flag, invoked from `mergeConfig` during `create`). After startup, live SDK state comes from Core
  signals (`signals.consent`, `signals.profile`, `signals.selectedOptimizations`, `signals.changes`);
  the store's getters read only its in-memory `cache` Map. State changes write through to
  AsyncStorage but runtime reads never hit it.
  source: react-native-sdk#storage/AsyncStorageStore.ts#AsyncStorageStore; react-native-sdk#ContentfulOptimization.ts#mergeConfig; core-sdk#CoreStateful.ts#CoreStates

## Version / runtime quirks

- No server first paint: an owned instance is created after React commits (async, reads AsyncStorage
  first), so the SDK is not ready on the first render. Provider-owned `OptimizationProvider` returns
  `null` (withholds children) until the instance is ready or init errored. An injected `sdk` with no
  `onStatesReady` is ready from the first render.
  source: react-native-sdk#components/OptimizationProvider.tsx#OptimizationProvider
- Instance ownership: `OptimizationProvider` `destroy()`s on unmount only an instance it created
  itself (`ownsSdkRef` is set only on the `ContentfulOptimization.create` path). An injected
  `sdk={instance}` is NOT destroyed by the provider — the owner that created it must call `destroy()`
  (which clears the singleton so a new instance can be created).
  source: react-native-sdk#components/OptimizationProvider.tsx#OptimizationProvider; react-native-sdk#ContentfulOptimization.ts#ContentfulOptimization
- Config is captured on first render EXCEPT `locale`: changing the provider `locale` prop calls
  `sdk.setLocale(nextLocale)`, updating Experience API and event locale. The SDK does NOT refetch
  Contentful entries or refresh profile state; the app re-fetches and re-emits. Full re-init requires
  changing the React `key`. source: react-native-sdk#components/OptimizationProvider.tsx#OptimizationProvider; core-sdk#CoreStateful.ts#setLocale
- Live-update precedence: preview panel open → per-entry `liveUpdates` prop → root `liveUpdates`
  prop → default locked-to-first-variant. Opening `PreviewPanelOverlay` sets
  `previewPanelVisible`, forcing live updates while open. See
  [`../shared/concepts.md`](../shared/concepts.md#live-updates).
  source: react-native-sdk#hooks/useOptimizedEntry.ts#useOptimizedEntry; react-native-sdk#preview/components/PreviewPanelOverlay.tsx#PreviewPanelOverlay
- Peer dependencies: `@react-native-async-storage/async-storage` is required (imported directly by
  the storage adapter); `@react-native-community/netinfo`, `@react-native-clipboard/clipboard`, and
  `react-native-safe-area-context` are optional (`peerDependenciesMeta.optional`).
  source: react-native-sdk#storage/AsyncStorageStore.ts#AsyncStorageStore; extern:@contentful/optimization-react-native package.json peerDependenciesMeta marks netinfo, clipboard, safe-area-context optional
- Offline detection is opt-in via NetInfo: `createOnlineChangeListener` dynamically imports
  `@react-native-community/netinfo`; when present it gates flushing on connectivity
  (`isInternetReachable ?? isConnected ?? true`); when absent it logs
  `@react-native-community/netinfo not installed. Offline detection disabled.` and no-ops. Offline
  replay is in-memory only (no durable outbox). source: react-native-sdk#handlers/createOnlineChangeListener.ts#createOnlineChangeListener
- Background flush: `createAppStateChangeListener` calls the SDK's `flush()` then drains pending
  AsyncStorage writes on `AppState` `background`/`inactive`, before the OS can suspend the process.
  source: react-native-sdk#handlers/createAppStateChangeListener.ts#createAppStateChangeListener; react-native-sdk#ContentfulOptimization.ts#ContentfulOptimization
- Polyfills: importing the package entry runs side-effect imports for `crypto.randomUUID`
  (`react-native-get-random-values` + `react-native-uuid`) and ES2025 iterator helpers, plus a
  `*.png` module declaration. source: react-native-sdk#index.ts#OptimizationConfig; react-native-sdk#polyfills/crypto.ts
- Preview panel: `PreviewPanelOverlay`/`PreviewPanel` are on the `/preview` subpath, need the
  optional clipboard + safe-area peers, and fetch `nt_audience`/`nt_experience` entries through the
  supplied `contentfulClient`. Expo apps require a custom dev build (`expo run:ios`/`expo
run:android`) — Expo Go cannot load the native preview modules.
  source: react-native-sdk#preview/components/PreviewPanelOverlay.tsx#PreviewPanelOverlay; react-native-sdk#preview/types.ts#PreviewPanelProps; extern:Expo Go cannot load the custom native modules the preview panel needs, so Expo apps require a custom dev build
- Android emulator localhost: the SDK itself has no localhost rewrite; the reference implementation
  rewrites `localhost` API hosts to `10.0.2.2` (`ANDROID_LOCALHOST`) only when `Platform.OS ===
'android'`. On iOS the URL is left unchanged, because the iOS Simulator shares the host machine's
  network and reaches host `localhost` directly. source: impl:react-native-sdk#env.config.ts; extern:the iOS Simulator uses the host machine network directly, so host localhost resolves without a rewrite

## Failure & fallback behavior

- Baseline fallback when event policy produced no selections / no matching variant / unresolved
  links / all-locale payloads: the render prop receives the baseline entry and the UI does not break. See
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
  source: react-native-sdk#hooks/useOptimizedEntry.ts#useOptimizedEntry; concept:entry-personalization-and-variant-resolution
- Managed-fetch failure: when `entryId` is used and `fetchContentfulEntry` rejects, the source
  snapshot carries `error`; `onEntryError(error)` fires once and `OptimizedEntry` renders
  `errorFallback` (distinct from baseline fallback, which is a resolution outcome on a present
  entry). source: core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceSnapshot; react-native-sdk#components/OptimizedEntry.tsx#OptimizedEntry
- SDK init failure: `OptimizationProvider` renders children with an `error` in context;
  `useOptimization()` (and any tracking hook that calls it) throws
  `ContentfulOptimization SDK failed to initialize: …`, so consumers must sit under a provider that
  handles init failure. source: react-native-sdk#components/OptimizationProvider.tsx#OptimizationProvider; react-native-sdk#context/OptimizationContext.tsx#useOptimization
- `PreviewPanelOverlay` throws `PreviewPanelOverlay must be rendered inside OptimizationRoot, or
inside both OptimizationProvider and LiveUpdatesProvider.` when no `LiveUpdatesContext` is present.
  source: react-native-sdk#preview/components/PreviewPanelOverlay.tsx#PreviewPanelOverlay
- AsyncStorage read/write failures are caught and logged; the SDK continues with in-memory state
  (schema-invalid cached values are invalidated and removed).
  source: react-native-sdk#storage/AsyncStorageStore.ts#AsyncStorageStore
