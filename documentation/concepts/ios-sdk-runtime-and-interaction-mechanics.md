---
title: iOS SDK runtime and interaction mechanics
---

# iOS SDK runtime and interaction mechanics

Use this concept document to understand how the Optimization iOS SDK runs shared optimization
behavior in a native app, how SwiftUI and UIKit integrations share the same client, and how consent,
state, entry resolution, tracking, preview overrides, and offline delivery work.

This document applies to native apps on iOS 15 or later and macOS 12 or later. SwiftUI and UIKit
sections name runtime-specific APIs where behavior differs.

For step-by-step setup, see
[Integrating the Optimization iOS SDK in a SwiftUI app](../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)
and
[Integrating the Optimization iOS SDK in a UIKit app](../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md).
For the full Contentful entry contract, see
[Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime boundary](#runtime-boundary)
- [Prerequisites and runtime constraints](#prerequisites-and-runtime-constraints)
- [Lifecycle and main actor](#lifecycle-and-main-actor)
- [Configuration and locale handoff](#configuration-and-locale-handoff)
- [State and persistence](#state-and-persistence)
- [Consent and event gates](#consent-and-event-gates)
- [Entry optimization boundary](#entry-optimization-boundary)
- [Tracking mechanics](#tracking-mechanics)
- [Live updates and preview behavior](#live-updates-and-preview-behavior)
- [Offline and app lifecycle delivery](#offline-and-app-lifecycle-delivery)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## Runtime boundary

The iOS SDK is a native Swift Package named `ContentfulOptimization`. Swift owns native app concerns
such as persistence, networking, lifecycle handling, SwiftUI helpers, UIKit preview-panel
presentation, and app-facing public APIs.

Shared optimization behavior runs inside a local JavaScriptCore context. That bridge lets the iOS
SDK use the same optimization, profile, consent, and event-delivery behavior as the JavaScript SDKs
while exposing a Swift API to the application.

Applications do not call the JavaScript layer directly. The public boundary is Swift:

- `OptimizationClient` is the main facade for initialization, state, optimization, tracking, and
  preview controls.
- `OptimizationRoot`, `OptimizedEntry`, `OptimizationScrollView`, and `.trackScreen(name:)` provide
  SwiftUI integration helpers.
- `PreviewPanelViewController` provides the UIKit preview-panel host.

This split also defines what the SDK does not own. The application still fetches Contentful entries,
manages consent UX, controls routing, decides identity policy, and renders the final UI.

## Prerequisites and runtime constraints

Decide these policies before initialization because they shape the client state the bridge receives
at startup and the events it can emit before runtime consent changes:

| Constraint           | iOS behavior                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration        | `clientId` is required. `environment` defaults to `"main"`. `locale` configures the SDK Experience API and event locale; it does not choose the Contentful CDA locale for app-owned entry fetches.                                                                                                                                                                                                                     |
| Consent              | `state.consent` starts as unset unless `StorageDefaults.consent` or persisted SDK consent provides a value. Until event consent is `true`, iOS/native allow-list behavior lets only `identify` and `screen` emit by default.                                                                                                                                                                                           |
| Persistence consent  | Boolean `client.consent(true)` or `client.consent(false)` updates event consent and durable profile-continuity persistence consent together. Use split consent when event consent and durable profile continuity have separate policy decisions.                                                                                                                                                                       |
| Allowed event types  | `OptimizationConfig.allowedEventTypes` replaces the native default pre-consent allow-list. Pass `allowedEventTypes: []` for strict opt-in before any Optimization event, or pass a narrow custom list when legal and privacy review permits specific pre-consent events.                                                                                                                                               |
| Storage availability | iOS stores consent and, when persistence consent is `true`, profile-continuity values in `UserDefaults`. If storage has no usable value or is cleared, the SDK starts from configured defaults and does not restore profile-continuity state from a previous process.                                                                                                                                                  |
| Preview mode         | The preview panel is an app opt-in surface. Mount it only in debug or internal flows. Opening the panel sets `client.isPreviewPanelOpen`; SwiftUI `OptimizedEntry` treats that state as a live-update override, while UIKit apps must subscribe and redraw to reflect preview changes.                                                                                                                                 |
| Offline behavior     | Event queues are in memory. Events queued while offline flush when connectivity returns. On iOS/UIKit, app backgrounding triggers an online best-effort flush of queued events; it does not make an offline queue durable or flush while the device remains offline. `QueuePolicy` can tune caps, retry, backoff, circuit behavior, and callbacks, but the SDK does not provide a durable outbox across process death. |
| Configured defaults  | `StorageDefaults` are startup defaults and take precedence over persisted values. If the application persists user choices, leave consent and persistence defaults unset. Restore SDK-stored consent naturally, or call `client.consent(...)` from the resolved app policy instead of seeding every launch.                                                                                                            |

## Lifecycle and main actor

`OptimizationClient` has two phases:

| Phase         | Behavior                                                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uninitialized | The client exists, but the bridge is not loaded. Async event APIs and `setLocale(_:)` throw `OptimizationError.notInitialized`; many sync read, resolve, consent, reset, and online-state APIs return `nil`, baseline content, or no-op. |
| Initialized   | The bridge is loaded, startup defaults and eligible persisted state have been resolved, SDK state is available, network observers are active, and iOS/UIKit app lifecycle observers are active when UIKit is available.                  |

SwiftUI apps usually let `OptimizationRoot` call `initialize(config:)`. UIKit apps usually call
`initialize(config:)` from scene or app startup before passing the client into view controllers.

`OptimizationClient` is `@MainActor`. Call it from main-thread contexts such as SwiftUI view tasks,
SwiftUI event handlers, view-controller lifecycle methods, or `Task { @MainActor in ... }` blocks.
The compiler can flag background calls as concurrency errors.

Typical apps keep one `OptimizationClient` alive for the app or scene lifetime. Use `destroy()` for
test teardown or deliberate SDK reset flows.

## Configuration and locale handoff

Every iOS integration builds an `OptimizationConfig`:

```swift
OptimizationConfig(
    clientId: "your-client-id",
    environment: "main",
    locale: "en-US",
    logLevel: .debug
)
```

Only `clientId` is required. `environment` defaults to `"main"`. Base URL overrides belong only in
integrations that need non-default Experience API or Insights API endpoints.

Use top-level `locale` for the SDK Experience/event locale. When the application renders localized
Contentful entries, choose an app-owned Contentful locale and pass it to the app's Contentful
Delivery API request before entries are passed to `OptimizedEntry` or `resolveOptimizedEntry(...)`.
For the full locale model, see
[Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md).

## State and persistence

`OptimizationClient` is an `ObservableObject`. It publishes runtime state that SwiftUI and UIKit
code can observe:

| Surface                  | Description                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `state`                  | Snapshot of profile, consent, optimization readiness, and pending changes.                                         |
| `isInitialized`          | `true` after initialization completes.                                                                             |
| `selectedOptimizations`  | The selected optimization variants for the visitor.                                                                |
| `state.canOptimize`      | Whether selected optimization data is available for entry resolution.                                              |
| `optimizationPossible`   | Whether the current consent and allow-list configuration can produce optimization data.                            |
| `experienceRequestState` | Outcome of the most recent Experience API request.                                                                 |
| `locale`                 | Current SDK locale for Experience API requests and event context.                                                  |
| `isPreviewPanelOpen`     | `true` while the in-app preview panel is visible.                                                                  |
| `previewState`           | Preview override state used by the in-app preview panel.                                                           |
| `eventStream`            | Public passthrough event stream for debug surfaces and tests. It does not replay prior events to late subscribers. |
| `blockedEventStream`     | Public passthrough stream for events blocked by consent or allow-list gating.                                      |

SwiftUI code reads these values through `@EnvironmentObject`. UIKit code can subscribe through
Combine publishers such as `client.$state` and `client.$selectedOptimizations`.

Use `state.canOptimize` when rendering depends on variant data being available. Use
`optimizationPossible` when the app needs to know whether current consent and allow-list settings
can produce optimization data at all. For the cross-SDK distinction, see
[Core state management](./core-state-management.md#key-state-definitions).

Custom Flags use the same Core-backed model as the Web SDKs: `client.getFlag(_:)` returns the
current JSON value, and `client.flagPublisher(_:)` returns an `AnyPublisher<JSONValue?, Never>` that
updates on distinct value changes. Reading or subscribing to a flag can emit deduplicated flag-view
events when consent and profile state allow it, so treat flag delivery as an analytics exposure.

For the lower-level state model shared through the native bridge, see
[Core state management](./core-state-management.md).

The SDK persists consent with `UserDefaults`. When persistence consent is `true`, it also persists
profile-continuity values such as profile, selected changes, selected optimizations, and the
anonymous ID. `StorageDefaults` are startup defaults, not one-time seeds. During initialization,
configured defaults take precedence over persisted SDK values, so a configured consent or
persistence default can replace a visitor's stored choice on each launch.

Use `StorageDefaults(consent: true)` only when the application's policy is truly default-on at
startup. If the application persists user choices in a CMP, account setting, or app preference,
leave `StorageDefaults.consent` and `StorageDefaults.persistenceConsent` unset. Resolve the policy
at startup and call `client.consent(...)` after the client is available instead of seeding a choice
every launch. If the application relies on SDK consent storage, also leave those defaults unset so
the persisted SDK consent can restore naturally.

When durable profile-continuity persistence is allowed, the client writes profile-continuity values
to `UserDefaults` before publishing the corresponding state snapshot and selected optimizations.
Application code and XCUITest flows can wait for SDK-derived state rather than adding storage-timing
delays before relaunching.

## Consent and event gates

Consent is a three-state value: `true`, `false`, or unset. Until consent is granted, the SDK blocks
event types that are not allow-listed. iOS uses the native default allow-list when
`OptimizationConfig.allowedEventTypes` is unset:

| Consent state | Event behavior                                              |
| ------------- | ----------------------------------------------------------- |
| Unset         | `identify` and `screen` can emit; other events are blocked. |
| `true`        | All SDK event types can emit.                               |
| `false`       | `identify` and `screen` can emit; other events are blocked. |

This is the default iOS/native behavior, not a universal SDK rule. `allowedEventTypes` replaces the
default allow-list. Use `allowedEventTypes: []` when no Optimization event can emit before explicit
consent, or pass a custom list when policy permits specific pre-consent events. Allow-listed
pre-consent events still mark `context.gdpr.isConsentGiven` as `false` until event consent is
explicitly `true`.

Call `client.consent(true)` when the visitor grants consent and `client.consent(false)` when the
visitor rejects it. Boolean consent controls both event emission and durable profile-continuity
persistence by default. `client.consent(false)` clears event consent and persistence consent, purges
SDK queues, and clears SDK-managed durable profile-continuity storage while leaving active in-memory
state available until the app resets or tears down the client.

Use `client.consent(events:persistence:)` when event emission and durable profile continuity need
separate policy decisions. For example, this call allows events while keeping profile continuity
session-only:

```swift
client.consent(events: true, persistence: false)
```

`client.consent(events: false)` withdraws event consent and purges SDK queues, but it does not clear
persistence consent unless `persistence: false` is also passed.

Read `client.state.consent` for event consent and `client.state.persistenceConsent` for durable
profile-continuity persistence consent. For cross-SDK consent guidance, see
[Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md).

## Entry optimization boundary

Entry optimization is a local, synchronous decision once the app has both Contentful entry data and
selected optimizations.

The application provides:

- A single-locale Contentful entry dictionary.
- Linked optimization references and variant entries in the Contentful payload.
- An explicit `selectedOptimizations` snapshot only when the caller needs one.

The SDK returns either the baseline entry or the resolved variant entry:

```swift
let result = client.resolveOptimizedEntry(
    baseline: entry,
    selectedOptimizations: client.selectedOptimizations
)

let resolvedEntry = result.entry
let selectedOptimization = result.selectedOptimization
```

Omit `selectedOptimizations` when you want direct resolution to use the current bridge and client
state. Pass an explicit snapshot for locked UIKit screens or custom abstractions that must keep the
same variant until the app deliberately redraws or reloads that view.

`resolveOptimizedEntry` does not fetch Contentful entries, evaluate audiences, call the Experience
API, or mutate state. SwiftUI `OptimizedEntry` wraps the same boundary and adds component-level
behavior such as variant locking, live updates, and interaction tracking.

For the full data model and fallback behavior, see
[Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md).

## Tracking mechanics

The iOS SDK emits mobile screen events, custom business events, and Contentful entry interaction
events:

| Event type | SwiftUI path                   | UIKit path                                                            |
| ---------- | ------------------------------ | --------------------------------------------------------------------- |
| Screen     | `.trackScreen(name:)`          | `client.trackCurrentScreen(...)`                                      |
| Event      | App-owned event handlers       | `client.track(event:properties:)`                                     |
| Entry view | `OptimizedEntry` view tracking | `ViewTrackingController` or `client.trackView(TrackViewPayload(...))` |
| Entry tap  | `OptimizedEntry` tap tracking  | `client.trackClick(TrackClickPayload(...))`                           |

SDK-managed entry interaction tracking uses these defaults:

- Entry view and tap tracking are enabled by default.
- Initial view event after 2 seconds at 80% visibility.
- Periodic duration updates every 5 seconds while the entry remains visible.
- Final duration update when the entry leaves view after a view event has already fired.
- On iOS/UIKit, backgrounding pauses active view cycles. If the cycle has already emitted a view
  event, `pause()` emits a final duration update; foreground resume re-evaluates visibility and
  starts a fresh cycle when the entry is still eligible.

SwiftUI `OptimizedEntry` and UIKit `ViewTrackingController` can tune `minVisibleRatio`,
`dwellTimeMs`, and `viewDurationUpdateIntervalMs` per entry. Wrap scrollable SwiftUI content in
`OptimizationScrollView` when view timing needs an accurate viewport.

UIKit does not have automatic component visibility tracking. UIKit apps compute visibility and
duration through their own table, collection, or view-controller callbacks. Use
`ViewTrackingController` to apply the SDK visibility timing model, or call
`client.trackView(TrackViewPayload(...))` directly when an app-owned abstraction already computes
view duration. Call `client.trackClick(TrackClickPayload(...))` from UIKit control actions or
gesture recognizers.

## Live updates and preview behavior

SwiftUI `OptimizedEntry` locks to the first resolved variant by default. Locking prevents content
from changing while a visitor is reading it. Enable live updates when a component needs to react to
profile changes or preview overrides without a reload.

SwiftUI live-update precedence is:

| Preview panel | Global default | Per-entry override | Result |
| ------------- | -------------- | ------------------ | ------ |
| Open          | Any            | Any                | Live   |
| Closed        | `true`         | `nil`              | Live   |
| Closed        | `false`        | `true`             | Live   |
| Closed        | `true`         | `false`            | Locked |
| Closed        | `false`        | `nil`              | Locked |

Opening the preview panel sets `client.isPreviewPanelOpen`. SwiftUI `OptimizedEntry` treats that
state as a live-update override, so audience and variant overrides apply immediately in those
components. When the panel closes, entries that return to locked mode snapshot the current
`client.selectedOptimizations` value and keep the previewed variant. Entries whose global default or
per-entry override remains live continue to follow `client.selectedOptimizations`.

UIKit apps choose their own live-update policy. Subscribe to `client.$selectedOptimizations`,
`client.$isPreviewPanelOpen`, or `client.$previewState` and redraw views for live behavior, or keep
a selected-optimizations snapshot for locked behavior. Treat `client.isPreviewPanelOpen` as a reason
to redraw in live mode while previewing; the SDK does not automatically rebuild UIKit views.

## Offline and app lifecycle delivery

The SDK monitors network reachability. On iOS/UIKit, it also observes app lifecycle events. No
configuration is required for the default offline path, and queueing and flushing use the same
event-delivery model for SwiftUI and UIKit integrations.

Default delivery behavior:

- Experience events queue in memory when the device is offline.
- Core caps the offline Experience queue at 100 events by default. When the queue is full, it drops
  the oldest offline events before accepting the next event.
- Insights events batch in memory by profile and flush periodically or when the batch reaches the
  Core batch threshold.
- Queued events flush when connectivity returns. On iOS/UIKit, the SDK also performs an online
  best-effort flush when the app moves toward the background; if the device remains offline, queued
  events wait for reconnect.
- Queues do not survive process death. Keep one `OptimizationClient` alive for the app or scene
  lifetime to preserve queued events across transient connectivity changes.

Use `OptimizationConfig(queuePolicy:)` when production behavior needs non-default delivery
constraints. `QueuePolicy.offlineMaxEvents` changes the Experience offline cap, `QueueFlushPolicy`
configures retry timing, backoff, jitter, failure thresholds, and circuit-open timing, and queue
callbacks report offline drops, flush failures, circuit-open events, and recovery. Call
`client.flush()` only for deliberate app-owned checkpoints; reconnect flushing and iOS/UIKit
background flushing already perform best-effort delivery.

## Related documentation

- [Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md) - Package
  installation, quick start, and published package status.
- [Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md) -
  Cross-SDK consent, persistence consent, allow-list, and withdrawal policy guidance.
- [Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md) -
  How SDK Experience/event locales relate to Contentful entry locales.
- [Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md) -
  Contentful entry contract, variant fallback behavior, and local resolution mechanics.
- [Core state management](./core-state-management.md) - Shared state, consent, persistence, event
  queues, and observable mechanics used through the native bridge.
- [Integrating the Optimization iOS SDK in a SwiftUI app](../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md) -
  SwiftUI setup flow for `OptimizationRoot`, `OptimizedEntry`, screen tracking, and preview panel
  mounting.
- [Integrating the Optimization iOS SDK in a UIKit app](../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md) -
  UIKit setup flow for direct `OptimizationClient` usage, manual entry resolution, tracking, and
  preview panel mounting.
- [iOS reference implementation](../../implementations/ios-sdk/README.md) - Native iOS validation
  app with SwiftUI and UIKit shells.
