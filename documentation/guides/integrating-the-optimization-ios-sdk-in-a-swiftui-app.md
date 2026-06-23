# Integrating the Optimization iOS SDK in a SwiftUI app

Use this guide when you want to add Optimization, Analytics, screen tracking, and preview overrides
to a SwiftUI application using the Optimization iOS SDK.

For shared runtime behavior, consent gates, tracking thresholds, live-update precedence, and offline
delivery, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md).
For cross-SDK consent policy guidance, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).
Use the UIKit guide instead if your app is UIKit-based:
[Integrating the Optimization iOS SDK in a UIKit app](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and capabilities](#scope-and-capabilities)
- [The integration flow](#the-integration-flow)
- [1. Add the package and create the config](#1-add-the-package-and-create-the-config)
- [2. Initialize with OptimizationRoot](#2-initialize-with-optimizationroot)
- [3. Handle consent](#3-handle-consent)
- [4. Optimize entries with OptimizedEntry](#4-optimize-entries-with-optimizedentry)
  - [Fetch entries in the expected shape](#fetch-entries-in-the-expected-shape)
  - [Render resolved entries](#render-resolved-entries)
  - [Use OptimizationScrollView for scrollable content](#use-optimizationscrollview-for-scrollable-content)
- [5. Track entry interactions](#5-track-entry-interactions)
  - [Set global tracking defaults](#set-global-tracking-defaults)
  - [Override tracking per entry](#override-tracking-per-entry)
- [6. Track screen views](#6-track-screen-views)
- [Live updates](#live-updates)
- [Preview panel](#preview-panel)
- [Complete example](#complete-example)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Scope and capabilities

The SwiftUI integration uses the SDK's SwiftUI-native API surface:

- `OptimizationRoot` initializes `OptimizationClient`, injects it into the environment, and defines
  global tracking and live-update defaults.
- `OptimizedEntry` resolves an optimized Contentful entry and can attach view and tap tracking.
- `OptimizationScrollView` provides viewport context for view tracking inside scrollable content.
- `.trackScreen(name:)` emits screen events when SwiftUI views appear.
- `PreviewPanelOverlay` renders a developer-only preview panel entry point.

The SDK does not replace your Contentful delivery client. Your application still owns Contentful
fetching, consent UX, identity policy, navigation, and rendering.

## The integration flow

Most SwiftUI integrations follow this sequence:

1. Add the Swift Package and create an `OptimizationConfig`.
2. Wrap the app's root content in `OptimizationRoot`.
3. Apply the application's consent policy: seed consent when default-on SDK activity is permitted,
   or collect consent in app UI.
4. Fetch Contentful entries with linked optimization references.
5. Render each Contentful entry through `OptimizedEntry`.
6. Enable view and tap tracking where they fit the screen.
7. Mark screens with `.trackScreen(name:)`.

Optional additions include live updates when entries need to react to optimization state changes
after initial render, and the preview panel when authors or engineers need local audience and
variant overrides.

The iOS reference implementation in this repository demonstrates the same SDK behavior in SwiftUI
and UIKit shells:

- [iOS reference implementation](../../implementations/ios-sdk/README.md)

## 1. Add the package and create the config

Add `ContentfulOptimization` through Swift Package Manager as described in the
[Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md). Then choose the
application locale and create an `OptimizationConfig` with the Optimization client ID:

```swift
let appLocale = "en-US"

let config = OptimizationConfig(
    clientId: "your-client-id",
    environment: "main",
    locale: appLocale,
    logLevel: .debug
)
```

Only `clientId` is required. If application policy permits Optimization by default and no end-user
consent UI is rendered, set `defaults: StorageDefaults(consent: true)`. Otherwise, leave defaults
unset and connect `client.consent(true)` and `client.consent(false)` to the app's consent UI.

Use the same `appLocale` in app-owned Contentful Delivery API requests when the same screen renders
localized Contentful entries. For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

## 2. Initialize with OptimizationRoot

Wrap your root SwiftUI content in `OptimizationRoot`. It owns the `OptimizationClient`, initializes
the SDK, and provides the ready client to descendant views as an environment object.

```swift
import ContentfulOptimization
import SwiftUI

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            OptimizationRoot(
                config: config,
                trackViews: true,
                trackTaps: false,
                liveUpdates: false
            ) {
                RootView()
            }
        }
    }
}
```

Inside the provider tree, read the client from the environment:

```swift
struct AccountControls: View {
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        VStack {
            Button("Identify") {
                Task {
                    try? await client.identify(userId: "user-123", traits: ["plan": "pro"])
                }
            }
            Button("Track purchase") {
                Task {
                    try? await client.track(
                        event: "Purchase Completed",
                        properties: ["sku": "sku-1"]
                    )
                }
            }
        }
    }
}
```

`OptimizationClient` is `@MainActor`. Call it from SwiftUI view tasks, event handlers, or explicit
main-actor tasks. For lifecycle details, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-main-actor).

## 3. Handle consent

If your application policy permits Optimization by default, seed accepted consent in
`OptimizationConfig` and omit the consent gate:

```swift
let config = OptimizationConfig(
    clientId: "your-client-id",
    defaults: StorageDefaults(consent: true)
)
```

That starts all gated SDK events immediately and permits durable profile-continuity storage for
profile, selected optimizations, changes, and the anonymous ID.

When application policy depends on user choice, leave consent unset and connect the app's controls
to `client.consent(true | false)`. `identify` and `screen` remain allowed before consent so a mobile
journey can establish profile context and anonymous screen analytics.

```swift
struct ConsentBanner: View {
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        VStack {
            Text("We use analytics to personalize content.")
            HStack {
                Button("Accept") { client.consent(true) }
                Button("Reject") { client.consent(false) }
            }
        }
    }
}
```

Use `client.state.consent` to decide whether the consent UI still needs to render:

```swift
struct ConsentGate<Content: View>: View {
    @EnvironmentObject private var client: OptimizationClient
    @ViewBuilder var content: () -> Content

    var body: some View {
        if client.state.consent == nil {
            ConsentBanner()
        } else {
            content()
        }
    }
}
```

Boolean consent updates both event emission and durable profile-continuity persistence by default.
If your policy allows events but not durable continuity, call
`client.consent(events: true, persistence: false)` and read `client.state.persistenceConsent` when
the UI needs to show that separate state.

## 4. Optimize entries with OptimizedEntry

`OptimizedEntry` is the SwiftUI component for rendering Contentful entries through the Optimization
resolver. It passes non-optimized entries through unchanged, resolves optimized entries against the
selected variants for the visitor, and can attach view and tap tracking.

### Fetch entries in the expected shape

Fetch entries from Contentful as single-locale JSON-shaped dictionaries and include linked
optimization references in the payload. Pass those dictionaries to `OptimizedEntry`.

The resolver expects the same single-locale CDA entry contract used by the other SDK runtimes. For
details, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Render resolved entries

```swift
import ContentfulOptimization
import SwiftUI

struct CTASection: View {
    let entry: [String: Any]

    var body: some View {
        OptimizedEntry(entry: entry, trackTaps: true) { resolvedEntry in
            CTAHeader(entry: resolvedEntry)
        }
    }
}
```

The render closure receives the resolved entry dictionary. The application owns converting fields
from that dictionary into the view model or SwiftUI view hierarchy it wants to render.

### Use OptimizationScrollView for scrollable content

Inside a plain `ScrollView`, `OptimizedEntry` treats entries as visible because it cannot read the
scroll viewport. Wrap scrollable content in `OptimizationScrollView` when view tracking needs
viewport-aware timing.

```swift
OptimizationScrollView {
    LazyVStack(alignment: .leading, spacing: 12) {
        ForEach(posts, id: \.id) { post in
            OptimizedEntry(entry: post) { resolved in
                BlogPostCard(entry: resolved)
            }
        }
    }
}
```

For full-screen heroes, modal content, or single-screen layouts, a regular container is enough.

## 5. Track entry interactions

### Set global tracking defaults

`OptimizationRoot` defines defaults for every `OptimizedEntry` in its tree:

```swift
OptimizationRoot(
    config: config,
    trackViews: true,
    trackTaps: false
) {
    RootView()
}
```

View tracking defaults to on. Tap tracking defaults to off because taps are usually tied to
application-specific navigation or business actions.

### Override tracking per entry

```swift
OptimizedEntry(entry: hero, trackViews: false) { resolved in
    Hero(entry: resolved)
}

OptimizedEntry(entry: cta, trackTaps: true) { resolved in
    CTAHeader(entry: resolved)
}

OptimizedEntry(entry: cta, onTap: { resolved in
    navigate(to: resolved)
}) { resolved in
    CTAHeader(entry: resolved)
}
```

Passing `trackTaps: false` disables tap tracking even when `onTap` is present. For timing thresholds
and event delivery behavior, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

## 6. Track screen views

Attach `.trackScreen(name:)` to the root view for each screen:

```swift
struct HomeScreen: View {
    var body: some View {
        HomeContent()
            .trackScreen(name: "Home")
    }
}
```

For dynamic names or tracking after data loads, call the client directly:

```swift
struct DetailsScreen: View {
    @EnvironmentObject private var client: OptimizationClient
    let postId: String

    var body: some View {
        DetailsContent()
            .task {
                try? await client.screen(
                    name: "BlogPostDetail",
                    properties: ["postId": postId]
                )
            }
    }
}
```

## Live updates

By default, `OptimizedEntry` locks to the first variant it resolves so content does not change while
a visitor is reading it. Enable live updates when a screen needs to react to profile or preview
changes without a reload:

```swift
OptimizationRoot(config: config, liveUpdates: true) {
    RootView()
}

OptimizedEntry(entry: dashboard, liveUpdates: true) { resolved in
    Dashboard(entry: resolved)
}
```

The preview panel forces live updates while it is open. For precedence rules, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

## Preview panel

Gate the preview panel behind a debug or internal-build flag. `PreviewPanelOverlay` renders a
floating button and presents the panel when tapped.

```swift
#if DEBUG
let showPreviewPanel = true
#else
let showPreviewPanel = false
#endif

OptimizationRoot(config: config) {
    if showPreviewPanel {
        PreviewPanelOverlay(contentfulClient: contentfulClient) {
            RootView()
        }
    } else {
        RootView()
    }
}
```

The `contentfulClient` parameter is optional. Passing a `PreviewContentfulClient` enables audience
and experience names in the panel; without it, the panel displays identifiers.

## Complete example

This example combines initialization, preview-panel gating, screen tracking, viewport-aware entry
tracking, and tap tracking:

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            OptimizationRoot(
                config: config,
                trackViews: true,
                trackTaps: false
            ) {
                PreviewPanelOverlay(contentfulClient: contentfulClient) {
                    NavigationStack {
                        HomeScreen()
                    }
                }
            }
        }
    }
}

struct HomeScreen: View {
    let posts: [[String: Any]]
    let cta: [String: Any]?

    var body: some View {
        OptimizationScrollView {
            LazyVStack {
                ForEach(Array(posts.enumerated()), id: \.offset) { index, post in
                    OptimizedEntry(entry: post) { resolved in
                        BlogPostCard(entry: resolved)
                    }

                    if index == 0, let cta {
                        OptimizedEntry(entry: cta, trackTaps: true) { resolved in
                            CTAHeader(entry: resolved)
                        }
                    }
                }
            }
        }
        .trackScreen(name: "Home")
    }
}
```

## Reference implementations to compare against

- [iOS reference implementation](../../implementations/ios-sdk/README.md) - Demonstrates SwiftUI and
  UIKit shells that exercise shared native iOS bridge behavior, entry resolution, interaction
  tracking, screen tracking, and preview-panel overrides against the same mock API.
