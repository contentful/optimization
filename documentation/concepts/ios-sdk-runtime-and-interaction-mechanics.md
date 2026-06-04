---
title: iOS SDK runtime and interaction mechanics
---

# iOS SDK runtime and interaction mechanics

Use this concept document to understand how the Optimization iOS SDK runs shared optimization
behavior in a native app, how SwiftUI and UIKit integrations share the same client, and how consent,
state, entry resolution, tracking, preview overrides, and offline delivery work.

For step-by-step setup, see
[Integrating the Optimization iOS SDK in a SwiftUI app](../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)
and
[Integrating the Optimization iOS SDK in a UIKit app](../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md).
For the full Contentful entry contract, see
[Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime boundary](#runtime-boundary)
- [Lifecycle and main actor](#lifecycle-and-main-actor)
- [Configuration and locale handoff](#configuration-and-locale-handoff)
- [State and persistence](#state-and-persistence)
- [Consent and event gates](#consent-and-event-gates)
- [Entry personalization boundary](#entry-personalization-boundary)
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
SDK use the same personalization, profile, consent, and event-delivery behavior as the JavaScript
SDKs while exposing a Swift API to the application.

Applications do not call the JavaScript layer directly. The public boundary is Swift:

- `OptimizationClient` is the main facade for initialization, state, personalization, tracking, and
  preview controls.
- `OptimizationRoot`, `OptimizedEntry`, `OptimizationScrollView`, and `.trackScreen(name:)` provide
  SwiftUI integration helpers.
- `PreviewPanelViewController` provides the UIKit preview-panel host.

This split also defines what the SDK does not own. The application still fetches Contentful entries,
manages consent UX, controls routing, decides identity policy, and renders the final UI.

## Lifecycle and main actor

`OptimizationClient` has two phases:

| Phase         | Behavior                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uninitialized | The client exists, but the bridge is not loaded. Async APIs throw `OptimizationError.notInitialized`; sync APIs return safe defaults or no-op where appropriate. |
| Initialized   | The bridge is loaded, persisted state has been merged into configuration, SDK state is available, and lifecycle/network observers are active.                    |

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
    environment: "master",
    contentfulLocales: ContentfulLocales(default: "en-US"),
    locale: "en-US",
    debug: true
)
```

Only `clientId` is required. `environment` defaults to `"master"`. Base URL overrides belong only in
integrations that need non-default Experience API or Insights API endpoints.

Use `contentfulLocales` and `locale` when the application renders localized Contentful entries. The
resolved `client.locale` belongs in the app-owned Contentful Delivery API request before entries are
passed to `OptimizedEntry` or `personalizeEntry(...)`.

`OptimizationApiConfig.locale` is an explicit Experience API locale override. It does not replace
the CDA locale used to fetch entries. For the full locale model, see
[Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md).

## State and persistence

`OptimizationClient` is an `ObservableObject`. It publishes runtime state that SwiftUI and UIKit
code can observe:

| Surface                    | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `state`                    | Snapshot of profile, consent, personalization readiness, and pending changes. |
| `isInitialized`            | `true` after initialization completes.                                        |
| `selectedPersonalizations` | The personalizations the visitor qualifies for.                               |
| `isPreviewPanelOpen`       | `true` while the in-app preview panel is visible.                             |
| `eventPublisher`           | Raw event stream for debug surfaces and tests.                                |

SwiftUI code reads these values through `@EnvironmentObject`. UIKit code can subscribe through
Combine publishers such as `client.$state` and `client.$selectedPersonalizations`.

The SDK persists state with `UserDefaults`. `StorageDefaults` can seed values such as consent,
profile-continuity persistence consent, profile, selected changes, and personalizations on first
launch. Seeds are applied only when no persisted value exists, so an existing user choice is not
overwritten.

When durable profile-continuity persistence is allowed, the client writes profile-continuity values
to `UserDefaults` before publishing the corresponding state snapshot and selected personalizations.
Application code and XCUITest flows can wait for SDK-derived state rather than adding storage-timing
delays before relaunching.

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
visitor rejects it. Boolean consent controls both event emission and durable profile-continuity
persistence by default. Use `client.consent(events:persistence:)` when event emission and durable
profile continuity need separate policy decisions:

```swift
client.consent(events: true, persistence: false)
```

Read `client.state.consent` for event consent and `client.state.persistenceConsent` for durable
profile-continuity persistence consent. Withdrawing consent purges SDK queues and clears SDK-managed
durable profile-continuity storage while leaving active in-memory state available until the app
resets or tears down the client.

## Entry personalization boundary

Entry personalization is a local, synchronous decision once the app has both Contentful entry data
and selected personalizations.

The application provides:

- A single-locale Contentful entry dictionary.
- Linked optimization references and variant entries in the Contentful payload.
- The current `selectedPersonalizations` value from the client, when resolving directly.

The SDK returns either the baseline entry or the resolved variant entry:

```swift
let result = client.personalizeEntry(
    baseline: entry,
    personalizations: client.selectedPersonalizations
)

let resolvedEntry = result.entry
let personalization = result.personalization
```

`personalizeEntry` does not fetch Contentful entries, evaluate audiences, call the Experience API,
or mutate state. SwiftUI `OptimizedEntry` wraps the same boundary and adds component-level behavior
such as variant locking, live updates, and interaction tracking.

For the full data model and fallback behavior, see
[Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md).

## Tracking mechanics

The iOS SDK emits mobile screen events and Contentful entry interaction events:

| Event type | SwiftUI path                   | UIKit path                      |
| ---------- | ------------------------------ | ------------------------------- |
| Screen     | `.trackScreen(name:)`          | `client.screen(name:)`          |
| Entry view | `OptimizedEntry` view tracking | App-computed `TrackViewPayload` |
| Entry tap  | `OptimizedEntry` tap tracking  | App-emitted `TrackClickPayload` |

SwiftUI entry view tracking uses these defaults:

- Initial view event after 2 seconds at 80% visibility.
- Periodic duration updates every 5 seconds while the entry remains visible.
- Final duration update when the entry leaves view after a view event has already fired.

`OptimizedEntry` can tune the visibility threshold, initial time, and update interval per entry.
Wrap scrollable content in `OptimizationScrollView` when view timing needs an accurate viewport.

UIKit does not have automatic component visibility tracking. UIKit apps compute visibility and
duration through their own table, collection, or view-controller callbacks, then emit
`TrackViewPayload` and `TrackClickPayload` directly.

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

When the preview panel is open, all SwiftUI `OptimizedEntry` components update live so audience and
variant overrides apply immediately. When the panel closes, SwiftUI components keep the previewed
variant as the locked value.

UIKit apps choose their own live-update policy. Redraw views when `client.selectedPersonalizations`
changes for live behavior, or keep a selected-personalizations snapshot for locked behavior. Use
`client.isPreviewPanelOpen` when the app needs to redraw in live mode only while previewing.

## Offline and app lifecycle delivery

The iOS SDK monitors network reachability and app lifecycle events:

- When the device is offline, events queue in memory.
- When connectivity returns, queued events flush automatically.
- When the app moves toward the background, the SDK flushes queued events to reduce data loss.

No configuration is required for this behavior. Queueing and flushing use the same event-delivery
model for SwiftUI and UIKit integrations.

## Related documentation

- [Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md) - Package
  installation, quick start, and published package status.
- [Integrating the Optimization iOS SDK in a SwiftUI app](../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md) -
  SwiftUI setup flow for `OptimizationRoot`, `OptimizedEntry`, screen tracking, and preview panel
  mounting.
- [Integrating the Optimization iOS SDK in a UIKit app](../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md) -
  UIKit setup flow for direct `OptimizationClient` usage, manual entry resolution, tracking, and
  preview panel mounting.
- [iOS reference implementation](../../implementations/ios-sdk/README.md) - Native iOS validation
  app with SwiftUI and UIKit shells.
