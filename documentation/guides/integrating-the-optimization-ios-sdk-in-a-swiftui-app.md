# Integrating the Optimization iOS SDK in a SwiftUI app

Use this guide to add Contentful personalization to a SwiftUI app using the Optimization iOS SDK. By
the end of the quick start, the SDK is initialized inside your SwiftUI app and emits one screen event
that its consent gate accepts — the event Contentful uses to keep that visitor's personalization
consistent.

**New to personalization?** Here is the whole idea in five points:

- In Contentful you author **variants** of an entry and attach them to an **experience** — a rule
  that decides which visitors see which variant.
- As the app runs, Contentful's **Experience API** looks at who the visitor is and picks the variant
  for each experience. Swapping a fetched entry for its picked variant is called **resolving** the
  entry.
- The Experience API also returns a **profile**: the anonymous, per-visitor identity and state used
  to keep personalization consistent across requests or app launches.
- Your app hands a Contentful entry to the SDK at the point where that entry becomes output. The SDK
  gives back the selected variant, or the original entry when no variant applies—the **baseline
  fallback**.
- You render the returned entry with the same application components you already use.

The iOS SDK persists the profile to `UserDefaults` across app launches when persistence consent
allows it.

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.

You will get there in two milestones:

- **Milestone 1 — the SDK initialized, reporting one screen event, and resolving entries (the quick
  start below plus the Core entry sections).** The quick start proves initialization and one accepted
  screen event. The [Contentful entry fetching and locale shape](#contentful-entry-fetching-and-locale-shape)
  and [Entry resolution and fallback rendering](#entry-resolution-and-fallback-rendering) sections
  then add entries resolving through `OptimizedEntry` once your app passes it fetched Contentful
  entries. This is complete and shippable on its own.
- **Milestone 2 — the opt-in layers (later).** Consent handoff, interaction tracking, identity,
  Custom Flags, live updates, the preview panel, strict event policy, and offline delivery, each
  introduced by the section that needs it.

This guide uses the `ContentfulOptimization` Swift Package. You mount one `OptimizationRoot` around
the SwiftUI tree that uses SDK views; it creates and initializes the SDK client, restores state from
`UserDefaults`, and provides it to the components and modifiers below it. Your app still owns its
Contentful entry fetching, consent policy, identity policy, navigation, and final rendering. If your
app is UIKit-based, use
[the UIKit iOS integration guide](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md) instead.

## Quick start

Most SwiftUI + Contentful apps share one shape: an `App` whose `WindowGroup` wraps a root view, with
screens fetched or built inside that tree. This quick start assumes that shape and proves the
smallest result: **the SDK initializes and emits one screen event that its consent gate accepts** — an
"accepted" event is one the SDK's local consent and allow-list checks let through to send, which is
what you can observe on the device; it is not a confirmation that Contentful received it. Entry
rendering needs an app-specific Contentful fetch, so it moves to
[Entry resolution and fallback rendering](#entry-resolution-and-fallback-rendering) in Core; here you
wrap your app root in `OptimizationRoot` and mark one screen with `.trackScreen(name:)`.

This quick start assumes your application policy permits Optimization to start with accepted consent
and renders no end-user consent UI, so it sets `defaults: StorageDefaults(consent: true)` — the
shorthand that accepts both consent axes at once. If personalization must wait for a consent
decision, keep this structure and add the
[Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff) step before you ship, which
explains the two axes and the split form that sets them separately.

1. Add the `ContentfulOptimization` Swift Package. In Xcode, choose **File → Add Package
   Dependencies** and enter the package URL `https://github.com/contentful/optimization.swift`. If
   your app is defined by a `Package.swift` manifest, add the dependency and product there instead
   and set a real version for `from:`.

   **Adapt this to your use case:**

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

   There is no `pod install` step for a Swift Package. After adding the package, build and run the
   app on a simulator (**Product → Run**, or ⌘R) so the SDK's bundled JavaScript runtime resource is
   linked into the build.

2. Wrap your app root in `OptimizationRoot`, pass your Optimization client ID, set `logLevel: .debug`
   so the SDK logs its activity, and add `.trackScreen(name:)` to one screen you already render.

   **Adapt this to your use case:**

   ```diff
    import SwiftUI
   +import ContentfulOptimization

    @main
    struct MyApp: App {
        var body: some Scene {
            WindowGroup {
   -            HomeScreen()
   +            // Wrap the tree that uses SDK views; one client stays alive for its lifetime.
   +            OptimizationRoot(
   +                config: OptimizationConfig(
   +                    clientId: "<your-client-id>",
   +                    // Accepted startup consent; the Consent section replaces this with your policy.
   +                    defaults: StorageDefaults(consent: true),
   +                    // .debug surfaces the accepted screen event in the Xcode console.
   +                    logLevel: .debug
   +                )
   +            ) {
   +                HomeScreen()
   +            }
            }
        }
    }

    struct HomeScreen: View {
        var body: some View {
            HomeContent()
   +            // Emits one screen event on appear; the SDK dedupes repeats of the same screen.
   +            .trackScreen(name: "Home")
        }
    }
   ```

   The `MyApp` and `HomeScreen` scaffolding above is illustrative context to match against your own
   app, not a file to paste over yours. Wrap your existing app root in `OptimizationRoot` and add
   `.trackScreen(name:)` to a screen you already render — keep the rest of your views as they are.

3. Verify the first run. Launch the app on a simulator. Because `logLevel: .debug` is set, the SDK
   logs its activity to the Xcode console under the `com.contentful.optimization` subsystem. The
   `.trackScreen(name:)` modifier sends the screen event through `trackCurrentScreen`, so filter the
   console for `optimization` and look for the pair of bridge lines it logs —
   `[bridge] Calling trackCurrentScreen async` followed by `[bridge] trackCurrentScreen succeeded`,
   whose result payload contains `"accepted":true`. That `succeeded` line with `accepted` true is the
   proof the event passed the consent gate. The [Custom events and analytics diagnostics](#custom-events-and-analytics-diagnostics)
   section adds a programmatic `eventStream` observer for asserting on events in code rather than
   reading logs.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
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

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- **A native SwiftUI app you can build in Xcode**, with its own Contentful entry fetching already
  working. The iOS SDK does not fetch Contentful entries for your application UI — you fetch them in
  the app layer and pass the resulting single-locale dictionaries to `OptimizedEntry` or
  `resolveOptimizedEntry(...)`. The SDK targets iOS 15+ / macOS 12+; it ships as a Swift Package with
  no `pod install` step, so you add it in Xcode (or `Package.swift`) and run a normal build on a
  simulator.
- **Contentful delivery credentials** — space ID, delivery token, and environment — read from your
  app's runtime configuration and used by your own Contentful fetching layer.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. The Experience API (which picks variants) and the Insights API (which receives event and
  interaction delivery) each have a base URL that defaults correctly; you set them only for mocks or
  non-default hosts (see [Install and initialize the SwiftUI root](#install-and-initialize-the-swiftui-root)).

You do not need a setup inventory up front. Everything else — consent, entry resolution, screen
tracking, interaction tracking, identity, live updates, preview, offline delivery — is introduced by
the section that needs it.

> [!NOTE]
>
> Read the SDK and Contentful config from your app's runtime configuration. This guide's examples use
> inline placeholder strings for clarity; the reference implementation reads its values from shared
> app configuration because it runs against shared mock defaults. Use whatever configuration
> convention your iOS app already uses and keep it consistent.

## Core integration

### Install and initialize the SwiftUI root

**Integration category:** Required for first integration

You wrapped your app root in `OptimizationRoot` in the quick start; this section covers its full
configuration surface. `OptimizationRoot` is the normal SwiftUI entry point: it owns one
`OptimizationClient` as a `@StateObject`, calls the client's `initialize(config:)` in a `.task`,
injects the client into the SwiftUI environment as an `@EnvironmentObject`, provides tracking
defaults to descendant `OptimizedEntry` views, and renders a `ProgressView()` until the client
reports `isInitialized`. Descendant views that call SDK methods directly read the client with
`@EnvironmentObject`.

`initialize(config:)` is synchronous and `throws` — it loads the SDK's bundled JavaScript runtime and
runs bridge initialization inline on the main actor, so it briefly blocks the main actor at startup
rather than awaiting. `OptimizationClient` is a `@MainActor` type; call its methods from SwiftUI view
tasks, event handlers, or other main-actor contexts.

1. Add `ContentfulOptimization` as a Swift Package dependency and build the app on a simulator.
2. Create one `OptimizationConfig` with the Optimization client ID. `environment` defaults to `main`,
   so pass it only when your Contentful environment differs.
3. Pass `locale` when Experience API responses and event context must use the same app locale as your
   Contentful entry fetches.
4. Pass `api` endpoint overrides only for staging, mocks, or non-default hosts; both base URLs default
   correctly otherwise, so most apps omit `api`.
5. Read the initialized client from `@EnvironmentObject` inside descendant views that call SDK methods
   directly.

**Adapt this to your use case:**

```swift
import ContentfulOptimization
import SwiftUI

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            // One SDK-owned client stays alive for the SwiftUI tree that uses Optimization.
            OptimizationRoot(
                config: OptimizationConfig(
                    clientId: "<your-client-id>",
                    // environment defaults to "main"; set it only when your Contentful environment differs.
                    locale: "en-US",
                    logLevel: .warn
                )
            ) {
                RootView()
            }
        }
    }
}

struct PurchaseButton: View {
    // Descendant views read the client OptimizationRoot created and initialized.
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        Button("Purchase") {
            Task {
                // OptimizationClient is @MainActor; call it from tasks or event handlers.
                _ = try? await client.track(event: "Purchase Completed", properties: ["sku": "sku-1"])
            }
        }
    }
}
```

`logLevel` defaults to `.error`; `.debug` and `.log` also enable remote JavaScript inspection in
debug builds. For lifecycle details, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-main-actor).
For package status and installation options, see
[the Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md).

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

Consent policy stays application-owned. Consent has two independent axes: **event consent** (may the
SDK personalize and emit events) and **persistence consent** (may the SDK store profile continuity in
`UserDefaults`). The boolean call `client.consent(_:)` sets both at once; the split call
`client.consent(events:persistence:)` sets them independently. `StorageDefaults(consent: true)` seeds
accepted event and persistence consent at startup — use it only when application policy permits
Optimization by default and you render no consent UI.

`StorageDefaults` values are startup defaults, not one-time seeds: a configured value takes precedence
over the stored `UserDefaults` value every launch, so a configured `consent` can replace a stored
choice. Apps that persist a user's own decision leave `StorageDefaults.consent` unset and call
`client.consent(...)` from resolved app policy instead.

1. Seed accepted consent with `StorageDefaults(consent: true)` only when policy permits default-on
   Optimization and no consent UI is shown.
2. Otherwise leave consent unset and call `client.consent(true)` after the visitor accepts,
   `client.consent(false)` after they reject.
3. Use the split form when events are allowed but durable profile continuity must stay session-only.
4. Read `client.state.consent` and `client.state.persistenceConsent` when consent UI must reflect SDK
   state.

**Adapt this to your use case:**

```swift
struct ConsentBanner: View {
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        HStack {
            Button("Accept") {
                // Boolean consent accepts both event emission and durable profile continuity.
                client.consent(true)
            }
            Button("Reject") {
                // Blocks non-allowed events and clears persisted profile continuity.
                client.consent(false)
            }
        }
    }
}
```

**Copy this:**

```swift
// Allows events but keeps profile continuity session-only.
client.consent(events: true, persistence: false)
```

Before event consent is accepted, the native default allow-list lets `identify` and `screen` events
emit; entry-view events (wire type `component`), tap events (`component_click`), and custom `track`
events are blocked until consent is accepted or you allow-list them. `client.consent(false)`
clears event and persistence consent, purges queued events, and clears durable profile continuity,
while in-memory state stays usable until reset or teardown. To block every SDK event before consent —
including `identify` and `screen` — set `allowedEventTypes: []`; see
[Strict event policy and endpoint controls](#strict-event-policy-and-endpoint-controls). For the
cross-SDK consent model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful entry fetching and locale shape

**Integration category:** Required for first integration

The iOS SDK does not fetch Contentful entries for your application UI — only the preview panel fetches
its own audience and experience definitions. Your app fetches entries from the Contentful Delivery
API and passes the resulting single-locale entry dictionaries to `OptimizedEntry` or
`client.resolveOptimizedEntry(...)`. There is no fetch-by-ID path in the iOS SDK, so the Contentful
client and its request options stay entirely yours.

Fetch with one concrete locale and enough `include` depth to resolve the linked optimization data.
`nt_experiences` is the SDK-owned link field the resolver reads on an optimized entry; it links that
entry's `nt_experience` entries, and each experience links its `nt_variants` (and `nt_audience`).
These are fixed Optimization content-model identifiers you do not choose. `nt_config` is a JSON field
on the experience, not a link, so it needs no extra include depth. Fetch deep enough to pull the
linked entries back in one payload — the reference implementation uses `include=10`. Do not pass
all-locale CDA responses such as `locale=*`; the resolver expects direct single-locale field values
and falls back to baseline on an all-locale payload.

The SDK Experience/event `locale` is distinct from the Contentful CDA locale: your app chooses the CDA
locale for its own fetch, and `OptimizationConfig(locale:)` sets the locale the Experience API and
events use. Keep them aligned when rendered content and Experience responses must match.

1. Choose the application Contentful locale in your app's navigation, i18n, or account layer.
2. Pass the same locale to `OptimizationConfig(locale:)` when Experience responses and event context
   must align with rendered content.
3. Fetch entries with a concrete locale and enough include depth for `nt_experiences` →
   `nt_experience` → `nt_variants`/`nt_audience`.
4. When the app locale changes, call `client.setLocale(...)`, refetch entries with the new locale, and
   re-render. `setLocale(...)` updates only the SDK Experience/event locale; it does not refetch
   Contentful or refresh profile state, and it throws before initialization or on an invalid locale.

**Adapt this to your use case:**

```swift
let appLocale = selectedAppLocale()

let config = OptimizationConfig(
    clientId: "<your-client-id>",
    // Aligns Experience API responses and event context with the rendered Contentful locale.
    locale: appLocale
)

// Your own CDA fetch: one concrete locale, include depth for linked experiences and variants.
let hero = await myContentfulFetcher.fetchEntry(id: "<entry-id>", locale: appLocale, include: 10)
```

For the full data shape and locale boundary, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
and
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Entry resolution and fallback rendering

**Integration category:** Required for first integration

`OptimizedEntry` renders a Contentful entry through the resolver. It detects an optimized entry by the
presence of the `nt_experiences` field; a non-optimized entry passes through unchanged, and an
optimized entry resolves against the visitor's selected variants. The render closure receives the
resolved entry dictionary — the selected variant, or the baseline entry when no variant matches —
with the same field shape as the baseline, so your renderer reads fields without branching on whether
a variant was applied.

Resolution is synchronous and fail-soft. `client.resolveOptimizedEntry(baseline:selectedOptimizations:)`
returns a `ResolvedOptimizedEntry`; if the client is not initialized, serialization fails, or the
bridge result cannot be parsed, it returns the baseline entry unchanged and logs a warning rather than
throwing or breaking the UI. The `selectedOptimizations` argument is the SDK's current per-experience
variant selections; pass `nil` (the default) to resolve against the SDK's live selection state, or
pass an explicit snapshot to resolve against exactly that.

1. Pass the baseline Contentful entry dictionary to `OptimizedEntry` and read fields from the resolved
   entry in the render closure.
2. Cast the resolved fields to your own model type in the closure; the entry keeps the baseline field
   shape.
3. Provide your own loading treatment while the app-owned fetch is pending — `OptimizedEntry` needs an
   entry to render, so gate it on your fetched state.
4. Use `client.resolveOptimizedEntry(...)` directly only when a component must separate resolution
   from rendering.

**Adapt this to your use case:**

```swift
struct HeroSection: View {
    // nil until your app-owned CDA fetch settles.
    let entry: [String: Any]?

    var body: some View {
        if let entry {
            OptimizedEntry(entry: entry) { resolvedEntry in
                // resolvedEntry is the selected variant, or the baseline entry when none matches.
                HeroCard(entry: resolvedEntry)
            }
        } else {
            // Your own loading treatment; OptimizedEntry needs a fetched entry to render.
            ProgressView()
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
        // Resolve separately from rendering; omitting selectedOptimizations uses the SDK's live selection.
        let result = client.resolveOptimizedEntry(baseline: entry)
        CTAHeader(entry: result.entry)
    }
}
```

Entry resolution is local and synchronous once the app has both the Contentful entry and SDK
optimization state. For the fallback rules, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#fallback-behavior).

### Screen events and SwiftUI navigation

**Integration category:** Required for first integration

You added `.trackScreen(name:)` in the quick start. The modifier calls `client.trackCurrentScreen(name:)`
when the view appears, when a consent change allows a previously blocked screen to emit, and when the
screen name changes. `trackCurrentScreen` dedupes in the bridge by route key (defaulting to the name),
so a repeat of the same current screen is skipped and a blocked attempt is retried once consent
allows. Plain `client.screen(name:)` emits with no dedupe.

Attach `.trackScreen(name:)` once to a screen's stable root. For a dynamic screen name or an
app-defined route key — for example a detail screen whose name depends on loaded data — call
`client.trackCurrentScreen(name:properties:routeKey:)` from a task after the data is available
instead. Track a given route through one path only: do not attach `.trackScreen` and also call
`trackCurrentScreen`/`screen` for the same route, or you will emit duplicate or conflicting events.

1. Attach `.trackScreen(name:)` to the stable root of each screen that maps to an analytics screen.
2. Use stable names for navigation destinations so downstream reporting can group events.
3. For dynamic names or an explicit route key, call `client.trackCurrentScreen(name:properties:routeKey:)`
   from a `.task` once the data is available.
4. Use one screen-tracking path per route.

**Follow this pattern:**

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
                    // Keeps dedupe and retries tied to one logical route across name changes.
                    routeKey: "blog-post-\(postId)"
                )
            }
    }
}
```

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizedEntry` tracks two interactions for the entry it wraps: entry views and entry taps (there is
no hover on iOS). Both default to enabled. `OptimizationRoot` sets the tree-wide defaults through its
`trackViews` and `trackTaps` parameters, and each `OptimizedEntry` can override them per entry.
`trackViews` and `trackTaps` are the configuration switches; on the wire an entry view is delivered as
a `component` event and a tap as a `component_click` event. Delivery is gated on consent: view
tracking checks `hasConsent("trackView")` and tap tracking checks `hasConsent("trackClick")`, so both
stay blocked until event consent (or an allow-list entry) permits them.

View tracking is viewport-based. Wrap scrollable content in `OptimizationScrollView` so view timing
uses the real scroll position; without an enclosing scroll view, tracking assumes `scrollY` is `0` and
uses the screen height as the viewport, which suits only non-scrolling or already-visible layouts. The
default view threshold is 80% visibility (`minVisibleRatio` `0.8`) held for 2000 ms (`dwellTimeMs`);
after the first view event, duration updates emit every 5000 ms (`viewDurationUpdateIntervalMs`) while
the entry stays visible.

A tap uses a SwiftUI `TapGesture` on the `OptimizedEntry` wrapper: it emits the `component_click`
event, then calls the optional `onTap` closure. That closure receives the **baseline** entry you
passed in, not the resolved variant — only the render closure receives the resolved entry — so do not
read variant-dependent fields from it. Because `onTap` runs through that same tap modifier, setting
`trackTaps: false` disables both the tap event and `onTap`. For app-only navigation that must not
depend on tap tracking, use a SwiftUI `Button` or your own gesture inside the render closure and read
the resolved entry's fields there.

1. Leave view and tap tracking enabled for entries that need exposure and interaction analytics.
2. Set `trackViews: false` or `trackTaps: false` on `OptimizationRoot` for a tree-wide opt-out, or on
   an individual `OptimizedEntry` for one surface.
3. Wrap scrollable entry lists in `OptimizationScrollView` for accurate viewport timing.
4. Tune `dwellTimeMs`, `minVisibleRatio`, and `viewDurationUpdateIntervalMs` per entry only when
   analytics requirements differ from the defaults.
5. Use a `Button` or app gesture inside the render closure for navigation, and `onTap` only when the
   SDK tap event should also drive it.

**Adapt this to your use case:**

```swift
OptimizationRoot(config: config, trackTaps: false) {
    // Tree-wide tap opt-out: no OptimizedEntry below emits component_click.
    RootView()
}
```

**Adapt this to your use case:**

```swift
OptimizationScrollView {
    LazyVStack(alignment: .leading, spacing: 12) {
        ForEach(Array(posts.enumerated()), id: \.offset) { _, post in
            // Per-entry thresholds override the tree defaults from OptimizationRoot.
            OptimizedEntry(entry: post, minVisibleRatio: 0.5, dwellTimeMs: 1000) { resolvedEntry in
                BlogPostCard(entry: resolvedEntry)
            }
        }
    }
}
```

**Adapt this to your use case:**

```swift
// SDK tap event plus app navigation. onTap fires after component_click, but it
// receives the baseline entry — so navigate with the resolved entry from the
// render closure instead, which carries the variant's fields.
OptimizedEntry(entry: cta, onTap: { _ in
    analytics.log("cta-tapped") // A side effect that needs no variant fields.
}) { resolvedEntry in
    CTAHeader(entry: resolvedEntry)
        .onTapGesture { navigate(to: resolvedEntry) }
}

// App-only navigation that must not depend on tap tracking:
OptimizedEntry(entry: cta, trackTaps: false) { resolvedEntry in
    Button {
        navigate(to: resolvedEntry)
    } label: {
        CTAHeader(entry: resolvedEntry)
    }
}
```

For timing thresholds, scroll context, and delivery behavior, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

### Identity, profile state, and reset

**Integration category:** Common but policy-dependent

Identify a user when your product has an application-owned identity to associate with the profile.
`client.identify(userId:traits:)` links that identity to the current profile. The SDK publishes its
state reactively: `client.selectedOptimizations` and `client.locale` are top-level `@Published`
properties, and `client.state` publishes a snapshot carrying the profile, consent, and `changes` —
the inline field and flag values the Experience API returned for this visitor. SwiftUI views observe
any of them directly. Keep traits limited to values approved for Optimization profile use.

When persistence consent allows it, the SDK stores profile continuity — profile, changes, selected
optimizations, and the anonymous id — in `UserDefaults` across app launches, reading it once at
startup and running from in-memory state thereafter. `client.reset()` clears that continuity (profile,
changes, selected optimizations, anonymous id, and the current-screen dedupe) but preserves the stored
consent decision, so the next SDK activity still follows the visitor's existing consent. `reset()`
no-ops before initialization.

1. Call `identify(userId:traits:)` from the authenticated flow or account state change that owns
   identity.
2. Read `client.state.profile` when SwiftUI must react to profile state; read
   `client.selectedOptimizations` only for app-owned resolution or diagnostics (`OptimizedEntry`
   observes it for you).
3. Call `client.reset()` on sign-out or a privacy reset that must clear profile continuity.
4. Re-emit a screen event after reset when the active journey needs fresh anonymous state.
5. Use `client.consent(events:persistence:)` when profile-continuity persistence must differ from
   event consent.

**Adapt this to your use case:**

```swift
struct AccountControls: View {
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        VStack {
            Button("Identify") {
                Task {
                    // Identify once your app-owned authentication state is available.
                    _ = try? await client.identify(userId: "user-123", traits: ["plan": "pro"])
                }
            }

            Button("Reset") {
                // Clears SDK-managed profile continuity; the stored consent decision survives.
                client.reset()
            }
        }
    }
}
```

## Optional integrations

### Custom events and analytics diagnostics

**Integration category:** Optional

Use `client.track(event:properties:)` for application-owned business events, and the SDK event streams
for debug surfaces, local validation, or forwarding to your analytics pipeline.

`client.eventStream` is a passthrough Combine publisher fed by every emitted event; it does not replay
prior events to late subscribers, so subscribe before the events you want to observe (for example in
the root screen's `.task`, before child views can emit) or accept that earlier events are missed. This
is the programmatic observer the quick start pointed to: subscribe to `eventStream` to assert on the
accepted `screen` event in code instead of reading the Xcode console. `client.blockedEventStream` (and
the `onEventBlocked` config callback) surfaces events blocked by consent or the allow-list. Keep any
downstream destination consent checks in your app before forwarding.

1. Call `client.track(event:properties:)` from the SwiftUI handler that owns the business action.
2. Subscribe to `client.eventStream` before the actions you need to observe; it does not buffer.
3. Subscribe to `client.blockedEventStream` or set `onEventBlocked` when a debug UI or logger must
   explain consent-blocked events.
4. Apply destination consent in your app before forwarding events.

**Adapt this to your use case:**

```swift
struct AnalyticsDiagnostics: View {
    @EnvironmentObject private var client: OptimizationClient
    @State private var lastEventType = "none"

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

Custom Flags and merge tags read profile-backed values the Experience API returns, separately from
entry variant selection. `client.getFlag(_:)` is a one-time, non-reactive read; `client.flagPublisher(_:)`
returns a Combine publisher that updates as the flag value changes. Subscribing to a flag registers a
flag observation that emits a `component` flag-view event through the event stream when consent and
profile allow, so flag delivery is an analytics exposure — apply the same governance you use for other
SDK events.

`client.getMergeTagValue(mergeTagEntry:)` resolves an inline `nt_mergetag` entry — the SDK-owned
merge-tag content-model identifier — against the current profile and returns the resolved string, or
`nil` when it cannot resolve. Your app owns extracting the embedded `nt_mergetag` entry from Rich Text
before calling it, and owns where the value renders.

1. Use `client.getFlag(_:)` for a one-time flag read after the SDK is initialized.
2. Use `client.flagPublisher(_:)` when SwiftUI state must follow flag changes.
3. Resolve Rich Text `nt_mergetag` entries with `client.getMergeTagValue(mergeTagEntry:)` after your
   fetcher has inlined the target entry.
4. Provide app-owned fallback rendering when a flag or merge-tag value is missing.

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

### Live updates

**Integration category:** Optional

By default, `OptimizedEntry` locks to the first variant it resolves, so content does not change while
a visitor is reading it. Enable live updates when a screen must react to profile changes or preview
overrides without a reload.

1. Set `liveUpdates: true` on `OptimizationRoot` when most optimized entries in the tree must update
   as SDK state changes.
2. Set `liveUpdates: true` on an individual `OptimizedEntry` for a localized live section.
3. Set `liveUpdates: false` on an individual `OptimizedEntry` to keep it locked even under a live
   global default.
4. Expect the preview panel to force live updates while it is open so overrides apply immediately.

**Adapt this to your use case:**

```swift
// Root default: entries update as SDK profile state or preview overrides change.
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

The resolution order is: an open preview panel forces live updates, then a per-entry `liveUpdates`
value, then the `OptimizationRoot` `liveUpdates` default, then the locked default. When the preview
panel closes, a locked `OptimizedEntry` snapshots the current selections so applied overrides persist.
For the precedence rules, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

### Preview panel

**Integration category:** Optional

Use the preview panel only in debug or internal builds. `PreviewPanelConfig` is the preferred SwiftUI
path because `OptimizationRoot` mounts `PreviewPanelOverlay` for you. The panel fetches `nt_audience`
and `nt_experience` definitions — the SDK-owned audience and experience content types — through an
app-supplied `PreviewContentfulClient`, then lets users override audiences and variants locally.

1. Gate the panel behind a debug, internal, or feature-flag condition.
2. Pass `PreviewPanelConfig(enabled: false)` in builds where the panel must not render.
3. Pass a `PreviewContentfulClient` so the panel shows audience and experience names instead of raw
   identifiers.
4. Use `ContentfulHTTPPreviewClient` for a direct CDA-backed panel, or implement `PreviewContentfulClient`
   around your existing Contentful client.

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

OptimizationRoot(config: config, previewPanel: previewPanel) {
    RootView()
}
```

`PreviewPanelOverlay` reads the client from the SwiftUI environment, so it must sit under an
`OptimizationRoot`. It remains available when the app needs to place the floating action button
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
4. Configure `onEventBlocked` or subscribe to `blockedEventStream` when release validation needs proof
   that denied events are blocked.
5. Configure `QueuePolicy` only when production operations need non-default queue limits, retry
   timing, or queue callback telemetry.

**Adapt this to your use case:**

```swift
let config = OptimizationConfig(
    clientId: "<your-client-id>",
    api: OptimizationApiConfig(
        experienceBaseUrl: "<experience-api-base-url>",
        insightsBaseUrl: "<insights-api-base-url>"
    ),
    // Blocks every SDK event until explicit consent is accepted.
    allowedEventTypes: [],
    queuePolicy: QueuePolicy(
        flush: QueueFlushPolicy(flushIntervalMs: 1000, maxConsecutiveFailures: 3),
        offlineMaxEvents: 100
    ),
    onEventBlocked: { blocked in
        // Verification hook: confirm denied events do not leave the SDK.
        debugLogger.info("Blocked \(blocked.method): \(blocked.reason)")
    }
)
```

### Offline delivery and lifecycle flushing

**Integration category:** Advanced or production-only

After initialization the SDK monitors network reachability and app lifecycle. A `NetworkMonitor`
(`NWPathMonitor`) calls `setOnline(_:)` on connectivity changes and `flush()` on reconnect; on UIKit
an `AppStateHandler` calls `flush()` when the app resigns active for a best-effort background drain.
Queues are in-memory only — there is no durable outbox — and the offline Experience buffer is capped
at 100 events by default (tunable via `QueuePolicy.offlineMaxEvents`); nothing survives process death.

1. Keep one `OptimizationClient` alive for the app or scene lifetime so the in-memory queue can
   survive transient network changes.
2. Use `client.setOnline(false)` and `client.setOnline(true)` only for tests or deliberate app-owned
   network simulation.
3. Call `client.flush()` from app-owned shutdown or critical-flow checkpoints when policy requires a
   best-effort delivery attempt before leaving the flow.
4. Use the `QueuePolicy` callbacks when operations teams need telemetry for offline drops, flush
   failures, circuit-open events, or recovery.

**Follow this pattern:**

```swift
Task {
    // Best-effort delivery attempt before leaving a critical flow.
    try? await client.flush()
}
```

For deeper runtime behavior, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#offline-and-app-lifecycle-delivery).

## Production checks

Before release, verify these checks against the target app build:

- **Credentials and runtime configuration** — the app uses the intended Optimization client ID and
  environment, the SDK Experience/event locale, and any approved Experience API or Insights API
  endpoint overrides; mock or localhost base URLs are absent from production configuration.
- **Consent behavior** — default-on consent is used only when policy permits it; user-choice flows
  call `consent(true | false)`; split event/persistence consent matches your persistence policy; and
  rejected consent blocks non-allowed event types.
- **Event delivery** — screen, entry view, entry tap, Custom Flag, and custom business events are
  accepted or blocked according to consent state, and offline replay plus background flush behave as
  expected on your supported platforms.
- **Content fallback** — the Contentful client fetches single-locale entries with enough include depth
  for optimized entries, and baseline rendering still works when no variant matches or data is
  incomplete.
- **Duplicate-tracking prevention** — one `OptimizationRoot` owns the SwiftUI tree, each route uses
  one screen-tracking path, `.trackScreen(name:)` is attached once per logical screen, and the app
  does not wrap the same rendered entry more than once for one impression.
- **Privacy and governance** — forwarded analytics payloads apply destination consent and do not
  replay events the SDK blocked, profile traits are approved, the preview panel is absent from public
  builds or gated to approved internal users, and persisted profile continuity matches consent
  records.
- **Local validation path** — validate against the iOS reference implementation or the app's own
  targeted XCUITest flow before relying on production telemetry.

## Troubleshooting

Use these checks for common SwiftUI integration failures:

| Symptom                               | Check                                                                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personalized content stays baseline   | Confirm consent permits optimization, a `screen` or `identify` event has produced selected optimizations, the CDA payload is single-locale (not `locale=*`), and linked variants are included deeply enough.                      |
| Entry view or tap events are missing  | Confirm `trackViews`/`trackTaps` were not opted out, consent permits `trackView`/`trackClick`, the entry stayed visible past the dwell threshold, scrollable content uses `OptimizationScrollView`, and the entry has a `sys.id`. |
| Screen events duplicate or go missing | Attach `.trackScreen(name:)` once to the stable screen root, use one screen-tracking path per route, and pass an explicit `routeKey` when a dynamic screen name can change for the same logical route.                            |
| Preview panel shows identifiers only  | Pass a `PreviewContentfulClient` so the panel can fetch `nt_audience` and `nt_experience` definitions and show names instead of raw IDs.                                                                                          |
| Flag values do not update             | Subscribe after `OptimizationRoot` initializes, keep the Combine subscription or Swift concurrency task alive for as long as the view needs updates, and verify the flag key exists in SDK change/profile state.                  |

## Reference implementations to compare against

- [iOS reference implementation](../../implementations/ios-sdk/README.md) — the maintained SwiftUI and
  UIKit shells that exercise shared native iOS bridge behavior, single-locale Contentful fetching,
  entry resolution, interaction tracking, screen tracking, Custom Flags, offline delivery, and
  preview-panel overrides against the same mock API.
