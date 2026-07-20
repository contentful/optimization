# iOS (`ContentfulOptimization` Swift Package) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md, documentation/guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer verified against
> packages/\*\*/src.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). The concepts they capture — consent/persistence
axes, baseline fallback, entry-source managed-vs-manual, live updates, single-locale entry contract,
experience-response payload — are SDK-neutral and apply to the whole suite via the shared `core-sdk`.

This is a **beta** native Swift Package, not a TypeScript package: its source has a `Package.swift`
and no `package.json`/`src/`, so `knowledge:check` has no `ios` SDK key and cannot resolve Swift
`#symbol` pointers. Swift-specific facts therefore use extern-prefixed pointers whose free text names
the exact Swift file and symbol; behavior that actually executes in the shared JS layer uses the real
resolvable keys — the js-bridge adapter, the shared core/api packages, concept docs, the reference
implementation, and cross-links into this base. The iOS SDK runs the **same `CoreStateful` runtime as
the web/React-Native SDKs** inside a per-client JavaScriptCore context, bridged by the TypeScript
adapter in `packages/universal/optimization-js-bridge/src/index.ts`; most
optimization/consent/event/queue behavior parallels [React Native](./react-native.md). Swift owns
native concerns: persistence (`UserDefaults`), networking (`URLSession`/`NWPathMonitor`), app
lifecycle, SwiftUI views, and preview-panel UI. Swift source root:
`packages/ios/ContentfulOptimization/Sources/ContentfulOptimization`.

## Package & entry points

Single module: `import ContentfulOptimization`. There is one SDK; both guides consume it — SwiftUI
apps mostly use the view surface, UIKit apps mostly use the imperative `OptimizationClient` surface.

| Import path (`ContentfulOptimization`) | Public symbol or purpose                                                                                                                                                      | source                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SwiftUI surface                        | `OptimizationRoot`, `OptimizedEntry`, `OptimizationScrollView`, `.trackScreen(name:)` / `ScreenTrackingModifier`, `TrackingConfig`, `ScrollContext`                           | extern:SwiftUI views/modifiers — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizationRoot.swift#OptimizationRoot; extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/ScreenTrackingModifier.swift#trackScreen                |
| Imperative client                      | `OptimizationClient` (`@MainActor` `ObservableObject`); `EventEmissionResult`                                                                                                 | extern:OptimizationClient is a @MainActor ObservableObject facade wrapping the JS bridge — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient                                                                             |
| Config                                 | `OptimizationConfig`, `OptimizationApiConfig`, `StorageDefaults`, `OptimizationLogLevel`, `QueuePolicy`, `QueueFlushPolicy`, `QueueEvent`/`QueueEventType`, `BlockedEvent`    | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationConfig.swift#OptimizationConfig; extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationConfig.swift#StorageDefaults                                        |
| Event payloads                         | `IdentifyPayload`, `PageEventPayload`, `ScreenEventPayload`, `TrackEventPayload`, `TrackViewPayload`, `TrackClickPayload`                                                     | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/EventPayloads.swift#ScreenEventPayload; extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/TrackViewPayload.swift#TrackViewPayload                                              |
| State / result types                   | `OptimizationState`, `ResolvedOptimizedEntry`, `PreviewState` (+ DTOs), `JSONValue`, `OptimizationError`                                                                      | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationState.swift#OptimizationState; extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationError.swift#OptimizationError                                         |
| Tracking (imperative)                  | `ViewTrackingController`, `TrackingMetadata`                                                                                                                                  | extern:ViewTrackingController is a @MainActor imperative view-timing engine for UIKit — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/ViewTrackingController.swift#ViewTrackingController                                                                    |
| Preview panel                          | `PreviewPanelOverlay` (SwiftUI), `PreviewPanelViewController` (UIKit), `PreviewPanelConfig`, `PreviewContentfulClient` / `ContentfulHTTPPreviewClient`, `PreviewPanelContent` | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Preview/PreviewPanelViewController.swift#PreviewPanelViewController; extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Preview/PreviewContentfulClient.swift#ContentfulHTTPPreviewClient |

- SPM target links `JavaScriptCore` for consuming apps and copies `optimization-ios-bridge.umd.js`
  as a package resource; platforms are iOS 15+ / macOS 12+. source: extern:Package.swift links JavaScriptCore and copies the UMD bundle resource, iOS 15/macOS 12 — packages/ios/ContentfulOptimization/Package.swift
- Distribution: the Swift Package is published to a separate repo,
  `https://github.com/contentful/optimization.swift` (consumers add by URL `from: "x.y.z"`); the UMD
  bundle is built on demand (gitignored in the monorepo) from `optimization-js-bridge`, not
  hand-edited. source: extern:published to github.com/contentful/optimization.swift, UMD built from optimization-js-bridge — packages/ios/README.md; optimization-js-bridge#index.ts#initialize
- Every optimization/consent/event/queue call ultimately runs `CoreStateful` through the bridge's
  `globalThis.__bridge`; the Swift `OptimizationClient` is a thin native facade over it.
  source: optimization-js-bridge#index.ts#Bridge; core-sdk#CoreStateful.ts#CoreStatefulConfig

## Setup / factory

- Two usage modes for the one client. SwiftUI: `OptimizationRoot(config:)` owns the client
  (`@StateObject`), calls `initialize(config:)` in a `.task`, injects it via `@EnvironmentObject`
  plus a `TrackingConfig` environment value, and renders a `ProgressView()` until
  `client.isInitialized`. UIKit: the app creates `OptimizationClient()` and calls
  `initialize(config:)` from scene/app startup, holding it for the scene/app lifetime and passing it
  into view controllers manually. source: extern:OptimizationRoot @StateObject + .task initialize + ProgressView gate — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizationRoot.swift#OptimizationRoot; impl:ios-sdk#swiftui/App.swift; impl:ios-sdk#uikit/SceneDelegate.swift
- `initialize(config:)` is **synchronous and `throws`** (not `async`) — it loads the UMD bundle and
  runs bridge init inline on the `@MainActor`, so it blocks the main actor briefly at startup. The
  doc-comment example showing `try await` is misleading; the reference apps call `try?` /
  `try` without `await`. source: extern:initialize(config:) is synchronous throws, not async — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; impl:ios-sdk#uikit/SceneDelegate.swift
- Startup state resolution order in `initialize`: (1) `store.loadConsentState()` reads persisted
  consent from `UserDefaults`; (2) `resolveStatefulDefaults(configured:persisted:)` merges configured
  over persisted; (3) profile-continuity is loaded from `UserDefaults` **only** when the resolved
  `persistenceConsent == true` (`canLoadPersistedContinuity`), otherwise continuity is cleared when
  it resolves to `false`; (4) the merged `defaults` and a separate `anonymousId` are serialized into
  the bridge config. source: extern:initialize resolves consent → StatefulPolicy defaults → conditional profile-continuity load — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; extern:resolveStatefulDefaults + canLoadPersistedContinuity — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/StatefulPolicy.swift#resolveStatefulDefaults
- `OptimizationConfig`: `clientId` required; `environment` has a **Swift-side default `"main"`** in
  the initializer (unlike the JS SDKs, which fall back to the api-client `DEFAULT_ENVIRONMENT`);
  `logLevel` default `.error`; `locale`, `api` (`experienceBaseUrl`/`insightsBaseUrl`/
  `enabledFeatures`/`preflight`), `allowedEventTypes`, `queuePolicy`, `defaults: StorageDefaults`,
  `onEventBlocked` all optional. source: extern:environment default "main", logLevel default .error, clientId required — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationConfig.swift#OptimizationConfig
- `config.toJSON()` serializes to the bridge `BridgeConfig` shape, omitting nil URLs and empty
  sub-dicts; the bridge maps it into `CoreStatefulConfig` via `resolveStatefulDefaults`, defaulting
  `allowedEventTypes` to `DEFAULT_NATIVE_ALLOWED_EVENT_TYPES` and installing `queuePolicy` callbacks
  that push back through `__nativeOnQueueEvent`. source: extern:OptimizationConfig.toJSON → BridgeConfig — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationConfig.swift#OptimizationConfig; optimization-js-bridge#index.ts#BridgeConfig; optimization-js-bridge#index.ts#initialize
- `StorageDefaults` are startup defaults, not one-time seeds: configured values take precedence over
  persisted `UserDefaults` values every launch, so a configured `consent`/`persistenceConsent` can
  replace a stored choice. Apps that persist user choices leave these unset and call `consent(...)`
  from resolved app policy instead. source: extern:StorageDefaults precedence resolved in StatefulPolicy — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/StatefulPolicy.swift#resolveStatefulDefaults; concept:ios-sdk-runtime-and-interaction-mechanics
- Locale is normalized before init: trims, maps `_`→`-`, and rejects empty / `*` / `und` / non
  BCP-47-shaped values; an explicit invalid `locale` (config or `setLocale`) **throws** a
  `configError` rather than being silently dropped. source: extern:normalizeLocale + normalizeExplicitLocale throw on invalid — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationConfig.swift#OptimizationConfig; concept:locale-handling-in-the-optimization-sdk-suite

## Components & hooks

For iOS these are SwiftUI views/modifiers plus the imperative `OptimizationClient` API. Read exact
signatures from the Swift types; below is a navigation index with behavioral facts as sourced bullets.

| Name                                                        | Kind                                                                              | source                                                                                                                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OptimizationRoot`                                          | SwiftUI root view                                                                 | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizationRoot.swift#OptimizationRoot                                                                          |
| `OptimizedEntry`                                            | SwiftUI view (render closure)                                                     | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift#OptimizedEntry                                                                              |
| `OptimizationScrollView`                                    | SwiftUI scroll wrapper providing `ScrollContext`                                  | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizationScrollView.swift#OptimizationScrollView                                                              |
| `.trackScreen(name:)` / `ScreenTrackingModifier`            | SwiftUI modifier                                                                  | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/ScreenTrackingModifier.swift#trackScreen                                                                         |
| `ViewTrackingController`                                    | imperative view-timing engine (UIKit)                                             | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/ViewTrackingController.swift#ViewTrackingController                                                           |
| `TrackingMetadata`                                          | derives `componentId`/`experienceId`/`variantIndex`/`sticky` from entry+selection | extern:TrackingMetadata reads sys.id and selectedOptimization fields — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/ViewTrackingController.swift#TrackingMetadata |
| `PreviewPanelOverlay`                                       | SwiftUI FAB + sheet                                                               | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Preview/PreviewPanelOverlay.swift#PreviewPanelOverlay                                                                  |
| `PreviewPanelViewController` / `.addFloatingButton(to:...)` | UIKit preview host                                                                | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Preview/PreviewPanelViewController.swift#PreviewPanelViewController                                                    |
| `OptimizationClient` event/consent/resolve/preview API      | imperative facade                                                                 | extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient                                                                       |

- `OptimizedEntry` detects an optimized entry by the presence of `fields.nt_experiences`; only
  optimized entries call `resolveOptimizedEntry`, non-optimized entries pass through as baseline. It
  wraps the render closure's output with `ViewTrackingModifier` + `TapTrackingModifier` and exposes
  itself as an accessibility container (`children: .contain`) so nested identifiers stay queryable.
  source: extern:OptimizedEntry.isOptimized checks fields.nt_experiences and wraps with view/tap modifiers — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift#OptimizedEntry
- `OptimizedEntry` tap-enable resolution: `trackTaps == false` disables; an explicit `trackTaps` or a
  non-nil `onTap` enables; otherwise the root `TrackingConfig.trackTaps` default applies. View
  tracking uses per-entry `trackViews ?? trackingConfig.trackViews`. Both default enabled at the
  root. source: extern:OptimizedEntry tapsEnabled/viewsEnabled resolution — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift#OptimizedEntry; extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Environment/TrackingEnvironment.swift#TrackingConfig
- `OptimizationScrollView` publishes a `ScrollContext { scrollY, viewportHeight }` on the SwiftUI
  environment under the named coordinate space `"optimization-scroll"`; descendant `OptimizedEntry`
  view-tracking reads it. Without an enclosing scroll view, tracking uses
  `ViewTrackingController.fallbackViewportHeight` (`UIScreen.main.bounds.height`, or the main
  `NSScreen` on macOS) and assumes `scrollY = 0`. source: extern:OptimizationScrollView provides ScrollContext via environment — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizationScrollView.swift#OptimizationScrollView; extern:fallbackViewportHeight = UIScreen.main.bounds.height — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/ViewTrackingController.swift#ViewTrackingController
- `ViewTrackingController` is the imperative equivalent for UIKit (there is no automatic component
  visibility tracking in UIKit): the app feeds `updateVisibility(elementY:elementHeight:scrollY:
viewportHeight:)` from its own scroll/layout callbacks and the controller applies the same timing
  model and emits `TrackViewPayload` via the client. source: extern:ViewTrackingController.updateVisibility drives the timing model for UIKit — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/ViewTrackingController.swift#ViewTrackingController; concept:ios-sdk-runtime-and-interaction-mechanics
- The `OptimizationClient` API splits by call shape: **async `throws`** for events
  (`identify`/`page`/`screen`/`track`/`trackCurrentScreen`/`flush`/`trackView`/`trackClick`, each
  returning `EventEmissionResult` except the void ones), and **synchronous** for
  `consent`/`reset`/`setOnline`/`resolveOptimizedEntry`/`getMergeTagValue`/`getFlag`/`getProfile`/
  `getState`/`setLocale` and the preview-override methods. Reactive surfaces are `@Published`
  properties plus `eventStream`/`blockedEventStream`/`flagPublisher(_:)` Combine publishers.
  source: extern:OptimizationClient async event methods vs sync reads + Combine publishers — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient

## Render / entry resolution

- `resolveOptimizedEntry(baseline:selectedOptimizations:)` is **synchronous and fail-soft**: it
  serializes the baseline dict to JSON, calls the bridge, and returns a `ResolvedOptimizedEntry`. If
  the client is not initialized, a serialization error occurs, or the bridge result cannot be parsed,
  it returns the baseline entry unchanged (with `selectedOptimization`/`optimizationContextId` nil)
  and logs a warning — it never throws or breaks the UI. source: extern:resolveOptimizedEntry synchronous, returns baseline on any failure — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; core-sdk#CoreBase.ts#resolveOptimizedEntry
- `selectedOptimizations` argument semantics: passing `nil` **omits the arg to the bridge**, so the
  bridge resolves against the SDK's current selection state; passing an explicit `[[String: Any]]`
  snapshot resolves against exactly that (used for locked UIKit screens). source: extern:resolveOptimizedEntry omits selectedOptimizations arg when nil — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; optimization-js-bridge#index.ts#Bridge
- SwiftUI `OptimizedEntry` locks to the first resolved variant by default: it snapshots
  `selectedOptimizations` into `lockedOptimizations` on the first non-nil value when not live and not
  yet locked, and resolves against the locked value thereafter. `shouldLiveUpdate` precedence:
  preview panel open (`client.isPreviewPanelOpen`) forces live → per-entry `liveUpdates` → root
  `TrackingConfig.liveUpdates` → default locked. When the panel closes, a locked entry snapshots the
  current selections so applied overrides persist. source: extern:OptimizedEntry variant locking + shouldLiveUpdate precedence + panel-close snapshot — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift#OptimizedEntry; kb:shared/concepts.md
- Single-locale CDA contract and include-depth requirement are shared and app-owned: fetch with one
  concrete locale and `include` deep enough to resolve `nt_experiences` → `nt_experience` →
  `nt_variants`/`nt_audience` (`nt_config` is a JSON field, not a link). All-locale payloads fall
  back to baseline. The iOS SDK does not fetch CDA entries itself (except the preview panel's own
  definition fetch); the app passes fetched entries to `OptimizedEntry`/`resolveOptimizedEntry`.
  source: core-sdk#resolvers/OptimizedEntryResolver.ts#OptimizedEntryResolver; api-schemas#contentful/OptimizedEntry.ts#OptimizedEntryFields; concept:entry-personalization-and-variant-resolution; kb:shared/concepts.md
- Merge tags resolve separately from variant swap: `getMergeTagValue(mergeTagEntry:)` passes the
  expanded inline `nt_mergetag` entry to the bridge, which reads the selector against the current
  profile and returns the resolved string or `nil` (fallback). The app owns extracting the embedded
  entry from Rich Text before calling it. source: extern:getMergeTagValue passes the mergetag entry to the bridge — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; core-sdk#resolvers/MergeTagValueResolver.ts#resolve; kb:shared/concepts.md

## Identifier ownership

| Identifier                                                                                                                                                                | Owner  | Notes                                                                                                                                                                                                | source                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `com.contentful.optimization.consent`, `…persistenceConsent` (`UserDefaults`, suite `com.contentful.optimization`)                                                        | SDK    | Consent state, always persisted on state change. Stored as the strings `"accepted"`/`"denied"` (not booleans) via `ConsentStoragePolicy`; a missing value decodes to `nil` (undecided).              | extern:UserDefaultsStore keyPrefix + suite, ConsentStoragePolicy encodes accepted/denied — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Storage/UserDefaultsStore.swift#UserDefaultsStore; extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/StatefulPolicy.swift#ConsentStoragePolicy |
| `com.contentful.optimization.profile`, `…changes`, `…selectedOptimizations`, `…anonymousId` (`UserDefaults`)                                                              | SDK    | Profile-continuity cache; written only while `persistenceConsent == true`, cleared when it becomes `false`. `anonymousId` is set to `profile.id`.                                                    | extern:UserDefaultsStore profileContinuityKeys written only when persistenceConsent true — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Storage/UserDefaultsStore.swift#UserDefaultsStore                                                                                                                           |
| anonymous/profile id (in JS core)                                                                                                                                         | SDK    | The bridge's `getAnonymousId` returns the stored id only when `signals.persistenceConsent.value === true`, else `undefined`; the id continuity is the same cross-suite `profile` the other SDKs use. | optimization-js-bridge#index.ts#initialize; concept:profile-synchronization-between-client-and-server                                                                                                                                                                                                                                     |
| `nt_experience`, `nt_audience` (content types); `nt_experiences`, `nt_variants`, `nt_audience`, `nt_config`, `nt_experience_id`, `nt_mergetag_id`, `nt_fallback` (fields) | SDK    | SDK-fixed Optimization content-model identifiers the resolver keys off — not reader-chosen; shared with the whole suite.                                                                             | api-schemas#contentful/OptimizedEntry.ts#OptimizedEntrySkeleton; api-schemas#contentful/OptimizationEntry.ts#OptimizationEntrySkeleton; api-schemas#contentful/AudienceEntry.ts#AudienceEntrySkeleton                                                                                                                                     |
| Contentful CDA locale                                                                                                                                                     | reader | App chooses the CDA locale and passes it to its own CDA fetch feeding entry resolution; distinct from the SDK Experience/event `locale`.                                                             | concept:locale-handling-in-the-optimization-sdk-suite                                                                                                                                                                                                                                                                                     |
| consent record / CMP choice                                                                                                                                               | reader | App records the user's decision and calls `consent(...)`; the SDK reflects only what is passed.                                                                                                      | concept:consent-management-in-the-optimization-sdk-suite; core-sdk#CoreStateful.ts#consent                                                                                                                                                                                                                                                |

- iOS persists to `UserDefaults` keyed under the `com.contentful.optimization.` prefix in a named
  suite, not the browser `ctfl-opt-*` cookies the web SDKs use, and shares the AsyncStorage-style key
  model with React Native (which stores continuity under separate `__…__` keys). There is no built-in
  cross-platform id handoff. source: extern:UserDefaultsStore prefix/suite model — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Storage/UserDefaultsStore.swift#UserDefaultsStore; kb:native/react-native.md

## Events & tracking

- Screen events: `.trackScreen(name:)` (SwiftUI) fires on appear, on consent change, and on
  screen-name change, calling `trackCurrentScreen(name:)`. `trackCurrentScreen` dedupes in the bridge
  by `routeKey` (defaulting to `name`) through an `AcceptedCurrentStateTracker`, so a repeat of the
  same current screen is skipped; a blocked attempt is retried once consent allows. Plain
  `screen(name:)` calls the core `screen()` with no dedupe. source: extern:.trackScreen fires onAppear/consent/name change → trackCurrentScreen — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/ScreenTrackingModifier.swift#ScreenTrackingModifier; optimization-js-bridge#index.ts#Bridge; core-sdk#tracking/AcceptedCurrentStateTracker.ts#AcceptedCurrentStateTracker
- Entry view tracking timing (SwiftUI `OptimizedEntry` and UIKit `ViewTrackingController`): defaults
  `minVisibleRatio = 0.8`, `dwellTimeMs = 2000`, `viewDurationUpdateIntervalMs = 5000`. Three-phase
  cycle: initial `trackView` after accumulated visible time ≥ dwell, periodic duration updates every
  interval while visible, and a final duration event when visibility ends (only if ≥1 event already
  fired). Gated on `hasConsent("trackView")` (→ core wire type `component`). source: extern:ViewTrackingController three-phase timing, defaults 2000/0.8/5000 — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/ViewTrackingController.swift#ViewTrackingController; core-sdk#consent/ConsentPolicy.ts#hasEventConsent
- Background handling of view cycles: on `UIApplication.didEnterBackgroundNotification` the
  controller pauses accumulation, emits a final event if `attempts > 0`, and resets the cycle; on
  `didBecomeActive` it re-evaluates visibility from the last known geometry and starts a fresh cycle
  when still visible (so nothing needs to scroll to restart). UIKit-only (`#if canImport(UIKit)`).
  source: extern:ViewTrackingController pause/resume on background/foreground notifications — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/ViewTrackingController.swift#ViewTrackingController
- Sticky entry-view dedupe lives in the bridge, not Swift: `trackView` keys sticky views by
  `stickyTrackingKey ?? viewId` and only sends a sticky view once accepted, via
  `shouldSendStickyEntryView` / `shouldRememberStickyEntryViewResult`. The Swift controller passes a
  per-controller `stickyTrackingKey` (a fresh UUID) so a single mounted entry dedupes its own sticky
  views. source: optimization-js-bridge#index.ts#Bridge; core-sdk#tracking/EntryViewTracking.ts#shouldSendStickyEntryView; core-sdk#tracking/EntryViewTracking.ts#shouldRememberStickyEntryViewResult
- Entry tap tracking (SwiftUI `TapTrackingModifier`): a `simultaneousGesture(TapGesture())` on the
  wrapper emits wire type `component_click` via `trackClick` when `hasConsent("trackClick")`, then
  calls `onTap(entry)` if provided. (Unlike React Native, which uses raw touch start/end with a
  distance threshold, iOS relies on SwiftUI's `TapGesture`.) source: extern:TapTrackingModifier uses simultaneous TapGesture, gated by hasConsent trackClick — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/TapTrackingModifier.swift#TapTrackingModifier; core-sdk#consent/ConsentPolicy.ts#hasEventConsent
- Flags: `getFlag(_:)` is a non-reactive JSON read; `flagPublisher(_:)` registers an `observeFlag`
  subscription in the bridge and returns a `CurrentValueSubject`-backed publisher. Subscribing to a
  flag observable emits a `component` flag-view event through the core stream when consent and
  profile allow, so flag delivery is an analytics exposure. source: extern:getFlag vs flagPublisher/observeFlag — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; optimization-js-bridge#index.ts#Bridge
- `eventStream` is a **passthrough** `PassthroughSubject` (fed by the bridge's `onEventEmitted`) and
  does **not** replay prior events to late subscribers; `blockedEventStream` (plus the
  `onEventBlocked` config callback) surfaces consent/allow-list-blocked events. Subscribe before init
  or accept missing earlier events. source: extern:eventStream/blockedEventStream are passthrough subjects, no replay — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; concept:ios-sdk-runtime-and-interaction-mechanics
- Experience-response payload → published state: an accepted Experience call returns
  `{ profile, selectedOptimizations, changes }`; the bridge applies it to core signals and pushes
  `readBridgeState()` through `__nativeOnStateChange`, which `OptimizationClient.handleStateUpdate`
  decodes into `@Published state`/`selectedOptimizations`/`optimizationPossible`/
  `experienceRequestState` (and writes continuity to `UserDefaults` when permitted). source: optimization-js-bridge#index.ts#initialize; core-sdk#state/applyOptimizationDataToSignals.ts#applyOptimizationDataToSignals; extern:handleStateUpdate decodes pushed bridge state into @Published props — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; kb:shared/concepts.md

## Consent & persistence

- Two independent axes — `consent` (may personalize + emit events) and `persistenceConsent` (may
  store profile continuity); see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence).
  Boolean `consent(_ accept:)` sets both; `consent(events:persistence:)` sets them independently
  (serialized to the core `ConsentInput` object form). `consent(false)` clears event consent and
  persistence consent, purges queues, and clears durable continuity while in-memory state stays
  usable until reset/teardown. source: extern:consent(\_:) sets both, consent(events:persistence:) split — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; core-sdk#consent/Consent.ts#ConsentInput; core-sdk#CoreStateful.ts#consent
- Native default pre-consent allow-list = `['identify', 'screen']`
  (`DEFAULT_NATIVE_ALLOWED_EVENT_TYPES` in the bridge, used when `allowedEventTypes` is unset),
  overriding Core's fail-closed `DEFAULT_ALLOWED_EVENT_TYPES = []`. Before event consent, `identify`
  and `screen` emit; entry views (`component`), taps (`component_click`), `page`, and custom `track`
  are blocked. Pass `allowedEventTypes: []` for strict opt-in, or a narrow custom list. source: optimization-js-bridge#index.ts#DEFAULT_NATIVE_ALLOWED_EVENT_TYPES; core-sdk#events/EventType.ts#DEFAULT_ALLOWED_EVENT_TYPES; core-sdk#consent/ConsentPolicy.ts#hasEventConsent
- `reset()` clears profile continuity (bridge `reset()` — which also clears overrides, the anonymous
  id, the current-screen dedupe tracker, and sticky-view keys — plus `store.clearProfileContinuity()`)
  but **preserves consent state**. `reset()` no-ops before initialization. source: extern:reset() clears continuity via bridge + store, keeps consent — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; optimization-js-bridge#index.ts#Bridge
- `UserDefaultsStore` is a write-through in-memory cache: getters read only the in-memory `cache`
  Map, and setters both update the cache and write JSON/string to `UserDefaults`. Persisted disk
  values are read **only at startup** (`loadConsentState`/`loadProfileContinuity`); runtime SDK state
  comes from bridge state pushes, never from re-reading disk. Consent stores always; continuity
  stores only when `persistenceConsent == true` and is cleared when `false`. Queues are never
  persisted (in-memory). source: extern:UserDefaultsStore write-through cache, disk read only at load — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Storage/UserDefaultsStore.swift#UserDefaultsStore
- Persisted persistence-consent falls back to persisted event consent when unset
  (`ConsentStoragePolicy.resolvePersistedPersistenceConsent`), mirroring the core storage-decode
  behavior. source: extern:resolvePersistedPersistenceConsent falls back to consent — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/StatefulPolicy.swift#ConsentStoragePolicy; core-sdk#consent/ConsentStorage.ts#resolvePersistedPersistenceConsent

## Version / runtime quirks

- Beta: the API, setup flow, and bridge contract are subject to change. source: extern:beta status — packages/ios/README.md
- JavaScriptCore bridge: `JSContextManager` creates **one `JSContext` per `OptimizationClient`
  lifetime**, registers the native polyfill bindings, evaluates the UMD bundle (polyfills prepended
  at build time), verifies `typeof __bridge === "object"`, registers the push-back native globals,
  and calls `__bridge.initialize(configJSON)`. The bundle is read from `Bundle.module`; a missing
  resource throws `OptimizationError.resourceLoadError`. source: extern:JSContextManager one JSContext per client, loads UMD, validates \_\_bridge — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Bridge/JSContextManager.swift#JSContextManager
- `NativePolyfills` registers Swift-backed `__nativeLog`, `__nativeSetTimeout`,
  `__nativeClearTimeout`, `__nativeRandomUUID`, and `__nativeFetch` before the bundle evaluates;
  `__nativeFetch` uses `URLSession` and brackets each crossing with `os_signpost` performance logs.
  The bridge pushes state back via `__nativeOnStateChange`, `__nativeOnEventEmitted`,
  `__nativeOnEventBlocked`, `__nativeOnFlagValueChanged`, `__nativeOnOverridesChanged`,
  `__nativeOnQueueEvent`. source: extern:NativePolyfills registers native fetch/timers/uuid/log — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Polyfills/NativePolyfills.swift#NativePolyfills; optimization-js-bridge#index.ts#NativeGlobal
- `@MainActor` client: all public bridge calls enter JavaScriptCore from the main actor; async
  bridge completions and native fetch/timer completions marshal back to the main queue
  (`DispatchQueue.main`) before re-entering JS. source: extern:OptimizationClient is @MainActor and bridge completions dispatch to main — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Bridge/JSContextManager.swift#JSContextManager; concept:ios-sdk-runtime-and-interaction-mechanics
- `setLocale(_:)` updates the SDK Experience-API and event locale (and republishes `client.locale`)
  but does **not** refetch Contentful entries or refresh profile state; the app must re-fetch CDA and
  re-render. It `throws` before init or on an invalid locale. source: extern:setLocale updates SDK locale only, throws pre-init/invalid — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient; concept:locale-handling-in-the-optimization-sdk-suite
- Live-updates / preview precedence: an open preview panel forces live updates in SwiftUI
  `OptimizedEntry` (overriding an explicit `liveUpdates: false`); otherwise per-entry `liveUpdates` >
  root default > locked. UIKit apps pick their own policy by subscribing to
  `$selectedOptimizations`/`$isPreviewPanelOpen`/`$previewState` and redrawing. source: extern:OptimizedEntry preview-open forces live — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift#OptimizedEntry; concept:ios-sdk-runtime-and-interaction-mechanics
- Offline / lifecycle delivery: `NetworkMonitor` (`NWPathMonitor`) calls `setOnline(_:)` on
  connectivity change and `flush()` on reconnect; `AppStateHandler` calls `flush()` on
  `willResignActive` (UIKit-only) for a best-effort background drain. Queues are in-memory only (no
  durable outbox), capped at 100 offline Experience events by default (`OFFLINE_QUEUE_MAX_EVENTS`,
  tunable via `QueuePolicy.offlineMaxEvents`); they do not survive process death. source: extern:NetworkMonitor NWPathMonitor + AppStateHandler background flush — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Handlers/NetworkMonitor.swift#NetworkMonitor; extern:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Handlers/AppStateHandler.swift#AppStateHandler; core-sdk#CoreStateful.ts#CoreStatefulConfig
- iOS Simulator reaches host `localhost` directly — there is no localhost rewrite in the SDK, and the
  reference app points base URLs straight at `http://localhost:8000` (contrast React Native, which
  rewrites `localhost` to `10.0.2.2` on the Android emulator). source: impl:ios-sdk#shared/Config.swift; extern:the iOS Simulator shares the host network so host localhost resolves without a rewrite — packages/ios/README.md
- Remote JS inspection (`JSContext.isInspectable`) is enabled only when `logLevel` is `.debug` or
  `.log` (iOS 16.4+/macOS 13.3+), keeping it out of release builds. AppKit is a supported fallback
  (macOS 12+), but the `AppStateHandler` background-flush path is UIKit-only. source: extern:isInspectable gated on debug/log logLevel — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Bridge/JSContextManager.swift#JSContextManager
- Preview panel: `PreviewPanelOverlay` (SwiftUI FAB + sheet) and `PreviewPanelViewController`
  (`.addFloatingButton(to:)` for UIKit) fetch `nt_audience`/`nt_experience` definitions through an
  app-supplied `PreviewContentfulClient` (100-entry paginated `ContentfulHTTPPreviewClient`), then
  call `loadDefinitions` so the bridge bakes a preview model. Opening/closing the panel toggles
  `client.isPreviewPanelOpen` (and the bridge `previewPanelOpen` signal). source: extern:PreviewPanelViewController.addFloatingButton + viewDidAppear toggles preview open — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Preview/PreviewPanelViewController.swift#PreviewPanelViewController; optimization-js-bridge#index.ts#Bridge

## Failure & fallback behavior

- Baseline fallback (no matching selection / unresolved links / all-locale payload): resolution
  returns the baseline entry and the UI does not break; denied/undecided consent surfaces as "no
  selections ⇒ baseline", not a blocked resolve. source: core-sdk#resolvers/OptimizedEntryResolver.ts#OptimizedEntryResolver; concept:entry-personalization-and-variant-resolution; kb:shared/concepts.md
- `OptimizationError` cases: `notInitialized`, `bridgeError(String)`, `resourceLoadError(String)`
  (UMD bundle/polyfill resource missing or unreadable), `configError(String)` (locale/serialization
  failures). source: extern:OptimizationError cases — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationError.swift#OptimizationError
- Before initialization: async event methods and `setLocale` throw `OptimizationError.notInitialized`
  (via `requireInitialized`); synchronous reads/consent/reset/setOnline no-op and
  `resolveOptimizedEntry` returns the baseline passthrough, `getFlag`/`getMergeTagValue`/`getProfile`
  return `nil`. source: extern:pre-init async methods throw notInitialized while sync APIs no-op or return baseline — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift#OptimizationClient
- JavaScriptCore exceptions are routed, not crashed: `callSync` captures the context exception,
  returns `nil`, and logs it; `callAsync` captures the exception and fails the continuation with
  `bridgeError`; the context `exceptionHandler` forwards uncaught exceptions to the diagnostic logger.
  The bridge itself returns/reports `SDK not initialized. Call initialize() first.` when its
  `CoreStateful` instance is absent. source: extern:callSync/callAsync capture JSC exceptions and route to logger/error — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Bridge/JSContextManager.swift#JSContextManager; optimization-js-bridge#index.ts#getCurrentInstance
- `UserDefaults` read/write failures are swallowed (`try?` on JSON encode/decode); a schema-invalid
  cached value is simply skipped and the SDK continues from in-memory state. source: extern:UserDefaultsStore guards JSON with try? and continues in-memory — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Storage/UserDefaultsStore.swift#UserDefaultsStore
- `PreviewPanelOverlay`/`OptimizationRoot(previewPanel:)` require the client in the environment; the
  overlay reads `@EnvironmentObject OptimizationClient`, so it must sit under an `OptimizationRoot`.
  The preview `ContentfulHTTPPreviewClient` throws `ContentfulPreviewError` on invalid URL / non-2xx
  / unparseable responses. source: extern:PreviewPanelOverlay needs OptimizationClient in environment and ContentfulPreviewError enumerates the fetch failures — packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Preview/PreviewContentfulClient.swift#ContentfulPreviewError
