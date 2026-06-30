# Integrating the Optimization iOS SDK in a SwiftUI app

Use this guide when you want to add Optimization, Analytics, screen tracking, entry interaction
tracking, Custom Flags, and preview overrides to a SwiftUI application using the Optimization iOS
SDK.

The SwiftUI integration uses `OptimizationRoot`, `OptimizedEntry`, `OptimizationScrollView`, and
`.trackScreen(name:)`. Your application still owns Contentful entry fetching, consent policy,
identity policy, navigation, and final rendering. Use the UIKit guide instead when your app is
UIKit-based:
[Integrating the Optimization iOS SDK in a UIKit app](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md).

## Quick start

This path assumes your application policy permits Optimization by default. If your app requires
explicit opt-in with no pre-consent SDK events, set `allowedEventTypes: []` before mounting this
path or defer `.trackScreen(name:)` until consent is accepted.

1. Add the Swift Package through Swift Package Manager. In Xcode, add the package dependency with
   `https://github.com/contentful/optimization.swift`, or add the package to `Package.swift`.

   **Copy this:**

   ```swift
   dependencies: [
       .package(url: "https://github.com/contentful/optimization.swift.git", from: "<version>"),
   ],
   targets: [
       .target(
           name: "MyApp",
           dependencies: [
               .product(name: "ContentfulOptimization", package: "optimization.swift"),
           ]
       ),
   ]
   ```

2. Configure the SDK, mount `OptimizationRoot`, attach screen tracking, and render one app-fetched
   single-locale Contentful entry through `OptimizedEntry`. The screen event supplies visitor
   context, but the quick-start proof is the rendered entry.

   **Adapt this to your use case:**

   ```swift
   import ContentfulOptimization
   import SwiftUI

   let appLocale = "en-US"

   let optimizationConfig = OptimizationConfig(
       clientId: "<your-client-id>",
       environment: "main",
       locale: appLocale,
       // Use default accepted consent only when your application policy permits it.
       defaults: StorageDefaults(consent: true)
   )

   @main
   struct MyApp: App {
       var body: some Scene {
           WindowGroup {
               // Mount one SDK-owned client around the SwiftUI tree that uses SDK views.
               OptimizationRoot(config: optimizationConfig) {
                   HomeScreen()
               }
           }
       }
   }

   struct HomeScreen: View {
       @State private var hero: [String: Any]?

       var body: some View {
           Group {
               if let hero {
                   // Renders the selected variant, or the baseline entry when no variant matches.
                   OptimizedEntry(entry: hero) { resolvedEntry in
                       Text(entryId(from: resolvedEntry))
                   }
               } else {
                   ProgressView()
               }
           }
           // Required setup: attach screen tracking once to the stable screen root.
           .trackScreen(name: "Home")
           .task {
               // Use your app-owned CDA client; fetch one locale and include optimization links.
               hero = await fetchSingleLocaleHeroEntry(locale: appLocale)
           }
       }
   }

   func entryId(from entry: [String: Any]) -> String {
       let sys = entry["sys"] as? [String: Any]
       return sys?["id"] as? String ?? "missing-entry-id"
   }

   func fetchSingleLocaleHeroEntry(locale: String) async -> [String: Any]? {
       // Replace with your app-owned Contentful Delivery API call.
       // Include linked `nt_experiences`, `nt_config`, and `nt_variants` data.
       nil
   }
   ```

3. Verify the first run. The entry ID text renders the baseline entry when no selected variant is
   available, or the selected variant entry when the Experience API selects one for the visitor.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [Install and initialize the SwiftUI root](#install-and-initialize-the-swiftui-root)
  - [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff)
  - [Contentful entry fetching and locale shape](#contentful-entry-fetching-and-locale-shape)
  - [Entry resolution and fallback rendering](#entry-resolution-and-fallback-rendering)
  - [Screen events and SwiftUI navigation](#screen-events-and-swiftui-navigation)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Identity, profile state, and reset](#identity-profile-state-and-reset)
- [Optional integrations](#optional-integrations)
  - [Custom events and analytics diagnostics](#custom-events-and-analytics-diagnostics)
  - [Custom Flags and MergeTag rendering](#custom-flags-and-mergetag-rendering)
  - [Live updates](#live-updates)
  - [Preview panel](#preview-panel)
- [Advanced integrations](#advanced-integrations)
  - [Strict event policy and endpoint controls](#strict-event-policy-and-endpoint-controls)
  - [Offline delivery and lifecycle flushing](#offline-delivery-and-lifecycle-flushing)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Required setup

Use this table as the setup inventory for the guide:

| Setup item                                                                  | Category                       | Required for quick start | Where to configure                                                                    |
| --------------------------------------------------------------------------- | ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------- |
| `ContentfulOptimization` Swift Package                                      | Required for first integration | Yes                      | Swift Package Manager, Xcode package dependencies, or app `Package.swift`             |
| iOS 15 or macOS 12 application target                                       | Required for first integration | Yes                      | Xcode deployment target or Swift Package platform constraints                         |
| Optimization client ID and environment                                      | Required for first integration | Yes                      | `OptimizationConfig`, usually from app configuration                                  |
| Experience API and Insights API endpoint overrides                          | Common but policy-dependent    | No                       | `OptimizationApiConfig` when using non-default production, staging, or mock endpoints |
| Contentful Delivery API client, space, environment, and access token        | Required for first integration | Yes                      | Application-owned Contentful fetching layer                                           |
| Contentful entries with linked optimization and variant data                | Required for first integration | Yes                      | Contentful content model and entries rendered by the app                              |
| Single Contentful CDA locale and enough include depth for optimized entries | Required for first integration | Yes                      | App-owned CDA requests before passing entries to the SDK                              |
| `OptimizationRoot` mounted once around the SwiftUI tree that uses the SDK   | Required for first integration | Yes                      | SwiftUI app root, scene root, or feature root                                         |
| Screen event names for SwiftUI screens and navigation destinations          | Required for first integration | Yes                      | `.trackScreen(name:)` or app-owned screen tracking calls                              |
| Consent startup policy and user-choice wiring                               | Common but policy-dependent    | Conditional              | `StorageDefaults`, `allowedEventTypes`, and application consent UI or CMP callbacks   |
| Entry view and tap tracking policy                                          | Common but policy-dependent    | Conditional              | `OptimizationRoot` tracking defaults and per-entry `OptimizedEntry` options           |
| User identity, profile-continuity persistence, and reset policy             | Common but policy-dependent    | No                       | Account, session, or identity views that call `identify(...)` and `reset()`           |
| Custom Flags and MergeTag rendering                                         | Optional                       | No                       | Components that read SDK-resolved flags or rich-text MergeTag entries                 |
| Analytics forwarding or debug event display                                 | Optional                       | No                       | `eventStream`, `blockedEventStream`, and application-owned analytics code             |
| Preview panel and Contentful preview-definition client                      | Optional                       | No                       | `PreviewPanelConfig`, `PreviewPanelOverlay`, and debug or internal-build gates        |
| Strict pre-consent allow-list, queue policy, and blocked-event diagnostics  | Advanced or production-only    | No                       | `OptimizationConfig` options and release configuration                                |
| Local native validation path                                                | Advanced or production-only    | No                       | iOS reference implementation scripts or XCUITest wrappers                             |

The iOS SDK does not fetch Contentful entries for your application UI. Fetch entries in the
application layer, then pass the resulting single-locale dictionaries to `OptimizedEntry` or
`client.resolveOptimizedEntry(...)`.

## Core integration

### Install and initialize the SwiftUI root

**Integration category:** Required for first integration

`OptimizationRoot` is the normal SwiftUI entry point. It creates and initializes an
`OptimizationClient`, injects it into the SwiftUI environment, provides tracking defaults to
descendant `OptimizedEntry` views, and renders a `ProgressView` until the client is ready. For
package status and installation options, see the
[Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md).

1. Add `ContentfulOptimization` as a Swift Package dependency.
2. Create one `OptimizationConfig` with the Optimization client ID, environment, and SDK
   Experience/event locale.
3. Pass endpoint overrides only when your app uses non-default Experience API or Insights API hosts.
4. Wrap the SwiftUI tree that uses SDK views and modifiers in `OptimizationRoot`.
5. Read the initialized client from `@EnvironmentObject` inside descendant views that call SDK
   methods directly.

**Adapt this to your use case:**

```swift
import ContentfulOptimization
import SwiftUI

let config = OptimizationConfig(
    clientId: "<your-client-id>",
    environment: "main",
    locale: "en-US",
    logLevel: .error
)

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            // Keep one SDK-owned client alive for the SwiftUI tree that uses Optimization.
            OptimizationRoot(
                config: config
            ) {
                RootView()
            }
        }
    }
}

struct PurchaseButton: View {
    // Descendant views use the client created by OptimizationRoot.
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        Button("Purchase") {
            Task {
                _ = try? await client.track(
                    event: "Purchase Completed",
                    properties: ["sku": "sku-1"]
                )
            }
        }
    }
}
```

`OptimizationClient` is `@MainActor`. Call it from SwiftUI view tasks, event handlers, or explicit
main-actor tasks. For lifecycle details, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-main-actor).

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

Consent policy remains application-owned. Use the default accepted startup path only when
application policy permits Optimization by default and no end-user consent UI is rendered.
Otherwise, leave consent unset and connect your CMP, account preference, or in-app banner to the
SDK.

1. Seed accepted consent with `StorageDefaults(consent: true)` when policy permits default-on
   Optimization.
2. Leave consent unset when the app needs to collect a user decision first.
3. Call `client.consent(true)` after the visitor accepts and `client.consent(false)` after the
   visitor rejects.
4. Use split consent when events are allowed but durable profile continuity must stay session-only.
5. Read `client.state.consent` and `client.state.persistenceConsent` when consent UI needs to
   reflect SDK state.

**Copy this:**

```swift
let defaultOnConfig = OptimizationConfig(
    clientId: "<your-client-id>",
    // Accepted startup consent enables events and durable profile continuity.
    defaults: StorageDefaults(consent: true)
)
```

**Adapt this to your use case:**

```swift
struct ConsentBanner: View {
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        HStack {
            Button("Accept") {
                // Accepts event emission and durable profile-continuity persistence.
                client.consent(true)
            }
            Button("Reject") {
                // Blocks non-allowed events and clears persisted profile continuity.
                client.consent(false)
            }
        }
    }
}

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

Boolean consent controls both event emission and durable profile-continuity persistence by default.
When those policy decisions differ, call the split form:

**Copy this:**

```swift
// Allows events but keeps profile continuity session-only.
client.consent(events: true, persistence: false)
```

When `allowedEventTypes` is unset, the native default allow-list lets `identify` and `screen` emit
before consent, even after `client.consent(false)` blocks non-allowed events and clears persistence
and profile-continuity consent. Strict opt-in apps can set `allowedEventTypes: []` or a narrower
list when policy must block every SDK event or only permit specific events before consent. For the
cross-SDK consent model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful entry fetching and locale shape

**Integration category:** Required for first integration

The SDK resolver expects standard single-locale CDA entry dictionaries. Your app must fetch
Contentful entries, resolve linked optimization references, and pass localized field values directly
to the SDK. Do not pass all-locale CDA responses such as `locale=*`.

1. Choose the application Contentful locale in your app routing, i18n, account, or native state
   layer.
2. Pass the same locale to `OptimizationConfig(locale:)` when Experience API responses and event
   context must align with rendered Contentful content.
3. Fetch entries from Contentful with a concrete locale and enough include depth for
   `nt_experiences`, `nt_config`, and `nt_variants`.
4. Keep cache keys locale-aware when localized entries can differ.
5. When the app locale changes, call `client.setLocale(...)`, refetch Contentful entries with the
   app locale, and re-render the affected SwiftUI state.
6. Emit a fresh Experience event after a locale change when rendered output depends on SDK-derived
   profile data, selected optimizations, flags, or MergeTags that must reflect the new
   Experience/event locale. Use the event your app already owns for that state, such as `screen`,
   `identify`, or `page` if used.

**Follow this pattern:**

```swift
let appLocale = selectedAppLocale()

let config = OptimizationConfig(
    clientId: "<your-client-id>",
    environment: "main",
    // Aligns Experience API responses and event context with rendered content.
    locale: appLocale
)

// Fetch single-locale CDA entries; do not pass all-locale `locale=*` payloads.
let entry = await contentfulEntryClient.fetchEntry(
    id: "<entry-id>",
    include: 10,
    locale: appLocale
)
```

For the full data shape and locale boundary, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
and
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Entry resolution and fallback rendering

**Integration category:** Required for first integration

`OptimizedEntry` is the SwiftUI component for rendering Contentful entries through the Optimization
resolver. It passes non-optimized entries through unchanged, resolves optimized entries against the
visitor's selected variants, and falls back to the baseline entry when data is missing or unmatched.

1. Pass the baseline Contentful entry dictionary to `OptimizedEntry`.
2. Render fields from the `resolvedEntry` value passed to the render closure.
3. Keep view-model conversion and SwiftUI rendering in the application layer.
4. Use `client.resolveOptimizedEntry(...)` directly only when a component needs to separate
   resolution from rendering.

**Adapt this to your use case:**

```swift
struct CTASection: View {
    let entry: [String: Any]

    var body: some View {
        // The resolver falls back to the baseline entry when no variant matches.
        OptimizedEntry(entry: entry) { resolvedEntry in
            CTAHeader(entry: resolvedEntry)
        }
    }
}
```

**Follow this pattern:**

```swift
struct DirectResolutionView: View {
    @EnvironmentObject private var client: OptimizationClient
    let entry: [String: Any]

    var body: some View {
        // Use direct resolution only when rendering must be separate from OptimizedEntry.
        let result = client.resolveOptimizedEntry(
            baseline: entry,
            selectedOptimizations: client.selectedOptimizations
        )

        CTAHeader(entry: result.entry)
    }
}
```

Entry resolution is local and synchronous after the app has both Contentful entry data and SDK
optimization state. For fallback rules, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#fallback-behavior).

### Screen events and SwiftUI navigation

**Integration category:** Required for first integration

Use `.trackScreen(name:)` on each SwiftUI screen or navigation destination. The modifier emits when
the view appears, when the screen name changes, and when consent changes allow the active screen to
be emitted.

1. Attach `.trackScreen(name:)` to the root view for every screen that maps to an analytics screen.
2. Use stable names for navigation destinations so downstream reporting can group events.
3. For dynamic screen events that need properties or an app-defined route key, call
   `client.trackCurrentScreen(...)` from a SwiftUI task after the data is available.

**Copy this:**

```swift
struct HomeScreen: View {
    var body: some View {
        HomeContent()
            // Attach once to the stable screen root to avoid duplicate screen events.
            .trackScreen(name: "Home")
    }
}
```

**Adapt this to your use case:**

```swift
struct DetailsScreen: View {
    @EnvironmentObject private var client: OptimizationClient
    let postId: String

    var body: some View {
        DetailsContent()
            .task(id: postId) {
                _ = try? await client.trackCurrentScreen(
                    name: "BlogPostDetail",
                    properties: ["postId": postId],
                    // Keeps retries and property updates tied to one logical route.
                    routeKey: "blog-post-\(postId)"
                )
            }
    }
}
```

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizationRoot` defines tracking defaults for `OptimizedEntry` views. View and tap tracking
default to on; pass `trackViews: false` or `trackTaps: false` globally or per entry when a surface
must opt out.

1. Leave view and tap tracking enabled for entries that need exposure and interaction analytics.
2. Disable tap tracking where the wrapped entry does not represent tappable content.
3. Override `trackViews`, `trackTaps`, `dwellTimeMs`, `minVisibleRatio`, and
   `viewDurationUpdateIntervalMs` on individual entries when needed.
4. Wrap scrollable content in `OptimizationScrollView` when view tracking needs accurate viewport
   timing.
5. Render tappable UI inside `OptimizedEntry` when navigation needs fields from the resolved entry.

**Copy this:**

```swift
OptimizationRoot(
    config: config,
    // Opt out globally only when this screen must not emit tap analytics.
    trackTaps: false
) {
    RootView()
}
```

**Adapt this to your use case:**

```swift
OptimizationScrollView {
    LazyVStack(alignment: .leading, spacing: 12) {
        ForEach(Array(posts.enumerated()), id: \.offset) { _, post in
            OptimizedEntry(entry: post) { resolvedEntry in
                BlogPostCard(entry: resolvedEntry)
            }
        }
    }
}
```

**Adapt this to your use case:**

```swift
OptimizedEntry(entry: cta) { resolvedEntry in
    Button {
        // Use resolved fields here when the selected variant changes the destination.
        navigate(to: resolvedEntry)
    } label: {
        CTAHeader(entry: resolvedEntry)
    }
}
```

Passing `trackTaps: false` on `OptimizedEntry` disables the SDK tap modifier for that entry. Because
the optional `onTap` callback runs through that modifier, `onTap` does not fire when tap tracking is
explicitly disabled. Use a SwiftUI `Button` or app-owned gesture inside the render closure for
app-only navigation, and read resolved fields there. For timing thresholds and event delivery
behavior, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

### Identity, profile state, and reset

**Integration category:** Common but policy-dependent

Identify users when your product has an application-owned user identity that can be sent to
Optimization. The SDK publishes profile, selected optimizations, changes, consent, and locale state
through `OptimizationClient`.

1. Call `identify(userId:traits:)` from the authenticated flow or account state change that owns
   identity.
2. Read `client.state.profile` when SwiftUI needs to react to profile state.
3. Read `client.selectedOptimizations` only for app-owned resolution or diagnostics;
   `OptimizedEntry` observes it automatically.
4. Call `client.reset()` when the user signs out or your policy requires clearing SDK-managed
   profile continuity.
5. Re-emit a screen or page event after reset when the active journey needs fresh anonymous state.

**Adapt this to your use case:**

```swift
struct AccountControls: View {
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        VStack {
            Button("Identify") {
                Task {
                    // Identify after your app-owned authentication state is available.
                    _ = try? await client.identify(
                        userId: "user-123",
                        traits: ["plan": "pro"]
                    )
                }
            }

            Button("Reset") {
                // Clear SDK-managed profile continuity when the user signs out.
                client.reset()
            }
        }
    }
}
```

`reset()` clears SDK-managed profile, changes, selected optimizations, and anonymous ID continuity.
It preserves stored consent so the next SDK activity still follows the visitor's existing consent
decision.

## Optional integrations

### Custom events and analytics diagnostics

**Integration category:** Optional

Use custom events for application-owned business actions and SDK event streams for debug surfaces,
local validation, or forwarding to an application-owned analytics pipeline.

1. Call `client.track(event:properties:)` from the SwiftUI event handler that owns the business
   action.
2. Subscribe to `client.eventStream` before the events you need to observe. The public iOS stream is
   a passthrough Combine publisher and does not replay prior events to late subscribers, even though
   the underlying Core `states.eventStream` uses latest-value observable semantics.
3. Subscribe to `client.blockedEventStream` or configure `onEventBlocked` when a debug UI or logger
   needs to explain consent-blocked events.
4. Keep downstream destination consent checks in the application layer before forwarding events.

**Adapt this to your use case:**

```swift
struct AnalyticsDiagnostics: View {
    @EnvironmentObject private var client: OptimizationClient
    @State private var lastEventType: String = "none"

    var body: some View {
        Text(lastEventType)
            .task {
                // Subscribe before the actions you need to verify; this stream does not buffer.
                for await event in client.eventStream.values {
                    lastEventType = event["type"] as? String ?? "unknown"
                }
            }
    }
}
```

For cross-SDK forwarding patterns, see
[Forwarding Optimization SDK context to analytics and tag management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Custom Flags and MergeTag rendering

**Integration category:** Optional

Custom Flags resolve from SDK change/profile response state. MergeTag entries come from app-fetched
Contentful or Rich Text payloads. `client.getMergeTagValue(mergeTagEntry:)` resolves them against
the current SDK Optimization profile and falls back to the entry fallback. The application still
decides where to render the values.

1. Use `client.getFlag(_:)` for a one-time flag read after the SDK is initialized.
2. Use `client.flagPublisher(_:)` when SwiftUI state must update as flag values change.
3. Resolve Rich Text embedded `nt_mergetag` entries with `client.getMergeTagValue(mergeTagEntry:)`
   after your Contentful fetcher has inlined the target entry.
4. Provide application-owned fallback rendering when a flag or MergeTag value is missing.

**Adapt this to your use case:**

```swift
struct FlaggedBadge: View {
    @EnvironmentObject private var client: OptimizationClient
    @State private var enabled = false

    var body: some View {
        Group {
            if enabled {
                Text("Priority")
            }
        }
        .task {
            enabled = client.getFlag("priorityBadge") == .bool(true)
            // Keep observing while this SwiftUI state must follow SDK change/profile updates.
            for await value in client.flagPublisher("priorityBadge").values {
                enabled = value == .bool(true)
            }
        }
    }
}
```

One-time flag reads and flag subscriptions can attempt flag-view tracking when consent or the
allow-list and current profile allow it, so apply the same analytics governance you use for other
SDK events.

### Live updates

**Integration category:** Optional

By default, `OptimizedEntry` locks to the first variant it resolves so content does not change while
a visitor is reading it. Enable live updates when a screen must react to profile changes or preview
overrides without a reload.

1. Set `liveUpdates: true` on `OptimizationRoot` when most optimized entries in the tree must update
   as SDK state changes.
2. Set `liveUpdates: true` on an individual `OptimizedEntry` for a localized live section.
3. Set `liveUpdates: false` on an individual `OptimizedEntry` when that entry must remain locked
   even under a live global default.
4. Expect the preview panel to force live updates while it is open so overrides apply immediately.

**Adapt this to your use case:**

```swift
// Makes entries update when SDK profile state or preview overrides change.
OptimizationRoot(config: config, liveUpdates: true) {
    RootView()
}

OptimizedEntry(entry: dashboardEntry, liveUpdates: true) { resolvedEntry in
    Dashboard(entry: resolvedEntry)
}

// Keeps this entry locked after first resolution, except while the preview panel is open.
OptimizedEntry(entry: legalCopyEntry, liveUpdates: false) { resolvedEntry in
    LegalCopy(entry: resolvedEntry)
}
```

When the preview panel closes, locked `OptimizedEntry` components keep the previewed variant as the
locked value. For precedence rules, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

### Preview panel

**Integration category:** Optional

Use the preview panel only in debug or internal builds. `PreviewPanelConfig` is the preferred
SwiftUI path because `OptimizationRoot` can mount `PreviewPanelOverlay` for you.

1. Gate the panel behind a debug, internal, or feature-flag condition.
2. Pass `PreviewPanelConfig(enabled: false)` in builds where the panel must not render.
3. Pass a `PreviewContentfulClient` when the panel needs audience and experience names instead of
   raw identifiers.
4. Use `ContentfulHTTPPreviewClient` for a direct CDA-backed panel, or implement
   `PreviewContentfulClient` around your existing Contentful client.

**Adapt this to your use case:**

```swift
#if DEBUG
let previewPanel = PreviewPanelConfig(
    // Supplies names for preview audiences and experiences instead of raw IDs.
    contentfulClient: ContentfulHTTPPreviewClient(
        spaceId: "<space-id>",
        accessToken: "<delivery-api-token>",
        environment: "main"
    )
)
#else
let previewPanel = PreviewPanelConfig(enabled: false)
#endif

OptimizationRoot(
    config: config,
    // OptimizationRoot mounts the floating preview panel only when enabled.
    previewPanel: previewPanel
) {
    RootView()
}
```

`PreviewPanelOverlay` remains available when the app needs to place the floating action button
manually, but `PreviewPanelConfig` keeps the setup attached to the root SDK provider.

## Advanced integrations

### Strict event policy and endpoint controls

**Integration category:** Advanced or production-only

Use advanced configuration when production policy requires stricter pre-consent behavior, explicit
event allow-lists, non-default endpoints, or queue observability.

1. Pass `allowedEventTypes: []` when no SDK event can emit before consent.
2. Pass a narrow `allowedEventTypes` list when policy permits only specific pre-consent events.
3. Configure `OptimizationApiConfig` only for approved non-default Experience API or Insights API
   endpoints.
4. Configure `onEventBlocked` or `blockedEventStream` when release validation needs proof that
   denied events are blocked.
5. Configure `QueuePolicy` only when production operations need non-default queue limits, retry
   timing, or queue callback telemetry.

**Adapt this to your use case:**

```swift
let config = OptimizationConfig(
    clientId: "<your-client-id>",
    environment: "main",
    api: OptimizationApiConfig(
        experienceBaseUrl: "<experience-api-base-url>",
        insightsBaseUrl: "<insights-api-base-url>"
    ),
    // Blocks every SDK event until explicit consent is accepted.
    allowedEventTypes: [],
    queuePolicy: QueuePolicy(
        flush: QueueFlushPolicy(
            flushIntervalMs: 1000,
            maxConsecutiveFailures: 3
        ),
        offlineMaxEvents: 100
    ),
    onEventBlocked: { blocked in
        // Verification hook for confirming denied events do not leave the SDK.
        debugLogger.info("Blocked \(blocked.method): \(blocked.reason)")
    }
)
```

### Offline delivery and lifecycle flushing

**Integration category:** Advanced or production-only

The iOS SDK monitors network reachability and app lifecycle events after initialization. Events
queue while the device is offline, flush when connectivity returns, and flush again when the app
moves toward the background.

1. Keep one `OptimizationClient` alive for the app or scene lifetime so the in-memory queue can
   survive transient network changes.
2. Use `client.setOnline(false)` and `client.setOnline(true)` only for tests or deliberate app-owned
   network simulation.
3. Call `client.flush()` from app-owned shutdown or critical-flow checkpoints when policy requires a
   best-effort delivery attempt before leaving the flow.
4. Use the queue callbacks in `QueuePolicy` when operations teams need telemetry for offline drops,
   flush failures, circuit-open events, or recovery.

**Follow this pattern:**

```swift
Task {
    // Use app-owned checkpoints for a best-effort delivery attempt before leaving a flow.
    try? await client.flush()
}
```

For deeper runtime behavior, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#offline-and-app-lifecycle-delivery).

## Production checks

Before release, verify these checks against the target app build:

- Confirm the app uses the intended Optimization client ID, environment, SDK locale, and any
  approved Experience API or Insights API endpoint overrides.
- Confirm the Contentful client fetches single-locale entries with enough include depth for
  optimized entries, and verify baseline rendering still works when no variant matches.
- Confirm the consent flow covers default-on, accepted, rejected, and split event/persistence cases
  that apply to your policy.
- Confirm screen, entry view, entry tap, Custom Flag, and custom business events are accepted or
  blocked according to consent state.
- Confirm `.trackScreen(name:)` is attached once per logical screen and does not duplicate events
  during SwiftUI navigation transitions.
- Confirm scrollable entry lists use `OptimizationScrollView` when viewport-aware view timing is
  required.
- Confirm sign-out or privacy-reset flows call `reset()` when profile continuity must be cleared,
  and confirm application-owned identifiers are cleared outside the SDK.
- Confirm the preview panel is absent from public builds or gated to approved internal users.
- Confirm analytics forwarding code applies destination consent and does not replay events that the
  SDK blocked.
- Validate locally with the iOS reference implementation or the app's own targeted XCUITest flow
  before relying on production telemetry.

## Troubleshooting

Use these checks for common SwiftUI integration failures:

| Symptom                                  | Check                                                                                                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personalized content stays baseline      | Verify consent policy permits optimization, `identify` or screen events produce selected optimizations, CDA payloads are single-locale, and linked variants are included.                |
| Entry view events do not appear          | Verify `trackViews` was not opted out, the entry is visible for at least the dwell threshold, consent permits `trackView`, and scrollable content uses `OptimizationScrollView`.         |
| Entry tap events do not appear           | Verify `trackTaps` was not opted out globally or per entry, consent permits `trackClick`, and the entry has a Contentful `sys.id` for component metadata.                                |
| Screen events duplicate or go missing    | Attach `.trackScreen(name:)` to the stable screen root, and use an explicit `routeKey` when a dynamic screen name can change for the same logical route.                                 |
| Preview panel shows identifiers only     | Pass a `PreviewContentfulClient` so the panel can fetch audience and experience definitions from Contentful.                                                                             |
| Flag values do not update with `.sink`   | Subscribe after `OptimizationRoot` initializes, retain the returned `AnyCancellable` for as long as the view model needs updates, and verify the flag key exists in SDK `changes` state. |
| Flag values do not update with `.values` | Subscribe after `OptimizationRoot` initializes, keep the Swift concurrency task alive for as long as the view needs updates, and verify the flag key exists in SDK `changes` state.      |

## Reference implementations to compare against

- [iOS reference implementation](../../implementations/ios-sdk/README.md) - Demonstrates SwiftUI and
  UIKit shells that exercise shared native iOS bridge behavior, single-locale Contentful fetching,
  entry resolution, interaction tracking, screen tracking, Custom Flags, offline delivery, and
  preview-panel overrides against the same mock API.
