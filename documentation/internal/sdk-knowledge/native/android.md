# Android (`com.contentful.java:optimization-android` Kotlin library) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-optimization-android-sdk-in-a-compose-app.md, documentation/guides/integrating-the-optimization-android-sdk-in-a-views-app.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer verified against
> packages/\*\*/src.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). The concepts they capture — consent/persistence
axes, baseline fallback, entry-source managed-vs-manual, live updates, single-locale entry contract,
experience-response payload — are SDK-neutral and apply to the whole suite via the shared `core-sdk`.

This is a **beta** native Kotlin/Gradle library, not a TypeScript package: its source root is
`packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization` with a
`build.gradle.kts` and no `package.json`/`src/`, so `knowledge:check` has no `android` SDK key and
cannot resolve Kotlin `#symbol` pointers. Kotlin-specific facts therefore use extern-prefixed
pointers whose free text names the exact Kotlin file and symbol; behavior that actually executes in
the shared JS layer uses the real resolvable keys — the js-bridge adapter, the shared core/api
packages, concept docs, the reference implementation, and cross-links into this base. The Android SDK
runs the **same `CoreStateful` runtime as the web/React-Native SDKs** inside a per-client **QuickJS**
context (iOS uses JavaScriptCore), bridged by the TypeScript adapter in
`packages/universal/optimization-js-bridge/src/index.ts`; most optimization/consent/event/queue
behavior parallels [iOS](./ios.md) and [React Native](./react-native.md). Kotlin owns native
concerns: persistence (`SharedPreferences`), networking (`OkHttp`/`ConnectivityManager`), app
lifecycle (`ProcessLifecycleOwner`), Compose + XML Views UI, and preview-panel UI. Android's
behavioral reference is [`concept:android-sdk-runtime-and-interaction-mechanics`](../../concepts/android-sdk-runtime-and-interaction-mechanics.md).

## Package & entry points

One AAR (`com.contentful.java:optimization-android`, Maven Central), `minSdk` 24 / Java 11, with the
QuickJS UMD bundle packaged in the AAR assets. Three Kotlin packages ship in the same artifact; both
guides consume it — Compose apps use `.compose`, XML Views apps use `.views`, and both sit on the
imperative `.core` client.

| Package               | Public symbol or purpose                                                                                                                                                   | source                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compose surface       | `OptimizationRoot`, `OptimizedEntry`, `ScreenTrackingEffect`, `OptimizationLazyColumn`, `Modifier.trackViews`, `Modifier.trackClicks`, composition locals                  | extern:Compose composables/modifiers — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizationRoot.kt#OptimizationRoot; extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizedEntry.kt#OptimizedEntry                                     |
| XML Views surface     | `OptimizationManager` (object singleton), `OptimizedEntryView`, `ScreenTracker` (object), `TrackingRecyclerView`                                                           | extern:OptimizationManager application-scoped singleton facade — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizationManager.kt#OptimizationManager; extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizedEntryView.kt#OptimizedEntryView |
| Imperative client     | `OptimizationClient` (state as `StateFlow`/`SharedFlow`); `EventEmissionResult`                                                                                            | extern:OptimizationClient is the stateful facade wrapping the QuickJS bridge — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient                                                                                                                                 |
| Config                | `OptimizationConfig`, `OptimizationApiConfig`, `StorageDefaults`, `OptimizationLogLevel`, `QueuePolicy`, `QueueFlushPolicy`, `QueueEvent`/`QueueEventType`, `BlockedEvent` | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationConfig.kt#OptimizationConfig; extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationConfig.kt#StorageDefaults                                                                  |
| Event payloads        | `IdentifyPayload`, `PageEventPayload`, `ScreenEventPayload`, `TrackEventPayload`, `TrackViewPayload`, `TrackClickPayload`                                                  | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/EventPayloads.kt#ScreenEventPayload; extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/TrackViewPayload.kt#TrackViewPayload                                                                        |
| State / result types  | `OptimizationState`, `ResolvedOptimizedEntry`, `PreviewState` (+ DTOs), `JSONValue`, `OptimizationError`                                                                   | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationState.kt#OptimizationState; extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationError.kt#OptimizationError                                                                   |
| Tracking (imperative) | `ViewTrackingController`, `TrackingMetadata` (both `internal`)                                                                                                             | extern:ViewTrackingController is the internal view-timing engine both adapters build on — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/tracking/ViewTrackingController.kt#ViewTrackingController                                                                                                          |
| Preview panel         | `PreviewPanelConfig`, `PreviewPanelOverlay` (Compose), `PreviewContentfulClient`/`ContentfulHTTPPreviewClient`, `PreviewPanelActivity` (non-exported)                      | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/preview/PreviewPanelConfig.kt#PreviewPanelConfig; extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/preview/PreviewContentfulClient.kt#ContentfulHTTPPreviewClient                                           |

- The AAR manifest declares `INTERNET` + `ACCESS_NETWORK_STATE` permissions and the `PreviewPanelActivity`
  as `android:exported="false"`; no bridge setup is required in consuming apps (the QuickJS bundle
  ships inside the AAR assets). source: extern:library manifest declares network permissions + non-exported preview Activity — packages/android/ContentfulOptimization/src/main/AndroidManifest.xml
- Every optimization/consent/event/queue call ultimately runs `CoreStateful` through the bridge's
  `globalThis.__bridge`; the Kotlin `OptimizationClient` is a thin native facade over it.
  source: optimization-js-bridge#index.ts#Bridge; core-sdk#CoreStateful.ts#CoreStatefulConfig

## Setup / factory

- Two usage modes for one client. **Compose**: `OptimizationRoot(config, …)` owns the client
  (`remember { OptimizationClient(...) }`), calls `initialize(config)` in a `LaunchedEffect`, provides
  it via `LocalOptimizationClient` plus a `LocalTrackingConfig`, and renders a
  `CircularProgressIndicator()` gate until `client.isInitialized`. **XML Views**: the app calls
  `OptimizationManager.initialize(context, config, …)` (typically from `Application.onCreate`) and
  reads `OptimizationManager.client` from activities/fragments. source: extern:OptimizationRoot remember + LaunchedEffect initialize + progress gate — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizationRoot.kt#OptimizationRoot; impl:android-sdk#compose/src/main/kotlin/com/contentful/optimization/app/MainActivity.kt; impl:android-sdk#views/src/main/kotlin/com/contentful/optimization/app/views/MainActivity.kt
- `initialize(config)` is a **`suspend` function** (Android diverges from iOS's synchronous-throws
  init): it loads persisted consent, resolves defaults, evaluates the UMD bundle and runs bridge init
  on the dedicated QuickJS dispatcher, then flips `isInitialized`. Compose calls it inside a
  `LaunchedEffect`; `OptimizationManager.initialize` launches it fire-and-forget on an internal
  `SupervisorJob + Dispatchers.Main` scope, so Views callers making direct suspend calls must first
  await `OptimizationManager.client.isInitialized.first { it }`. source: extern:initialize is suspend and runs bridge init on the QuickJS dispatcher — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; extern:OptimizationManager.initialize launches initialize on an internal scope — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizationManager.kt#OptimizationManager
- `OptimizationManager` is an **application-scoped object singleton**: `initialize(...)` is idempotent
  — the first call constructs and initializes the client, later calls only update the global
  `trackViews`/`trackTaps`/`liveUpdates` defaults and the retained preview `contentfulClient`, and do
  not recreate the client. `client` throws (with the same "wrap in OptimizationRoot / call
  OptimizationManager.initialize" message the Compose `LocalOptimizationClient` default uses) if read
  before `initialize`. source: extern:OptimizationManager.initialize idempotent, retains preview client, updates global defaults — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizationManager.kt#OptimizationManager
- Startup state resolution order in `initialize`: (1) `store.loadConsentState()` reads persisted
  consent from `SharedPreferences`; (2) `resolveStatefulDefaults(configured, persisted)` merges
  configured over persisted; (3) profile-continuity is loaded from disk **only** when the resolved
  `persistenceConsent == true` (`canLoadPersistedContinuity`), otherwise continuity is cleared when it
  resolves to `false`; (4) the merged `defaults` plus a separate `anonymousId` are serialized into the
  bridge config. source: extern:initialize resolves consent → resolveStatefulDefaults → conditional profile-continuity load — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; extern:resolveStatefulDefaults + canLoadPersistedContinuity — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/StatefulPolicy.kt#resolveStatefulDefaults
- `OptimizationConfig`: `clientId` required; `environment` has a **Kotlin-side default `"main"`** in
  the data class (unlike the JS SDKs, which fall back to the api-client `DEFAULT_ENVIRONMENT`);
  `logLevel` default `OptimizationLogLevel.error`; `locale`, `api`
  (`experienceBaseUrl`/`insightsBaseUrl`/`enabledFeatures`/`preflight`), `allowedEventTypes`,
  `queuePolicy`, `defaults: StorageDefaults`, `onEventBlocked` all optional/nullable.
  source: extern:environment default "main", logLevel default error, clientId required — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationConfig.kt#OptimizationConfig
- `config.toJSON(anonymousId)` serializes to the bridge `BridgeConfig` shape, omitting null URLs and
  empty sub-objects (`api`/`queuePolicy` skipped when empty; `defaults` object emitted only when
  non-empty); the bridge maps it into `CoreStatefulConfig` via `resolveStatefulDefaults`, defaulting
  `allowedEventTypes` to `DEFAULT_NATIVE_ALLOWED_EVENT_TYPES` and installing `queuePolicy` callbacks
  that push back through `__nativeOnQueueEvent`. source: extern:OptimizationConfig.toJSON → BridgeConfig — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationConfig.kt#OptimizationConfig; optimization-js-bridge#index.ts#BridgeConfig; optimization-js-bridge#index.ts#initialize
- `StorageDefaults` are startup defaults, not one-time seeds: configured values take precedence over
  persisted `SharedPreferences` values every launch, so a configured `consent`/`persistenceConsent`
  can replace a stored choice. Apps that persist user choices leave these unset and call `consent(...)`
  from resolved app policy instead. source: extern:StorageDefaults precedence resolved in resolveStatefulDefaults — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/StatefulPolicy.kt#resolveStatefulDefaults; concept:android-sdk-runtime-and-interaction-mechanics
- Locale is normalized before init: `normalizeLocale` trims, maps `_`→`-`, and rejects empty / `*` /
  `und` / non-BCP-47-shaped values; an explicit invalid `locale` (config or `setLocale`) **throws**
  `OptimizationError.ConfigError` rather than being silently dropped. source: extern:normalizeLocale + normalizeExplicitLocale throw ConfigError on invalid — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationConfig.kt#normalizedLocale; concept:locale-handling-in-the-optimization-sdk-suite

## Components & hooks

For Android these are Compose composables/modifiers, XML Views classes, and the imperative
`OptimizationClient`. Read exact signatures from the Kotlin types; below is a navigation index with
behavioral facts as sourced bullets.

| Name                                   | Kind                                                                   | source                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OptimizationRoot`                     | Compose root composable                                                | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizationRoot.kt#OptimizationRoot                                                                                                                                      |
| `OptimizedEntry`                       | Compose composable (render lambda)                                     | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizedEntry.kt#OptimizedEntry                                                                                                                                          |
| `ScreenTrackingEffect`                 | Compose effect                                                         | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/ScreenTrackingEffect.kt#ScreenTrackingEffect                                                                                                                              |
| `OptimizationLazyColumn`               | Compose scroll wrapper providing `ScrollContext`                       | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizationLazyColumn.kt#OptimizationLazyColumn                                                                                                                          |
| `Modifier.trackViews` / `.trackClicks` | Compose modifiers wiring view/tap tracking                             | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/ViewTrackingLayout.kt#trackViews; extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/ClickTrackingModifier.kt#trackClicks |
| `OptimizationManager`                  | XML Views app-scoped singleton                                         | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizationManager.kt#OptimizationManager                                                                                                                                  |
| `OptimizedEntryView`                   | XML Views `FrameLayout` (render via `setContentRenderer` + `setEntry`) | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizedEntryView.kt#OptimizedEntryView                                                                                                                                    |
| `ScreenTracker`                        | XML Views object (`trackScreen(name)`)                                 | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/ScreenTracker.kt#ScreenTracker                                                                                                                                              |
| `TrackingRecyclerView`                 | XML Views `RecyclerView` re-checking child visibility on scroll        | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/TrackingRecyclerView.kt#TrackingRecyclerView                                                                                                                                |
| `ViewTrackingController`               | internal view-timing engine                                            | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/tracking/ViewTrackingController.kt#ViewTrackingController                                                                                                                         |
| `OptimizationClient` API               | imperative facade                                                      | extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient                                                                                                                                     |

- `OptimizedEntry` (Compose) and `OptimizedEntryView` (Views) detect an optimized entry by the
  presence of `fields.nt_experiences`; only optimized entries observe `selectedOptimizations` and call
  `resolveOptimizedEntry`, non-optimized entries render the baseline once with no live observation.
  Both wrap the rendered content with the same view-tracking + tap-tracking machinery so a Contentful
  entry behaves identically across the two adapters. source: extern:OptimizedEntry isOptimized checks fields.nt_experiences — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizedEntry.kt#OptimizedEntry; extern:OptimizedEntryView mirrors the same isOptimized/observation logic — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizedEntryView.kt#OptimizedEntryView
- Interaction enablement: view tracking uses per-entry `trackViews ?? global trackViews`; tap tracking
  resolves as `trackTaps == false` disables, an explicit `trackTaps` or a non-null `onTap` enables,
  else the global `trackTaps` default. Both default enabled (Compose `TrackingConfig` and
  `OptimizationManager` both default `trackViews=true`, `trackTaps=true`, `liveUpdates=false`).
  source: extern:OptimizedEntry viewsEnabled/tapsEnabled resolution — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizedEntry.kt#OptimizedEntry; extern:TrackingConfig defaults — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/CompositionLocals.kt#TrackingConfig; extern:OptimizedEntryView resolveTrackViews/resolveTrackTaps — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizedEntryView.kt#OptimizedEntryView
- Scroll-aware visibility: Compose `OptimizationLazyColumn` publishes a `ScrollContext { scrollY,
viewportHeight }` via `LocalScrollContext` that descendant `Modifier.trackViews` reads; without it,
  view tracking falls back to `Resources.getSystem().displayMetrics.heightPixels` for the viewport and
  assumes `scrollY = 0`. `OptimizedEntryView` instead derives its visible ratio from
  `getGlobalVisibleRect`, and `TrackingRecyclerView` nudges descendant `OptimizedEntryView`s to
  re-check on each scroll frame (redundant with each view's own `OnPreDrawListener`). source: extern:Modifier.trackViews reads LocalScrollContext, else system display metrics — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/ViewTrackingLayout.kt#trackViews; extern:OptimizedEntryView.updateVisibility uses getGlobalVisibleRect — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizedEntryView.kt#OptimizedEntryView
- The `OptimizationClient` API splits by Kotlin call shape: **`suspend`** for events + resolution +
  profile reads (`identify`/`page`/`screen`/`track`/`trackCurrentScreen`/`flush`/`trackView`/`trackClick`/
  `resolveOptimizedEntry`/`getMergeTagValue`/`getProfile`), and **synchronous** (some blocking on the
  QuickJS dispatcher via `runBlocking`) for `consent`/`reset`/`setOnline`/`setLocale`/`getFlag`/
  `observeFlag`/`getState`/`hasConsent` and the preview-override methods. Reactive surfaces are
  `StateFlow`/`SharedFlow`, not Combine publishers. source: extern:OptimizationClient suspend event/resolve methods vs synchronous reads exposed as Flows — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient

## Render / entry resolution

- `resolveOptimizedEntry(baseline, selectedOptimizations?)` is a **`suspend` function** (iOS's is
  synchronous — Android must suspend because bridge calls hop to the QuickJS dispatcher) and is
  **fail-soft**: it serializes the baseline map to JSON, calls the bridge, and returns a
  `ResolvedOptimizedEntry`. If the client is not initialized, serialization fails, the bridge returns
  `null`/`undefined`, or the result cannot be parsed, it returns the baseline entry unchanged (with
  `selectedOptimization`/`optimizationContextId` null) and continues — it never throws or breaks the
  UI. source: extern:resolveOptimizedEntry suspend, returns baseline on any failure — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; core-sdk#CoreBase.ts#resolveOptimizedEntry
- `selectedOptimizations` argument semantics: passing `null` **omits the arg to the bridge**, so the
  bridge resolves against the SDK's current selection state; passing an explicit `List<Map>` snapshot
  resolves against exactly that (used by locked entries and by callers driving their own optimization
  state via `OptimizedEntryView.setEntry(entry, selectedOptimizations)`). source: extern:resolveOptimizedEntry omits selectedOptimizations arg when null — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; optimization-js-bridge#index.ts#Bridge
- `OptimizedEntry`/`OptimizedEntryView` lock to the first resolved variant by default: they collect
  the `selectedOptimizations` `StateFlow` directly (not a Compose snapshot, so the rapid emission burst
  from `identify()` is not coalesced), and on the first non-null value when not live and not yet locked
  they snapshot it into `lockedOptimizations` and resolve against the locked value thereafter.
  `shouldLiveUpdate` precedence: preview panel open (`isPreviewPanelOpen.value`) forces live
  (overriding an explicit `liveUpdates = false`) → per-entry `liveUpdates` → global `liveUpdates`
  default → locked. When the panel closes, `resolvePreviewCloseLockState` snapshots the current
  selections so applied overrides persist (unless the entry is live or has a caller-supplied
  selected-optimizations override). source: extern:OptimizedEntry collects selectedOptimizations, first-variant locking + shouldLiveUpdate precedence — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizedEntry.kt#OptimizedEntry; extern:resolvePreviewCloseLockState — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizedEntryPreviewCloseLock.kt#resolvePreviewCloseLockState; kb:shared/concepts.md
- Single-locale CDA contract and include-depth requirement are shared and app-owned: fetch with one
  concrete locale and `include` deep enough to resolve `nt_experiences` → `nt_experience` →
  `nt_variants`/`nt_audience` (`nt_config` is a JSON field, not a link). All-locale payloads fall back
  to baseline. The Android SDK does not fetch app CDA entries itself (except the preview panel's own
  definition fetch); the app passes fetched entries to `OptimizedEntry`/`OptimizedEntryView`/
  `resolveOptimizedEntry`. source: core-sdk#resolvers/OptimizedEntryResolver.ts#OptimizedEntryResolver; api-schemas#contentful/OptimizedEntry.ts#OptimizedEntryFields; concept:entry-personalization-and-variant-resolution; kb:shared/concepts.md
- Merge tags resolve separately from variant swap: `getMergeTagValue(mergeTagEntry)` (suspend) passes
  the expanded inline `nt_mergetag` entry to the bridge, which reads the selector against the current
  profile and returns the resolved string or `null` (fallback, also returned pre-init). The app owns
  extracting the embedded entry from Rich Text before calling it. source: extern:getMergeTagValue passes the mergetag entry to the bridge, returns null on fallback/pre-init — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; core-sdk#resolvers/MergeTagValueResolver.ts#resolve; kb:shared/concepts.md

## Identifier ownership

| Identifier                                                                                                                                                                | Owner  | Notes                                                                                                                                                                                                | source                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `com.contentful.optimization.consent`, `…persistenceConsent` (`SharedPreferences` file `com.contentful.optimization`, key prefix `com.contentful.optimization.`)          | SDK    | Consent state, persisted on every state change. Stored as the strings `"accepted"`/`"denied"` (not booleans) via `ConsentStoragePolicy`; a missing value decodes to `null` (undecided).              | extern:SharedPreferencesStore file/keyPrefix, ConsentStoragePolicy encodes accepted/denied — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/storage/SharedPreferencesStore.kt#SharedPreferencesStore; extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/StatefulPolicy.kt#ConsentStoragePolicy |
| `com.contentful.optimization.profile`, `…changes`, `…selectedOptimizations`, `…anonymousId` (`SharedPreferences`)                                                         | SDK    | Profile-continuity cache; written only while `persistenceConsent == true`, cleared when it becomes `false`. `anonymousId` is set to `profile.id`.                                                    | extern:SharedPreferencesStore profileContinuityKeys written only when persistenceConsent true — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/storage/SharedPreferencesStore.kt#SharedPreferencesStore                                                                                                                                      |
| anonymous/profile id (in JS core)                                                                                                                                         | SDK    | The bridge's `getAnonymousId` returns the stored id only when `signals.persistenceConsent.value === true`, else `undefined`; the id continuity is the same cross-suite `profile` the other SDKs use. | optimization-js-bridge#index.ts#initialize; concept:profile-synchronization-between-client-and-server                                                                                                                                                                                                                                                                             |
| `nt_experience`, `nt_audience` (content types); `nt_experiences`, `nt_variants`, `nt_audience`, `nt_config`, `nt_experience_id`, `nt_mergetag_id`, `nt_fallback` (fields) | SDK    | SDK-fixed Optimization content-model identifiers the resolver keys off — not reader-chosen; shared with the whole suite.                                                                             | api-schemas#contentful/OptimizedEntry.ts#OptimizedEntrySkeleton; api-schemas#contentful/OptimizationEntry.ts#OptimizationEntrySkeleton; api-schemas#contentful/AudienceEntry.ts#AudienceEntrySkeleton                                                                                                                                                                             |
| Contentful CDA locale                                                                                                                                                     | reader | App chooses the CDA locale and passes it to its own CDA fetch feeding entry resolution; distinct from the SDK Experience/event `locale`.                                                             | concept:locale-handling-in-the-optimization-sdk-suite                                                                                                                                                                                                                                                                                                                             |
| consent record / CMP choice                                                                                                                                               | reader | App records the user's decision and calls `consent(...)`; the SDK reflects only what is passed.                                                                                                      | concept:consent-management-in-the-optimization-sdk-suite; core-sdk#CoreStateful.ts#consent                                                                                                                                                                                                                                                                                        |

- Android persists to a private `SharedPreferences` file `com.contentful.optimization` with keys
  prefixed `com.contentful.optimization.`, not the browser `ctfl-opt-*` cookies the web SDKs use;
  it shares the key-value continuity model with iOS (`UserDefaults`) and React Native (AsyncStorage
  `__…__` keys). There is no built-in cross-platform id handoff. source: extern:SharedPreferencesStore file/keyPrefix model — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/storage/SharedPreferencesStore.kt#SharedPreferencesStore; kb:native/ios.md; kb:native/react-native.md

## Events & tracking

- `EventEmissionResult` (`{ accepted, data? }`) is returned by the suspend emitters `identify`, `page`,
  `screen`, `track`, `trackCurrentScreen`, and `trackView`; `flush` and `trackClick` return `Unit`.
  source: extern:EventEmissionResult + which methods return it — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#EventEmissionResult
- Screen events: Compose `ScreenTrackingEffect(screenName)` fires from a `LaunchedEffect` keyed on
  `screenName` and `state.consent` — so on first composition, screen-name change, and consent change —
  calling `trackCurrentScreen(name)`. Views `ScreenTracker.trackScreen(name)` sets the current name,
  observes `client.state`, and re-calls `trackCurrentScreen` on each state emission. `trackCurrentScreen`
  dedupes in the bridge by `routeKey` (defaulting to `name`) through an `AcceptedCurrentStateTracker`,
  so a repeat of the same current screen is skipped and a blocked attempt is retried once consent
  allows. Plain `screen(name)` calls core `screen()` with no dedupe. source: extern:ScreenTrackingEffect keyed on screenName+consent → trackCurrentScreen — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/ScreenTrackingEffect.kt#ScreenTrackingEffect; extern:ScreenTracker re-tracks on state change — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/ScreenTracker.kt#ScreenTracker; optimization-js-bridge#index.ts#Bridge; core-sdk#tracking/AcceptedCurrentStateTracker.ts#AcceptedCurrentStateTracker
- Entry view tracking timing (`ViewTrackingController`, shared by both adapters): defaults
  `minVisibleRatio = 0.8`, `dwellTimeMs = 2000`, `viewDurationUpdateIntervalMs = 5000` (tunable per
  entry). Three-phase cycle: initial `trackView` after accumulated visible time ≥ dwell, periodic
  duration updates every interval while visible, and a final duration event when visibility ends (only
  if ≥1 event already fired). Gated on `hasConsent("trackView")` (→ core wire type `component`).
  source: extern:ViewTrackingController three-phase timing, defaults 2000/0.8/5000, isTrackingAllowed=hasConsent(trackView) — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/tracking/ViewTrackingController.kt#ViewTrackingController; core-sdk#consent/ConsentPolicy.ts#hasEventConsent
- Background handling of view cycles: `ViewTrackingController` is a `ProcessLifecycleOwner`
  `DefaultLifecycleObserver`. On `onStop` (app backgrounded) it pauses accumulation, emits a final
  event if `attempts > 0`, and resets the cycle; on `onStart` it re-evaluates visibility from the last
  known geometry and starts a fresh cycle when still visible (so nothing needs to scroll to restart).
  source: extern:ViewTrackingController pause/resume on ProcessLifecycleOwner onStop/onStart — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/tracking/ViewTrackingController.kt#ViewTrackingController
- Sticky entry-view dedupe lives in the bridge, not Kotlin: `trackView` keys sticky views by
  `stickyTrackingKey ?? viewId` and only sends a sticky view once accepted, via
  `shouldSendStickyEntryView` / `shouldRememberStickyEntryViewResult`. The Kotlin controller passes a
  per-controller `stickyTrackingKey` (a fresh UUID) so a single mounted entry dedupes its own sticky
  views. source: optimization-js-bridge#index.ts#Bridge; core-sdk#tracking/EntryViewTracking.ts#shouldSendStickyEntryView; core-sdk#tracking/EntryViewTracking.ts#shouldRememberStickyEntryViewResult
- Entry tap tracking: Compose `Modifier.trackClicks` uses Compose's `clickable {}` (not a raw gesture
  like RN, or a `TapGesture` like iOS); Views `OptimizedEntryView` uses `setOnClickListener`. Both emit
  wire type `component_click` via `trackClick` when `hasConsent("trackClick")`, then invoke `onTap(entry)`
  if provided. source: extern:Modifier.trackClicks uses clickable, gated by hasConsent trackClick — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/ClickTrackingModifier.kt#trackClicks; extern:OptimizedEntryView.fireTrackClick via setOnClickListener — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/views/OptimizedEntryView.kt#OptimizedEntryView; core-sdk#consent/ConsentPolicy.ts#hasEventConsent
- Flags: `getFlag(name)` is a non-reactive JSON read (blocking on the QuickJS dispatcher, returns
  `null` pre-init); `observeFlag(name)` registers an `observeFlag` bridge subscription (deduping per
  name) and returns a `StateFlow<JSONValue?>` (Android idiom; iOS uses a Combine publisher). Subscribing
  to a flag observable emits a `component` flag-view event through the core stream when consent and
  profile allow, so flag delivery is an analytics exposure. source: extern:getFlag vs observeFlag returning StateFlow — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; optimization-js-bridge#index.ts#Bridge
- `eventStream` and `blockedEventStream` are both `MutableSharedFlow(replay = 64, extraBufferCapacity
= 64)` exposed as `SharedFlow` — so unlike iOS (passthrough, no replay) **Android replays up to the
  last 64 events to a late subscriber**. `eventStream` carries accepted events (fed by the bridge's
  `onEventEmitted`); `blockedEventStream` carries consent/allow-list-blocked events and also fires the
  `onEventBlocked` config callback. source: extern:eventStream/blockedEventStream are replay-64 SharedFlows — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; concept:android-sdk-runtime-and-interaction-mechanics
- Experience-response payload → published state: an accepted Experience call returns
  `{ profile, selectedOptimizations, changes }`; the bridge applies it to core signals and pushes
  `readBridgeState()` through `__nativeOnStateChange`, which `OptimizationClient.handleStateUpdate`
  decodes into the `state`/`selectedOptimizations`/`optimizationPossible`/`experienceRequestState`
  StateFlows (and writes continuity to `SharedPreferences` when `persistenceConsent == true`).
  source: optimization-js-bridge#index.ts#initialize; core-sdk#state/applyOptimizationDataToSignals.ts#applyOptimizationDataToSignals; extern:handleStateUpdate decodes pushed bridge state into StateFlows — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; kb:shared/concepts.md

## Consent & persistence

- Two independent axes — `consent` (may personalize + emit events) and `persistenceConsent` (may store
  profile continuity); see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence).
  Boolean `consent(accept)` sets both; `consent(events, persistence)` sets them independently
  (serialized to the core `ConsentInput` object form). `consent(false)` clears event consent and
  persistence consent, purges queues, and clears durable continuity while in-memory state stays usable
  until reset/teardown; `consent(events = false)` withdraws event consent and purges queues but does
  not clear persistence unless `persistence = false` is also passed. source: extern:consent(Boolean) sets both, consent(events,persistence) split — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; core-sdk#consent/Consent.ts#ConsentInput; core-sdk#CoreStateful.ts#consent
- Native default pre-consent allow-list = `['identify', 'screen']`
  (`DEFAULT_NATIVE_ALLOWED_EVENT_TYPES` in the bridge, used when `allowedEventTypes` is unset),
  overriding Core's fail-closed `DEFAULT_ALLOWED_EVENT_TYPES = []`. Before event consent, `identify`
  and `screen` emit; entry views (`component`), taps (`component_click`), `page`, and custom `track`
  are blocked. Pass `allowedEventTypes = emptyList()` for strict opt-in, or a narrow custom list.
  source: optimization-js-bridge#index.ts#DEFAULT_NATIVE_ALLOWED_EVENT_TYPES; core-sdk#events/EventType.ts#DEFAULT_ALLOWED_EVENT_TYPES; core-sdk#consent/ConsentPolicy.ts#hasEventConsent
- `reset()` clears profile continuity (bridge `reset()` — which also clears overrides, the anonymous
  id, the current-screen dedupe tracker, and sticky-view keys — plus `store.clearProfileContinuity()`)
  but **preserves consent state**. `reset()` no-ops before initialization. source: extern:reset() clears continuity via bridge + store, keeps consent, no-op pre-init — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; optimization-js-bridge#index.ts#Bridge
- `SharedPreferencesStore` is a write-through in-memory cache: getters read only the in-memory `cache`
  map, and setters both update the cache and write to `SharedPreferences` using **`commit()`**
  (synchronous, not `apply()`), so a continuity write settles to disk before the corresponding client
  state is published — E2E tests can wait for SDK-derived state instead of storage-timing delays.
  Persisted disk values are read **only at startup** (`loadConsentState`/`loadProfileContinuity`);
  runtime SDK state comes from bridge state pushes, never from re-reading disk. Consent stores always;
  continuity stores only when `persistenceConsent == true` and is cleared when `false`. Queues are
  never persisted (in-memory). source: extern:SharedPreferencesStore write-through cache, commit() writes, disk read only at load — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/storage/SharedPreferencesStore.kt#SharedPreferencesStore
- Persisted persistence-consent falls back to persisted event consent when unset
  (`ConsentStoragePolicy.resolvePersistedPersistenceConsent`), mirroring the core storage-decode
  behavior. source: extern:resolvePersistedPersistenceConsent falls back to consent — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/StatefulPolicy.kt#ConsentStoragePolicy; core-sdk#consent/ConsentStorage.ts#resolvePersistedPersistenceConsent

## Version / runtime quirks

- Beta: the API, setup flow, and bridge contract are subject to change. source: extern:beta status — packages/android/README.md
- QuickJS bridge: `QuickJsContextManager` creates **one `QuickJs` instance per `OptimizationClient`
  lifetime** on a dedicated single-thread dispatcher, defines the `__native` object bindings, evaluates
  a bootstrap script installing the polyfill globals, evaluates the UMD bundle
  (`optimization-android-bridge.umd.js`) read from the AAR `assets`, verifies `typeof __bridge ===
"object"` (else closes and throws `OptimizationError.BridgeError`), registers the push-back native
  globals, and calls `__bridge.initialize(configJSON)`. A missing/unreadable bundle asset throws
  `OptimizationError.ResourceLoadError`. source: extern:QuickJsContextManager one QuickJs per client, loads UMD from assets, validates \_\_bridge — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/bridge/QuickJsContextManager.kt#QuickJsContextManager
- Native polyfills (`NativeImpl`) register `__native.log`/`setTimeout`/`clearTimeout`/`randomUUID`/
  `fetch` and a bootstrap that installs `__nativeLog`, `__nativeSetTimeout`, `__nativeClearTimeout`,
  `__nativeRandomUUID`, `__nativeFetch`. `__nativeFetch` uses **OkHttp** (async `enqueue`) and calls
  back into JS via `__fetchComplete(...)`; timers are coroutine `delay` jobs that fire `__timerFired`.
  source: extern:NativeImpl registers native fetch/timers/uuid/log, fetch uses OkHttp — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/polyfills/NativePolyfills.kt#NativeImpl; optimization-js-bridge#index.ts#NativeGlobal
- Push-back callback routing quirk: the bridge's `__nativeOnStateChange`/`__nativeOnEventEmitted`/
  `__nativeOnOverridesChanged`/`__nativeOnEventBlocked`/`__nativeOnFlagValueChanged`/`__nativeOnQueueEvent`
  globals, and per-call async success/error callbacks, are implemented on the JS side as calls to
  `__native.log("__<tag>__", json)`; the Kotlin `onLog` handler dispatches by the pseudo-level tag.
  These handlers run **synchronously on the QuickJS thread while the originating call is still in
  flight**, which is what guarantees a synchronous `callSync` has landed its StateFlow mutations before
  returning (`StateFlow`/`SharedFlow`/`SharedPreferences` are safe to touch from any thread).
  source: extern:callback routing through \_\_native.log pseudo-levels, handled synchronously on the QuickJS thread — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/bridge/QuickJsContextManager.kt#QuickJsContextManager
- Threading model (diverges from iOS's `@MainActor`): all bridge access is serialized on a dedicated
  single-thread `quickJsDispatcher`. Suspend calls hop from `Dispatchers.Main` onto that dispatcher;
  synchronous calls block on it via `runBlocking(bridge.quickJsDispatcher)`. There is no main-thread
  confinement of the JS engine. source: extern:quickJsDispatcher single-thread, sync calls runBlocking on it — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/bridge/QuickJsContextManager.kt#QuickJsContextManager; concept:android-sdk-runtime-and-interaction-mechanics
- `setLocale(locale)` updates the SDK Experience-API and event locale (and republishes `client.locale`)
  but does **not** refetch Contentful entries or refresh profile state; the app must re-fetch CDA and
  re-render. It `requireInitialized()` (throws `NotInitialized` pre-init) and throws
  `OptimizationError.ConfigError` when the bridge rejects the locale. source: extern:setLocale updates SDK locale only, throws pre-init/invalid — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient; concept:locale-handling-in-the-optimization-sdk-suite
- Live-updates / preview precedence: an open preview panel forces live updates in both `OptimizedEntry`
  and `OptimizedEntryView` (overriding an explicit `liveUpdates = false`); otherwise per-entry
  `liveUpdates` > global default > locked. source: extern:OptimizedEntry preview-open forces live — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizedEntry.kt#OptimizedEntry; concept:android-sdk-runtime-and-interaction-mechanics
- Offline / lifecycle delivery: `NetworkMonitor` (`ConnectivityManager.registerNetworkCallback`) calls
  `setOnline(...)` on connectivity change and `flush()` on reconnect; `AppLifecycleHandler`
  (`ProcessLifecycleOwner` observer) calls `flush()` on `onStop` (app moving to background) for a
  best-effort drain. Both are created after bridge init. Queues are in-memory only (no durable outbox),
  capped at 100 offline Experience events by default (`OFFLINE_QUEUE_MAX_EVENTS`, tunable via
  `QueuePolicy.offlineMaxEvents`); they do not survive process death. source: extern:NetworkMonitor + AppLifecycleHandler background flush — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/handlers/NetworkMonitor.kt#NetworkMonitor; extern:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/handlers/AppLifecycleHandler.kt#AppLifecycleHandler; core-sdk#CoreStateful.ts#QueuePolicy
- Android emulator localhost: the SDK has **no** localhost rewrite (contrast the React Native SDK,
  whose reference app rewrites `localhost`→`10.0.2.2` at runtime). The Android reference app instead
  hardcodes the emulator's stable host-loopback alias `http://10.0.2.2:8000` as its base host, avoiding
  the non-persistent `adb reverse` forward that `localhost` would require inside the emulator (iOS
  Simulator reaches host `localhost` directly). source: impl:android-sdk#shared/src/main/kotlin/com/contentful/optimization/shared/AppConfig.kt; kb:native/react-native.md; kb:native/ios.md
- Preview panel: `PreviewPanelConfig(enabled, contentfulClient?)`. Compose mounts it via
  `OptimizationRoot(previewPanel = …)`, which wraps content in `PreviewPanelOverlay` (a FAB +
  `ModalBottomSheet`). Views calls `OptimizationManager.attachPreviewPanel(activity)`, which adds an
  in-activity `ComposeView` overlay (same FAB + sheet) to the activity's decor view via
  `PreviewPanelActivity.addFloatingButton` — the non-exported `PreviewPanelActivity` is retained for
  backward compatibility but is no longer the runtime path (keeping the panel inside the host activity
  so UiAutomator can resolve its nodes). Opening/closing toggles `client.isPreviewPanelOpen` and the
  bridge `previewPanelOpen` signal, and (with a `contentfulClient`) fetches `nt_audience`/`nt_experience`
  definitions in 100-entry pages via `fetchAllEntries` and calls `loadDefinitions` so the bridge bakes a
  preview model. source: extern:PreviewPanelActivity.addFloatingButton adds an in-activity ComposeView overlay, onResume/onPause toggle preview open — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/preview/PreviewPanelActivity.kt#PreviewPanelActivity; extern:fetchAllEntries pages 100 at a time — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/preview/PreviewContentfulClient.kt#fetchAllEntries; optimization-js-bridge#index.ts#Bridge

## Failure & fallback behavior

- Baseline fallback (no matching selection / unresolved links / all-locale payload): resolution returns
  the baseline entry and the UI does not break; denied/undecided consent surfaces as "no selections ⇒
  baseline", not a blocked resolve. source: core-sdk#resolvers/OptimizedEntryResolver.ts#OptimizedEntryResolver; concept:entry-personalization-and-variant-resolution; kb:shared/concepts.md
- `OptimizationError` is a sealed class with cases `NotInitialized`, `BridgeError(msg)`,
  `ResourceLoadError(msg)` (UMD bundle asset missing/unreadable), and `ConfigError(msg)`
  (locale/serialization failures). source: extern:OptimizationError sealed class cases — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationError.kt#OptimizationError
- Before initialization: suspend event methods and `setLocale`/`observeFlag` throw
  `OptimizationError.NotInitialized` (via `requireInitialized`); `consent`/`reset`/`setOnline` and the
  preview-override methods no-op (guarded by `bridgeCallSyncWhenInitialized` / an `isInitialized`
  check), `resolveOptimizedEntry` returns the baseline passthrough, and `getFlag`/`getMergeTagValue`/
  `getProfile` return `null`; `hasConsent` returns `false`. source: extern:pre-init suspend methods throw NotInitialized while sync APIs no-op or return baseline/null — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt#OptimizationClient
- QuickJS exceptions are routed, not crashed: `callSync` catches the exception, logs it via
  `onLog("exception", …)`, and returns `null`; `callAsync` catches it and fails the callback with
  `OptimizationError.BridgeError`. The bridge itself returns/reports `SDK not initialized. Call
initialize() first.` when its `CoreStateful` instance is absent. source: extern:callSync/callAsync capture QuickJS exceptions and route to log/BridgeError — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/bridge/QuickJsContextManager.kt#QuickJsContextManager; optimization-js-bridge#index.ts#getCurrentInstance
- `SharedPreferences` failures degrade quietly: unparseable stored values are skipped at load, and a
  failed `commit()` logs a warning while the SDK continues from in-memory / bridge state. source: extern:SharedPreferencesStore skips unparseable values and warns on failed commit — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/storage/SharedPreferencesStore.kt#SharedPreferencesStore
- Preview panel without a `contentfulClient` (`PreviewPanelConfig(enabled = true)` / omitted client)
  still opens, but **degraded, not disabled**: `PreviewViewModel.loadDefinitions()` early-returns on its
  `contentfulClient ?: return` (no CDA fetch, `client.loadDefinitions` never called), so the bridge
  keeps `audienceDefinitions`/`experienceDefinitions` `null` and `computePreviewModel` returns empty
  audience/experience name maps. Consequences: the "Audiences & Experiences" section renders "No
  audience data" (empty `audiencesWithExperiences` ⇒ no rows ⇒ no audience-qualify / variant-select
  controls for _setting_ overrides); Profile/Debug sections and the reset-to-actual footer still render
  from bridge state; any pre-existing overrides still list, but their summaries fall back to raw
  audience/experience ids (`audienceNameMap[id] ?: id` / `experienceNameMap[id] ?: id`). source: extern:PreviewViewModel.loadDefinitions guards on contentfulClient producing an empty audience section and raw-id override summaries — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/preview/PreviewViewModel.kt#PreviewViewModel; extern:PreviewPanelContent renders "No audience data" and nameMap[id] ?: id fallbacks — packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/preview/PreviewPanelContent.kt#PreviewPanelContent; optimization-js-bridge#previewStateHelpers.ts#computePreviewModel
