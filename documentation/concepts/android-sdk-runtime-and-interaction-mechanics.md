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
[Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime boundary](#runtime-boundary)
- [Lifecycle and coroutines](#lifecycle-and-coroutines)
- [Configuration and locale handoff](#configuration-and-locale-handoff)
- [State and persistence](#state-and-persistence)
- [Consent and event gates](#consent-and-event-gates)
- [Entry personalization boundary](#entry-personalization-boundary)
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
use the same personalization, profile, consent, and event-delivery behavior as the JavaScript SDKs
while exposing a Kotlin API to the application.

Applications do not call the JavaScript layer directly. The public boundary is Kotlin:

- `OptimizationClient` is the main facade for initialization, state, personalization, tracking, and
  preview controls.
- `OptimizationRoot`, `OptimizedEntry`, `OptimizationLazyColumn`, and `ScreenTrackingEffect` provide
  Compose integration helpers.
- `OptimizationManager`, `OptimizedEntryView`, `TrackingRecyclerView`, and `ScreenTracker` provide
  XML Views integration helpers.
- `PreviewPanelConfig` wires the in-app preview panel into Compose and XML Views integrations.

This split also defines what the SDK does not own. The application still fetches Contentful entries,
manages consent UX, controls routing, decides identity policy, and renders the final UI.

## Lifecycle and coroutines

`OptimizationClient` has two phases:

| Phase         | Behavior                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uninitialized | The client exists, but the bridge is not loaded. Suspend APIs throw or return safe fallbacks depending on the call, and sync APIs no-op where appropriate. |
| Initialized   | The bridge is loaded, persisted state has been merged into configuration, SDK state is available, and lifecycle/network observers are active.              |

Compose apps usually let `OptimizationRoot` create the client and call `initialize(config)`. XML
Views apps usually call `OptimizationManager.initialize(...)` from `Application.onCreate` before
reading `OptimizationManager.client` from activities or fragments.

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
    environment = "master",
    contentfulLocales = ContentfulLocales(default = "en-US"),
    locale = "en-US",
    defaults = StorageDefaults(consent = true),
    debug = BuildConfig.DEBUG,
)
```

Only `clientId` is required. `environment` defaults to `"master"`. Base URL overrides belong only in
integrations that need non-default Experience API or Insights API endpoints.

Use `contentfulLocales` and `locale` when the application renders localized Contentful entries. The
resolved `client.locale` belongs in the app-owned Contentful Delivery API request before entries are
passed to `OptimizedEntry`, `OptimizedEntryView`, or `personalizeEntry(...)`.

`OptimizationApiConfig.locale` is an explicit Experience API locale override. It does not replace
the CDA locale used to fetch entries. For the full locale model, see
[Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md).

## State and persistence

`OptimizationClient` publishes runtime state through Kotlin flows:

| Surface                    | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `state`                    | Snapshot of profile, consent, personalization readiness, and pending changes. |
| `isInitialized`            | `true` after initialization completes.                                        |
| `selectedPersonalizations` | The personalizations the visitor qualifies for.                               |
| `isPreviewPanelOpen`       | `true` while the in-app preview panel is visible.                             |
| `previewState`             | Preview override state used by the in-app preview panel.                      |
| `events`                   | Raw event stream for debug surfaces and tests.                                |

Compose code reads these values through `collectAsState()` or effects. XML Views code usually
collects them from lifecycle-aware coroutines.

The SDK persists state with `SharedPreferences`. `StorageDefaults` can seed values such as consent,
profile, selected changes, and personalizations on first launch. Seeds are applied only when no
persisted value exists, so an existing user choice is not overwritten.

## Consent and event gates

Consent is a three-state value: `true`, `false`, or unset. Until consent is granted, the SDK blocks
most Analytics events. `identify` and `screen` are allowed before consent so the mobile journey can
establish profile context and anonymous screen analytics.

| Consent state | Event behavior                                              |
| ------------- | ----------------------------------------------------------- |
| Unset         | `identify` and `screen` can emit; other events are blocked. |
| `true`        | All event types can emit.                                   |
| `false`       | `identify` and `screen` can emit; other events are blocked. |

Call `client.consent(true)` when the visitor grants consent and `client.consent(false)` when the
visitor rejects it. The value is persisted and restored on later launches.

## Entry personalization boundary

Entry personalization is a local decision once the app has both Contentful entry data and selected
personalizations.

The application provides:

- A single-locale Contentful entry map.
- Linked optimization references and variant entries in the Contentful payload.
- The current `selectedPersonalizations` value from the client, when resolving directly.

The SDK returns either the baseline entry or the resolved variant entry:

```kotlin
val result = client.personalizeEntry(
    baseline = entry,
    personalizations = client.selectedPersonalizations.value,
)

val resolvedEntry = result.entry
val personalization = result.personalization
```

`personalizeEntry(...)` does not fetch Contentful entries, evaluate audiences, call the Experience
API, or mutate state. Compose `OptimizedEntry` and XML Views `OptimizedEntryView` wrap the same
boundary and add component-level behavior such as variant locking, live updates, and interaction
tracking.

For the full data model and fallback behavior, see
[Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md).

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

The Android SDK emits mobile screen events and Contentful entry interaction events:

| Event type | Compose path                   | XML Views path                     |
| ---------- | ------------------------------ | ---------------------------------- |
| Screen     | `ScreenTrackingEffect`         | `ScreenTracker.trackScreen(...)`   |
| Entry view | `OptimizedEntry` view tracking | `OptimizedEntryView` view tracking |
| Entry tap  | `OptimizedEntry` tap tracking  | `OptimizedEntryView` tap tracking  |

Entry view tracking uses these defaults:

- Initial view event after 2 seconds at 80% visibility.
- Periodic duration updates every 5 seconds while the entry remains visible.
- Final duration update when the entry leaves view after a view event has already fired.

`OptimizedEntry` and `OptimizedEntryView` can tune the visibility threshold, initial time, and
update interval per entry. Use `OptimizationLazyColumn` in Compose and `TrackingRecyclerView` in XML
Views when view timing needs scroll-aware visibility updates.

Applications can also call `trackView(...)` and `trackClick(...)` directly when they need to emit
events from a custom UI abstraction.

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
so audience and variant overrides apply immediately. When the panel closes, components keep the
previewed variant as the locked value.

Compose apps pass `PreviewPanelConfig` to `OptimizationRoot`. XML Views apps pass the optional
preview content client to `OptimizationManager.initialize(...)` and call
`OptimizationManager.attachPreviewPanel(...)` from activities that display the floating preview
entry point.

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
- [Integrating the Optimization Android SDK in a Jetpack Compose app](../guides/integrating-the-optimization-android-sdk-in-a-compose-app.md) -
  Compose setup flow for `OptimizationRoot`, `OptimizedEntry`, screen tracking, and preview panel
  mounting.
- [Integrating the Optimization Android SDK in an XML Views app](../guides/integrating-the-optimization-android-sdk-in-a-views-app.md) -
  XML Views setup flow for `OptimizationManager`, `OptimizedEntryView`, screen tracking, and preview
  panel mounting.
- [Android reference implementation](../../implementations/android-sdk/README.md) - Native Android
  validation app with Compose and XML Views shells.
