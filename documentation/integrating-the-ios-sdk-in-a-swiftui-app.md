# Integrating the Optimization iOS SDK in a SwiftUI App

Use this guide when you want to add personalization and analytics to a SwiftUI application using the
Contentful Optimization iOS SDK.

This guide assumes familiarity with the shared concepts covered in
[iOS SDK Fundamentals](./integrating-the-ios-sdk-fundamentals.md) — installation, configuration,
consent, reactive state, the tracking model, live updates, and the preview panel. Read that first if
you have not already.

Use the UIKit guide instead if your app is UIKit-based:
[Integrating the Optimization iOS SDK in a UIKit App](./integrating-the-ios-sdk-in-a-uikit-app.md).

## Scope And Capabilities

The SwiftUI integration uses the SDK's SwiftUI-native API surface:

- `OptimizationRoot` initializes `OptimizationClient`, injects it as an `@EnvironmentObject`, and
  seeds global tracking defaults.
- `OptimizedEntry` renders a personalized Contentful entry and attaches view and tap tracking.
- `OptimizationScrollView` provides an accurate viewport context for view tracking inside scroll
  views.
- `.trackScreen(name:)` emits a screen event when a view appears.
- `PreviewPanelOverlay` renders a developer-only FAB that opens the preview panel sheet.

## Reference App

See the SwiftUI demo at
[Colorful-Team-Org/OptimizationiOSSDKDemo — SwiftUIDemo](https://github.com/Colorful-Team-Org/OptimizationiOSSDKDemo). It exercises
every pattern in this guide end-to-end against real Contentful content and is worth reading
alongside this document.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope And Capabilities](#scope-and-capabilities)
- [The Integration Flow](#the-integration-flow)
- [1. Initialize With OptimizationRoot](#1-initialize-with-optimizationroot)
- [2. Handle Consent](#2-handle-consent)
- [3. Personalize Entries With OptimizedEntry](#3-personalize-entries-with-optimizedentry)
  - [Basic Usage](#basic-usage)
  - [Render Prop Signature](#render-prop-signature)
  - [OptimizationScrollView For Scrollable Content](#optimizationscrollview-for-scrollable-content)
  - [Tuning Visibility Thresholds](#tuning-visibility-thresholds)
- [4. Track Entry Interactions](#4-track-entry-interactions)
  - [Global Defaults On OptimizationRoot](#global-defaults-on-optimizationroot)
  - [Per-Entry Overrides](#per-entry-overrides)
- [5. Enable Or Disable Live Updates](#5-enable-or-disable-live-updates)
- [6. Track Screen Views](#6-track-screen-views)
- [7. Preview Panel](#7-preview-panel)
- [A Complete Example](#a-complete-example)

<!-- mtoc-end -->
</details>

## The Integration Flow

A typical SwiftUI integration is:

1. Install the SDK and build an `OptimizationConfig`.
2. Wrap the app's root content in `OptimizationRoot`.
3. Collect consent (or pre-grant it for demos).
4. Fetch Contentful entries with `include: 10`.
5. Render each entry through `OptimizedEntry`, optionally inside `OptimizationScrollView`.
6. Opt views/taps tracking on or off via `OptimizationRoot(trackViews:trackTaps:)` and
   `OptimizedEntry(trackViews:trackTaps:)`.
7. Mark each screen with `.trackScreen(name:)`.
8. Gate `PreviewPanelOverlay` on a debug flag.

## 1. Initialize With OptimizationRoot

`OptimizationRoot` owns the `OptimizationClient` instance, initializes it in a `.task {}` block, and
shows a `ProgressView` until `isInitialized` flips to `true`. All SwiftUI views in the tree can then
read the client via `@EnvironmentObject`.

```swift
import ContentfulOptimization
import SwiftUI

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            OptimizationRoot(
                config: OptimizationConfig(
                    clientId: "your-client-id",
                    environment: "master",
                    defaults: StorageDefaults(consent: true),  // demo: pre-grant
                    debug: true
                ),
                trackViews: true,
                trackTaps: false,
                liveUpdates: true
            ) {
                RootView()
            }
        }
    }
}
```

Available arguments:

| Argument      | Type                 | Default | Description                                                      |
| ------------- | -------------------- | ------- | ---------------------------------------------------------------- |
| `config`      | `OptimizationConfig` | —       | Client ID, environment, API base URLs, debug flag, and defaults. |
| `trackViews`  | `Bool`               | `true`  | Default for `OptimizedEntry` view tracking.                      |
| `trackTaps`   | `Bool`               | `false` | Default for `OptimizedEntry` tap tracking.                       |
| `liveUpdates` | `Bool`               | `false` | Default for `OptimizedEntry` live update behavior.               |
| `content`     | `@ViewBuilder`       | —       | App content that gets the injected client.                       |

Elsewhere, read the client with:

```swift
struct SomeView: View {
    @EnvironmentObject private var client: OptimizationClient
    // client.state, client.selectedPersonalizations, client.identify(...), ...
}
```

## 2. Handle Consent

See [Consent](./integrating-the-ios-sdk-fundamentals.md#consent) in the fundamentals guide for the
consent model. In SwiftUI, a minimal banner looks like:

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

To gate the banner on whether a choice has been made, observe `client.state.consent`:

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

For demos, pre-grant consent with `StorageDefaults(consent: true)` on the config you pass to
`OptimizationRoot` and skip the banner entirely.

## 3. Personalize Entries With OptimizedEntry

`OptimizedEntry` is the SwiftUI view you render each Contentful entry through. It:

- detects whether the entry is personalized (has `nt_experiences`)
- resolves the correct variant based on `client.selectedPersonalizations`
- passes non-personalized entries through unchanged
- attaches view tracking (visibility + time-based) and tap tracking (gesture-based)
- locks to the first resolved variant unless live updates are on

### Basic Usage

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

The render closure receives `[String: Any]` — the resolved entry dictionary. Pull fields out with
`entry["fields"] as? [String: Any]`. The demo app's `CTAHeader` and `BlogPostCardContent` views are
good references for destructuring.

### Render Prop Signature

```swift
OptimizedEntry(
    entry: [String: Any],
    viewTimeMs: Int = 2000,
    threshold: Double = 0.8,
    viewDurationUpdateIntervalMs: Int = 5000,
    liveUpdates: Bool? = nil,
    trackViews: Bool? = nil,
    trackTaps: Bool? = nil,
    accessibilityIdentifier: String? = nil,
    onTap: (([String: Any]) -> Void)? = nil,
    content: @escaping ([String: Any]) -> Content
)
```

All tracking and live-update flags are `Optional<Bool>` — `nil` means "inherit from
`OptimizationRoot`".

### OptimizationScrollView For Scrollable Content

Inside a plain `ScrollView`, `OptimizedEntry` falls back to "always visible" because it cannot read
scroll position. Wrap the scroll region with `OptimizationScrollView` so view tracking reflects the
actual viewport:

```swift
OptimizationScrollView {
    LazyVStack(alignment: .leading, spacing: 10) {
        ForEach(posts, id: \.id) { post in
            OptimizedEntry(entry: post) { resolved in
                BlogPostCardContent(post: resolved)
            }
        }
    }
}
.refreshable { await refresh() }
```

For full-screen content (heroes, modal cards, single-screen layouts), a plain container is fine —
the entry is treated as always on screen.

### Tuning Visibility Thresholds

The 80% / 2 seconds / 5 second update defaults are good for feed-style content. Override per entry
when a specific component needs different behavior:

```swift
OptimizedEntry(
    entry: largeBanner,
    viewTimeMs: 3000,
    threshold: 0.9
) { resolved in
    LargeBannerView(entry: resolved)
}
```

## 4. Track Entry Interactions

### Global Defaults On OptimizationRoot

```swift
OptimizationRoot(
    config: config,
    trackViews: true,    // track visibility for every OptimizedEntry
    trackTaps: true      // track taps for every OptimizedEntry (opt-in)
) {
    RootView()
}
```

The SDK defaults are `trackViews: true, trackTaps: false`. Views are safe to turn on everywhere;
taps are opt-in because they are more application-specific.

### Per-Entry Overrides

```swift
// Opt a specific entry out of view tracking
OptimizedEntry(entry: hidden, trackViews: false) { resolved in
    HiddenView(entry: resolved)
}

// Enable taps for a single CTA
OptimizedEntry(entry: cta, trackTaps: true) { resolved in
    CTAHeader(entry: resolved)
}

// Tap callback implicitly enables tap tracking
OptimizedEntry(entry: cta, onTap: { resolved in
    navigate(to: resolved)
}) { resolved in
    CTAHeader(entry: resolved)
}
```

Passing `trackTaps: false` always wins — even if `onTap` is provided.

## 5. Enable Or Disable Live Updates

See [Live Updates](./integrating-the-ios-sdk-fundamentals.md#live-updates) in the fundamentals for
the resolution rules. In SwiftUI:

```swift
// Global default
OptimizationRoot(config: config, liveUpdates: true) {
    RootView()
}

// Per-entry overrides
OptimizedEntry(entry: hero, liveUpdates: false) { resolved in
    Hero(entry: resolved)                 // always locked
}
OptimizedEntry(entry: dashboard, liveUpdates: true) { resolved in
    Dashboard(entry: resolved)            // always live
}
OptimizedEntry(entry: card) { resolved in
    Card(entry: resolved)                 // inherits global
}
```

While the preview panel is open, every `OptimizedEntry` in the tree switches to live mode regardless
of these flags.

## 6. Track Screen Views

Attach `.trackScreen(name:)` to any view — typically the root view of a screen:

```swift
struct HomeScreen: View {
    var body: some View {
        Group {
            // screen content
        }
        .trackScreen(name: "Home")
    }
}
```

`.trackScreen(name:)` emits a `client.screen(name:)` event once, when the view first appears. For
dynamic screen names or delayed tracking (e.g. after data has loaded), call the client directly:

```swift
struct DetailsScreen: View {
    @EnvironmentObject private var client: OptimizationClient
    let postTitle: String

    var body: some View {
        Content()
            .task {
                try? await client.screen(
                    name: "BlogPostDetail",
                    properties: ["postTitle": postTitle]
                )
            }
    }
}
```

## 7. Preview Panel

Wrap your content in `PreviewPanelOverlay`, gated on a debug flag, to expose the developer FAB:

```swift
#if DEBUG
let shouldShowPreview = true
#else
let shouldShowPreview = false
#endif

let contentfulClient = ContentfulHTTPPreviewClient(
    spaceId: AppConfig.contentfulSpaceId,
    accessToken: AppConfig.contentfulAccessToken,
    environment: AppConfig.contentfulEnvironment
)

OptimizationRoot(config: config, liveUpdates: true) {
    Group {
        if shouldShowPreview {
            PreviewPanelOverlay(contentfulClient: contentfulClient) {
                RootView()
            }
        } else {
            RootView()
        }
    }
}
```

Tapping the FAB presents the panel as a sheet. While it is open, `client.isPreviewPanelOpen` is
`true` and all `OptimizedEntry` components switch to live mode so overrides apply immediately.

The `contentfulClient` parameter is optional — without it the panel shows audiences and experiences
by ID. Passing it enables rich names, variant labels, and traffic percentages.

## A Complete Example

The SwiftUI demo's app entry point ties all of this together — `OptimizationRoot` with pre-granted
consent and live updates enabled, `PreviewPanelOverlay` wrapping a `NavigationStack`, and a home
screen that uses `OptimizationScrollView` + `OptimizedEntry` to render a personalized CTA card
interleaved after the first blog post:

```swift
// SwiftUIDemo/SwiftUIDemo/SwiftUIDemoApp.swift
@main
struct SwiftUIDemoApp: App {
    private let contentfulClient = ContentfulHTTPPreviewClient(
        spaceId: AppConfig.contentfulSpaceId,
        accessToken: AppConfig.contentfulAccessToken,
        environment: AppConfig.contentfulEnvironment
    )

    var body: some Scene {
        WindowGroup {
            OptimizationRoot(
                config: OptimizationConfig(
                    clientId: AppConfig.optimizationClientId,
                    environment: AppConfig.optimizationEnvironment,
                    defaults: StorageDefaults(consent: true),
                    debug: true
                ),
                trackViews: true,
                trackTaps: false,
                liveUpdates: true
            ) {
                PreviewPanelOverlay(contentfulClient: contentfulClient) {
                    NavigationStack { HomeScreen() }
                }
            }
        }
    }
}
```

```swift
// SwiftUIDemo/SwiftUIDemo/Screens/HomeScreen.swift (excerpt)
struct HomeScreen: View {
    @EnvironmentObject private var client: OptimizationClient
    @State private var cta: [String: Any]?
    @State private var posts: [[String: Any]] = []

    var body: some View {
        OptimizationScrollView {
            LazyVStack {
                ForEach(Array(posts.enumerated()), id: \.offset) { index, post in
                    OptimizedEntry(entry: post) { _ in
                        NavigationLink(value: /* ... */) { BlogPostCardContent(post: post) }
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
        .task { await fetchData() }
    }
}
```

Clone the demo, run the `scripts/setup.sh` helper, and open the `.xcworkspace` to step through the
rest of the code alongside the SDK sources.
