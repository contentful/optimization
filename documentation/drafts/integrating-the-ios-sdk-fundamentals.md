# iOS SDK fundamentals

This document is the shared reference for the Contentful Optimization iOS SDK. It describes what the
SDK is, how it is architected, and the concepts that apply regardless of whether your app is built
with SwiftUI or UIKit.

Read this first, then move on to the UI-framework-specific guide:

- [Integrating the Optimization iOS SDK in a SwiftUI app](./integrating-the-ios-sdk-in-a-swiftui-app.md)
- [Integrating the Optimization iOS SDK in a UIKit app](./integrating-the-ios-sdk-in-a-uikit-app.md)

## What the SDK is

The iOS SDK (`ContentfulOptimization`, distributed via Swift Package Manager from
[`packages/ios`](../../packages/ios)) is a native Swift layer that lets iOS apps render personalized
Contentful content and report analytics back to the Optimization platform.

Under the hood it runs the same JavaScript optimization core used by the Node, Web, and React Native
SDKs inside a **JavaScriptCore** context, bridged by a TypeScript adapter. Swift handles native
concerns — persistence via `UserDefaults`, networking, app lifecycle, SwiftUI/UIKit integration —
while the JS engine handles personalization logic, profile management, and analytics batching. You
never interact with the JS layer directly; every public API is Swift.

See [`packages/ios/CODE_MAP.md`](../../packages/ios/CODE_MAP.md) for the full architecture diagram.

## Reference app

A working demo of both integration styles lives at
[Colorful-Team-Org/OptimizationiOSSDKDemo](https://github.com/Colorful-Team-Org/OptimizationiOSSDKDemo)
(local checkout at [`../../../optimization-ios-demo`](../../../optimization-ios-demo)):

- **`SwiftUIDemo/`** — idiomatic SwiftUI integration using `OptimizationRoot`, `OptimizedEntry`, and
  the `.trackScreen(name:)` modifier.
- **`UIKitDemo/`** — UIKit integration that initializes `OptimizationClient` manually in
  `SceneDelegate`, calls `personalizeEntry` directly from cell configuration, and tracks screens in
  `viewDidAppear`.

Both demos are functionally and visually identical — same Contentful content, same home screen with
a personalized CTA banner, same blog detail screen, same preview panel FAB — which makes them a
useful A/B reference when deciding how to structure your own integration. The demo repo's
`README.md` also documents the Contentful space setup, credentials, and setup script, so it is a
good primer for wiring an app end-to-end.

## Installation

Add the SDK to your Xcode project as a Swift Package dependency pointing at
[`packages/ios/ContentfulOptimization`](../../packages/ios/ContentfulOptimization). The demo repo
uses a local path via `xcodegen`; production apps typically point at a Git ref of this monorepo.

Minimum platforms: iOS 15 / macOS 12.

> [!NOTE]
>
> The SDK ships a compiled JavaScript bridge bundle (`optimization-ios-bridge.umd.js`) as a
> resource. When consuming the SDK from a source checkout, you must build the JS bridge first (the
> demo's `./scripts/setup.sh` handles this). Consumers of a released package get the bundle
> prebuilt.

## Core types

The SDK's public surface is small. Most integrations use five types:

| Type                                                                   | Role                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `OptimizationClient`                                                   | `@MainActor` `ObservableObject`. The main facade — publishes state, drives all bridge calls.     |
| `OptimizationConfig`                                                   | Value type: `clientId`, `environment`, API base URLs, `StorageDefaults`, `debug` flag.           |
| `OptimizationRoot` (SwiftUI)                                           | Top-level SwiftUI view that initializes the client and injects it into the environment.          |
| `OptimizedEntry` (SwiftUI)                                             | Wraps a Contentful entry, resolves the personalized variant, and attaches view and tap tracking. |
| `PreviewPanelOverlay` (SwiftUI) / `PreviewPanelViewController` (UIKit) | Developer-only preview panel for overriding audiences and variants.                              |

The full type list also includes `OptimizationScrollView`, `OptimizationState`,
`PersonalizedResult`, `TrackViewPayload`, `TrackClickPayload`, `PreviewContentfulClient`, and the
`ContentfulHTTPPreviewClient` helper.

## Configuration

Every integration ultimately builds an `OptimizationConfig`:

```swift
OptimizationConfig(
    clientId: "your-optimization-client-id",
    environment: "master",
    experienceBaseUrl: nil,     // optional override for the Experience API
    insightsBaseUrl: nil,       // optional override for the Insights API
    defaults: StorageDefaults(consent: true),
    debug: true                 // emits os.Logger output under com.contentful.optimization
)
```

Only `clientId` is required; `environment` defaults to `"master"`. Leave the base URLs as `nil` to
hit production endpoints.

`debug: true` enables structured logging to Xcode console and `Console.app` under the subsystem
`com.contentful.optimization`. Leave it off in production.

### StorageDefaults

`StorageDefaults` lets you seed the SDK's persisted state on first launch. The most common use is
pre-granting consent for demos or tests:

```swift
defaults: StorageDefaults(consent: true)
```

Other seedable values are `profile`, `changes`, and `personalizations`. Seeds are only applied when
no value is already persisted in `UserDefaults`, so a real user choice is never overwritten.

## Lifecycle

The SDK has two lifecycle phases that matter for any app:

1. **Uninitialized**: `OptimizationClient` exists but has not yet loaded the JS bridge. All async
   methods (`identify`, `page`, `screen`, `flush`, `trackView`, `trackClick`) throw
   `OptimizationError.notInitialized`; sync methods (`consent`, `reset`, `setOnline`, override
   methods) no-op.
2. **Initialized**: The JS bridge is loaded, persisted state has been merged into the config,
   `isInitialized == true`, and `AppStateHandler` + `NetworkMonitor` are running. All APIs are
   usable.

Initialization is a single `try client.initialize(config:)` call. In SwiftUI, `OptimizationRoot`
does this for you in `.task {}`. In UIKit, do it in your `SceneDelegate`'s
`scene(_:willConnectTo:options:)`.

Call `destroy()` only in test teardown or when you need to hard-reset the SDK — typical apps leave a
single `OptimizationClient` alive for the app's lifetime.

> [!IMPORTANT]
>
> `OptimizationClient` is `@MainActor`. Call it from main-thread contexts (view lifecycle methods,
> `Task { @MainActor in ... }` blocks, SwiftUI `.onAppear`). Calling from a background thread is a
> concurrency error that the compiler will flag.

## Consent

By default the SDK blocks analytics events until the user expresses a consent choice. The one
exception is `identify` and `screen`, which are always allowed so that anonymous screen-level
analytics continue even before a consent UI has been shown.

Record consent with:

```swift
client.consent(true)  // accept — unblocks all event types
client.consent(false) // reject — blocks non-allowed events
```

Consent is persisted via `UserDefaults`, so the user's choice is restored on the next launch. You
only need to prompt once per install.

For demos where you do not want a consent UI at all, pre-grant consent via `StorageDefaults`:

```swift
OptimizationConfig(
    clientId: "...",
    defaults: StorageDefaults(consent: true)
)
```

Both demo apps (SwiftUI and UIKit) use this shortcut.

Consent state is exposed reactively as `client.state.consent` (see below).

## Reactive state

`OptimizationClient` is an `ObservableObject`. Several properties are `@Published` and update as the
JS bridge pushes signals:

| Property                   | Type                | Description                                                             |
| -------------------------- | ------------------- | ----------------------------------------------------------------------- |
| `state`                    | `OptimizationState` | Reactive snapshot of `profile`, `consent`, `canPersonalize`, `changes`. |
| `isInitialized`            | `Bool`              | `true` once `initialize(config:)` has returned successfully.            |
| `selectedPersonalizations` | `[[String: Any]]?`  | The personalizations the current user qualifies for.                    |
| `isPreviewPanelOpen`       | `Bool`              | `true` while the preview panel is on screen.                            |

There is also `eventPublisher: AnyPublisher<[String: Any], Never>` for subscribing to raw
analytics/personalization events emitted by the JS bridge. Useful for debug overlays and tests.

In SwiftUI, consume these with `@EnvironmentObject` + property wrappers; in UIKit, subscribe via
Combine (`client.$selectedPersonalizations.sink { ... }`).

## Personalizing Contentful entries

Fetch entries from Contentful as `[String: Any]` dictionaries (e.g. via `URLSession` or any
Contentful client that returns JSON-shaped output) and include linked optimization references by
passing `include: 10` to the Delivery API. That dictionary is the format the SDK expects.

To resolve the correct variant for the current user:

```swift
let result = client.personalizeEntry(
    baseline: entry,
    personalizations: client.selectedPersonalizations
)
let resolvedEntry = result.entry
let personalization = result.personalization  // nil when baseline was used
```

`personalizeEntry` is synchronous and safe to call from view code. If the SDK is not yet
initialized, or the entry has no `nt_experiences` field, it returns the baseline unchanged.

In SwiftUI, `OptimizedEntry` wraps this call for you and also handles variant locking, view
tracking, and tap tracking. In UIKit, you call `personalizeEntry` yourself — typically in a cell
configuration method — and attach tracking manually.

## Tracking model

The iOS SDK tracks three kinds of events, each with a corresponding API:

| Event             | Method                  | Emitted by                                        |
| ----------------- | ----------------------- | ------------------------------------------------- |
| Screen view       | `client.screen(name:)`  | `.trackScreen(name:)` (SwiftUI) or manual (UIKit) |
| Entry view        | `client.trackView(_:)`  | `OptimizedEntry` (SwiftUI) or manual (UIKit)      |
| Entry click / tap | `client.trackClick(_:)` | `OptimizedEntry` (SwiftUI) or manual (UIKit)      |

You will also see `identify(userId:traits:)` and `page(properties:)`. On mobile, screen events are
usually preferred over page events.

### Entry view tracking thresholds

For entry views, the SDK fires an event when the entry has been at least **80% visible for 2
seconds**, then emits periodic duration updates every 5 seconds while it remains visible, and a
final event when it disappears. Both thresholds are configurable per-entry in SwiftUI via
`OptimizedEntry(..., viewTimeMs:, threshold:, viewDurationUpdateIntervalMs:)`. In UIKit, you compute
duration yourself and send a `TrackViewPayload`.

## Live updates

`OptimizedEntry` in SwiftUI (and any UIKit code that reads `client.selectedPersonalizations`) can
either **lock to the first variant it resolves** or **update live** when the selected
personalizations change mid-session. Default is locked, which prevents content from swapping under a
user who is already reading it.

Three layers control the behavior, from broadest to narrowest:

1. **Preview panel open** — always forces live updates so variant overrides apply immediately.
2. **`OptimizationRoot(liveUpdates:)`** (SwiftUI) or your own "global" flag (UIKit) — default for
   the whole app.
3. **`OptimizedEntry(liveUpdates:)`** (SwiftUI) — per-component override.

The resolution priority is:

| Preview panel | Global  | Per-entry | Result |
| ------------- | ------- | --------- | ------ |
| Open          | any     | any       | Live   |
| Closed        | `true`  | `nil`     | Live   |
| Closed        | `false` | `true`    | Live   |
| Closed        | `true`  | `false`   | Locked |
| Closed        | `false` | `nil`     | Locked |

When the preview panel closes, SwiftUI's `OptimizedEntry` snapshots the current variants so that any
overrides applied during the preview session become the new "locked" baseline.

## Preview panel

The preview panel is an in-app developer tool that lets authors and engineers override audience
membership and variant selections locally without touching production state. It is shipped as part
of the SDK and is gated by the caller — typically with `#if DEBUG` or a build configuration flag —
so that production users never see it.

Both UI frameworks have a floating "slider" FAB in the bottom-trailing corner that opens the panel:

- SwiftUI: wrap content in `PreviewPanelOverlay(contentfulClient:) { ... }`.
- UIKit: call
  `PreviewPanelViewController.addFloatingButton(to: ..., client: ..., contentfulClient: ...)`.

The `contentfulClient` parameter is a `PreviewContentfulClient`-conforming type used to fetch
`nt_audience` and `nt_experience` entries so audiences and experiences render by name. The SDK ships
`ContentfulHTTPPreviewClient`, a ready-made URLSession-based implementation:

```swift
let contentfulClient = ContentfulHTTPPreviewClient(
    spaceId: AppConfig.contentfulSpaceId,
    accessToken: AppConfig.contentfulAccessToken,
    environment: AppConfig.contentfulEnvironment
)
```

While the panel is open, `client.isPreviewPanelOpen` is `true` and all `OptimizedEntry` components
switch to live update mode.

## Offline behavior

The SDK monitors network reachability via `NWPathMonitor`. When offline:

- Events are queued in memory.
- On reconnect, the queue is flushed automatically.
- On app backgrounding, queued events are flushed proactively to minimize data loss
  (`AppStateHandler` hooks into `UIApplication.willResignActiveNotification`).

No configuration is required. This behavior is identical across SwiftUI and UIKit integrations.

## Where to go next

- Building a SwiftUI app? Continue to
  [Integrating the Optimization iOS SDK in a SwiftUI app](./integrating-the-ios-sdk-in-a-swiftui-app.md).
- Building a UIKit app? Continue to
  [Integrating the Optimization iOS SDK in a UIKit app](./integrating-the-ios-sdk-in-a-uikit-app.md).
- Mixing both UI frameworks in one app? The SwiftUI views work inside `UIHostingController`, and
  `OptimizationClient` is the shared underlying type — pass the same instance into both halves of
  your app.
