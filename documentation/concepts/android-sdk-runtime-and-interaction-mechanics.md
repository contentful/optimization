---
title: Android SDK runtime and interaction mechanics
---

# Android SDK runtime and interaction mechanics

Use this concept document to understand how the Optimization Android SDK runs shared optimization
behavior in a native app, how Compose and XML Views integrations share the same client model, and
how consent, state, entry resolution, tracking, preview overrides, and offline delivery work.

For step-by-step setup, see
[Integrating the Optimization Android SDK in a Jetpack Compose app](../guides/integrating-the-optimization-android-sdk-in-a-compose-app.md)
and
[Integrating the Optimization Android SDK in an XML Views app](../guides/integrating-the-optimization-android-sdk-in-a-views-app.md).
For the full Contentful entry contract, see
[Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime boundary](#runtime-boundary)
- [Prerequisites and runtime constraints](#prerequisites-and-runtime-constraints)
- [Lifecycle and coroutines](#lifecycle-and-coroutines)
- [Configuration and locale handoff](#configuration-and-locale-handoff)
- [State and persistence](#state-and-persistence)
- [Consent and event gates](#consent-and-event-gates)
- [Entry optimization boundary](#entry-optimization-boundary)
- [Adapter surfaces](#adapter-surfaces)
- [Tracking mechanics](#tracking-mechanics)
- [Live updates and preview behavior](#live-updates-and-preview-behavior)
- [Offline and app lifecycle delivery](#offline-and-app-lifecycle-delivery)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## Runtime boundary

The Android SDK is a native Kotlin Android library published as
`com.contentful.java:optimization-android`. Kotlin owns native app concerns such as persistence,
networking, lifecycle handling, Compose helpers, XML Views helpers, preview-panel UI, and app-facing
public APIs.

Shared optimization behavior runs inside a local QuickJS context. That bridge lets the Android SDK
use the same optimization, profile, consent, and event-delivery behavior as the JavaScript SDKs
while exposing a Kotlin API to the application.

Applications do not call the JavaScript layer directly. The public boundary is Kotlin:

- `OptimizationClient` is the main facade for initialization, state, optimization, tracking, and
  preview controls.
- `OptimizationRoot`, `OptimizedEntry`, `OptimizationLazyColumn`, and `ScreenTrackingEffect` provide
  Compose integration helpers.
- `OptimizationManager`, `OptimizedEntryView`, `TrackingRecyclerView`, and `ScreenTracker` provide
  XML Views integration helpers.
- `PreviewPanelConfig` wires the in-app preview panel into Compose and XML Views integrations.

This split also defines what the SDK does not own. The application still fetches Contentful entries,
manages consent UX, controls routing, decides identity policy, and renders the final UI.

## Prerequisites and runtime constraints

Decide these policies before initialization because they shape the client state the bridge receives
at startup and the events it can emit before runtime consent changes:

| Constraint           | Android behavior                                                                                                                                                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent              | `state.consent` starts as unset unless `StorageDefaults.consent` or persisted SDK consent provides a value. Until event consent is `true`, Android/native allow-list behavior lets only `identify` and `screen` emit by default.                                                                                     |
| Configuration        | Build `OptimizationConfig` before initialization. `clientId` is required, `environment` defaults to `"main"`, and `locale` controls the SDK Experience/event locale. Apps often pass the same string to Contentful CDA requests, but the SDK treats that as a separate app-owned locale.                             |
| Persistence consent  | Boolean `client.consent(true)` or `client.consent(false)` updates event consent and durable profile-continuity persistence consent together. Use object-form consent when event consent and durable profile continuity have separate policy decisions.                                                               |
| Allowed event types  | `OptimizationConfig.allowedEventTypes` replaces the native default pre-consent allow-list. Pass `allowedEventTypes = emptyList()` for strict opt-in before any Optimization event, or pass a narrow custom list when legal and privacy review permits specific pre-consent events.                                   |
| Storage availability | Android stores consent and, when persistence consent is `true`, profile-continuity values in `SharedPreferences`. If storage has no usable value or is cleared, the SDK starts from configured defaults and does not restore profile-continuity state from a previous process.                                       |
| Preview mode         | The preview panel is an app opt-in surface. Mount it only in debug or internal flows; opening it forces live entry updates so audience and variant overrides are visible immediately.                                                                                                                                |
| Offline behavior     | Event queues are in memory. Events queued while offline flush when connectivity returns. The SDK also tries to flush queued events when the app moves toward the background, but it does not provide a durable outbox across process death.                                                                          |
| Configured defaults  | `StorageDefaults` are startup defaults and take precedence over persisted values. If the application persists user choices, leave consent and persistence defaults unset. Restore SDK-stored consent naturally, or call `client.consent(...)` from the resolved app policy instead of seeding a choice every launch. |

## Lifecycle and coroutines

`OptimizationClient` has two phases:

| Phase         | Behavior                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uninitialized | The client exists, but the bridge is not loaded. Suspend APIs throw or return safe fallbacks depending on the call, and sync APIs no-op where appropriate. |
| Initialized   | The bridge is loaded, persisted state has been merged into configuration, SDK state is available, and lifecycle/network observers are active.              |

Compose apps usually let `OptimizationRoot` create the client and call `initialize(config)`. XML
Views apps usually call `OptimizationManager.initialize(...)` from `Application.onCreate` before
reading `OptimizationManager.client` from activities or fragments. Because
`OptimizationManager.initialize(...)` initializes the client asynchronously, direct suspend API
calls from Views code must wait for `OptimizationManager.client.isInitialized.first { it }`.

`OptimizationClient` exposes async work as `suspend` functions. Call those methods from Compose
effects, View event-handler coroutine scopes, lifecycle-aware coroutines, or another app-owned
coroutine scope.

The QuickJS runtime runs on a dedicated single-thread dispatcher owned by the SDK. Application code
must use the public Kotlin APIs instead of trying to access the bridge directly.

Typical apps keep one client alive for the app process lifetime. Use `destroy()` for test teardown
or deliberate SDK reset flows.

## Configuration and locale handoff

Every Android integration builds an `OptimizationConfig`:

```kotlin
OptimizationConfig(
    clientId = "your-client-id",
    environment = "main",
    locale = "en-US",
    logLevel = if (BuildConfig.DEBUG) OptimizationLogLevel.debug else OptimizationLogLevel.error,
)
```

Only `clientId` is required. `environment` defaults to `"main"`. Base URL overrides belong only in
integrations that need non-default Experience API or Insights API endpoints.

Use top-level `locale` for the SDK Experience/event locale. When the application renders localized
Contentful entries, choose an app-owned Contentful locale and pass it to the app's Contentful
Delivery API request before entries are passed to `OptimizedEntry`, `OptimizedEntryView`, or
`resolveOptimizedEntry(...)`. For the full locale model, see
[Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md).

## State and persistence

`OptimizationClient` publishes runtime state through Kotlin flows:

| Surface                  | Description                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ |
| `state`                  | Snapshot of profile, consent, optimization readiness, and pending changes.     |
| `isInitialized`          | `true` after initialization completes.                                         |
| `selectedOptimizations`  | The selected optimization variants for the visitor.                            |
| `state.canOptimize`      | Whether selected optimization data is available for entry resolution.          |
| `optimizationPossible`   | Whether the current consent and allow-list configuration can produce variants. |
| `experienceRequestState` | Outcome of the most recent Experience API request.                             |
| `locale`                 | Current SDK locale for Experience API requests and event context.              |
| `isPreviewPanelOpen`     | `true` while the in-app preview panel is visible.                              |
| `previewState`           | Preview override state used by the in-app preview panel.                       |
| `eventStream`            | Raw event stream for debug surfaces and tests.                                 |
| `blockedEventStream`     | Events blocked by consent gating.                                              |

Compose code reads these values through `collectAsState()` or effects. XML Views code usually
collects them from lifecycle-aware coroutines.

Android also exposes the current SDK Experience/event locale as `client.locale`. Call
`client.setLocale(locale)` after initialization to update future Experience API requests and event
context.

Custom Flags use the same Core-backed model as the Web SDKs: `client.getFlag(name)` returns the
current JSON value, and `client.observeFlag(name)` returns a `StateFlow<JSONValue?>` that updates on
distinct value changes. Both one-off reads and subscriptions can emit deduplicated flag-view events
for delivered values when consent and profile state allow.

For the lower-level state model shared through the native bridge, see
[Core state management](./core-state-management.md).

The SDK persists consent with `SharedPreferences`. When persistence consent is `true`, it also
persists profile-continuity values such as profile, selected changes, selected optimizations, and
the anonymous ID. `StorageDefaults` are startup defaults, not one-time seeds. During initialization,
configured defaults take precedence over persisted SDK values, so a configured consent or
persistence default can replace a visitor's stored choice on each launch.

Use `StorageDefaults(consent = true)` only when the application's policy is truly default-on at
startup. If the application persists user choices in a CMP, account setting, or app preference,
leave `StorageDefaults.consent` and `StorageDefaults.persistenceConsent` unset. Resolve the policy
at startup and call `client.consent(...)` after the client is available instead of seeding a choice
every launch. If the application relies on SDK consent storage, also leave those defaults unset so
the persisted SDK consent can restore naturally.

## Consent and event gates

Consent is a three-state value: `true`, `false`, or unset. Until consent is granted, the SDK blocks
event types that are not allow-listed. Android uses the native default allow-list when
`OptimizationConfig.allowedEventTypes` is unset:

| Consent state | Event behavior                                              |
| ------------- | ----------------------------------------------------------- |
| Unset         | `identify` and `screen` can emit; other events are blocked. |
| `true`        | All SDK event types can emit.                               |
| `false`       | `identify` and `screen` can emit; other events are blocked. |

This is the default Android/native behavior, not a universal SDK rule. `allowedEventTypes` replaces
the default allow-list. Use `allowedEventTypes = emptyList()` when no Optimization event can emit
before explicit consent, or pass a custom list when policy permits specific pre-consent events.
Allow-listed pre-consent events still mark `context.gdpr.isConsentGiven` as `false` until event
consent is explicitly `true`.

Call `client.consent(true)` when the visitor grants consent and `client.consent(false)` when the
visitor rejects it. Boolean consent controls both event emission and durable profile-continuity
persistence by default. `client.consent(false)` clears event consent and persistence consent, purges
SDK queues, and clears SDK-managed durable profile-continuity storage while leaving active in-memory
state available until the app resets or tears down the client.

Use object-form consent when event emission and durable profile continuity need separate policy
decisions. For example, `client.consent(events = true, persistence = false)` allows events while
keeping profile continuity session-only. `client.consent(events = false)` withdraws event consent
and purges SDK queues, but it does not clear persistence consent unless `persistence = false` is
also passed. For cross-SDK consent guidance, see
[Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md).

## Entry optimization boundary

Entry optimization is a local decision once the app has both Contentful entry data and selected
optimizations.

The application provides:

- A single-locale Contentful entry map.
- Linked optimization references and variant entries in the Contentful payload.
- An optional selected-optimizations snapshot when a custom abstraction needs deterministic
  resolution.

The SDK returns either the baseline entry or the resolved variant entry:

```kotlin
val result = client.resolveOptimizedEntry(baseline = entry)

val resolvedEntry = result.entry
val selectedOptimization = result.selectedOptimization
val optimizationContextId = result.optimizationContextId
```

When resolving directly, omit `selectedOptimizations` to use current client state, or pass an
explicit snapshot such as `client.selectedOptimizations.value` when a custom abstraction needs
deterministic resolution. `resolveOptimizedEntry(...)` does not fetch Contentful entries, evaluate
audiences, call the Experience API, or mutate public profile, consent, or selected-optimizations
state. In a stateful client, matched resolution can register an opaque tracking context and return
`optimizationContextId`. Pass that value to manual `TrackViewPayload` or `TrackClickPayload` calls
when emitting interactions for the resolved entry yourself. Compose `OptimizedEntry` and XML Views
`OptimizedEntryView` wrap the same boundary and add component-level behavior such as variant
locking, live updates, and interaction tracking.

For the full data model and fallback behavior, see
[Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md).

## Adapter surfaces

The Android SDK exposes two public UI adapter packages over the same core client:

| App style | Initialization path              | Entry rendering path | Screen tracking path   | Scroll tracking helper   |
| --------- | -------------------------------- | -------------------- | ---------------------- | ------------------------ |
| Compose   | `OptimizationRoot`               | `OptimizedEntry`     | `ScreenTrackingEffect` | `OptimizationLazyColumn` |
| XML Views | `OptimizationManager.initialize` | `OptimizedEntryView` | `ScreenTracker`        | `TrackingRecyclerView`   |

Both adapters use the same `OptimizationClient`, persistence model, bridge runtime, event gates,
locale resolution, and preview override state. Choose the adapter that matches the UI framework of
the screen you are integrating.

## Tracking mechanics

The Android SDK emits page context events, mobile screen events, custom business events, and
Contentful entry interaction events:

| Event type | Compose path                   | XML Views path                     |
| ---------- | ------------------------------ | ---------------------------------- |
| Page       | `client.page(...)`             | `client.page(...)`                 |
| Screen     | `ScreenTrackingEffect`         | `ScreenTracker.trackScreen(...)`   |
| Event      | App-owned event handlers       | App-owned event handlers           |
| Entry view | `OptimizedEntry` view tracking | `OptimizedEntryView` view tracking |
| Entry tap  | `OptimizedEntry` tap tracking  | `OptimizedEntryView` tap tracking  |

Entry interaction tracking uses these defaults:

- Entry view and tap tracking are enabled by default in both Compose and XML Views.
- Initial view event after 2 seconds at 80% visibility.
- Periodic duration updates every 5 seconds while the entry remains visible.
- Final duration update when the entry leaves view after a view event has already fired.

`OptimizedEntry` and `OptimizedEntryView` can tune `minVisibleRatio`, `dwellTimeMs`, and
`viewDurationUpdateIntervalMs` per entry. Use `OptimizationLazyColumn` in Compose and
`TrackingRecyclerView` in XML Views when view timing needs scroll-aware visibility updates.

Applications can also call `page(...)`, `track(...)`, `trackView(...)`, and `trackClick(...)`
directly when they need to emit page context, custom business events, or entry interactions from a
custom UI abstraction.

## Live updates and preview behavior

`OptimizedEntry` and `OptimizedEntryView` lock to the first resolved variant by default. Locking
prevents content from changing while a visitor is reading it. Enable live updates when a component
needs to react to profile changes or preview overrides without a reload.

Android live-update precedence is:

| Preview panel | Global default | Per-entry override | Result |
| ------------- | -------------- | ------------------ | ------ |
| Open          | Any            | Any                | Live   |
| Closed        | `true`         | `null`             | Live   |
| Closed        | `false`        | `true`             | Live   |
| Closed        | `true`         | `false`            | Locked |
| Closed        | `false`        | `null`             | Locked |

When the preview panel is open, all `OptimizedEntry` and `OptimizedEntryView` components update live
so audience and variant overrides apply immediately. When the panel closes, non-live optimized
entries without an explicit selected-optimizations override lock to the previewed selection. Live
entries continue to follow current `selectedOptimizations`, and Views entries with caller-supplied
selected optimizations continue resolving from that explicit value.

Compose apps mount the preview panel through
`OptimizationRoot(previewPanel = PreviewPanelConfig(...))`. XML Views apps mount the Activity
floating entry point by calling `OptimizationManager.attachPreviewPanel(...)`.
`OptimizationManager.initialize(...)` receives `PreviewPanelConfig` so the manager can retain the
optional preview Contentful client used for preview-definition fetching.

## Offline and app lifecycle delivery

The Android SDK monitors network reachability and app lifecycle events:

- When the device is offline, events queue in memory.
- When connectivity returns, queued events flush automatically.
- When the app moves toward the background, the SDK flushes queued events to reduce data loss.

No configuration is required for this behavior. Queueing and flushing use the same event-delivery
model for Compose and XML Views integrations.

## Related documentation

- [Optimization Android SDK README](../../packages/android/README.md) - Package installation, quick
  start, and published package status.
- [Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md) -
  Cross-SDK consent, persistence consent, allow-list, and withdrawal policy guidance.
- [Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md) -
  How SDK Experience/event locales relate to Contentful entry locales.
- [Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md) -
  Contentful entry contract, variant fallback behavior, and local resolution mechanics.
- [Core state management](./core-state-management.md) - Shared state, consent, persistence, event
  queues, and observable mechanics used through the native bridge.
- [Integrating the Optimization Android SDK in a Jetpack Compose app](../guides/integrating-the-optimization-android-sdk-in-a-compose-app.md) -
  Compose setup flow for `OptimizationRoot`, `OptimizedEntry`, screen tracking, and preview panel
  mounting.
- [Integrating the Optimization Android SDK in an XML Views app](../guides/integrating-the-optimization-android-sdk-in-a-views-app.md) -
  XML Views setup flow for `OptimizationManager`, `OptimizedEntryView`, screen tracking, and preview
  panel mounting.
- [Android reference implementation](../../implementations/android-sdk/README.md) - Native Android
  validation app with Compose and XML Views shells.
