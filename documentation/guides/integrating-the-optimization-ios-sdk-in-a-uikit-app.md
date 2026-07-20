# Integrating the Optimization iOS SDK in a UIKit app

Use this guide to add Contentful personalization to a UIKit app with the `ContentfulOptimization`
Swift Package. By the end of the quick start, the SDK is running in your scene and one screen event
has passed the SDK's consent gate, with a visible label confirming it.

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

The iOS SDK persists the profile in `UserDefaults` across app launches when persistence consent
allows it.

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.

You will get there in two milestones:

- **Milestone 1 — the SDK initialized in your scene and one accepted screen event (the quick start
  below).** Once your app also hands the SDK a fetched Contentful entry, that entry resolves to a
  variant or the baseline through `resolveOptimizedEntry` (the
  [Contentful fetching and entry resolution](#contentful-fetching-and-entry-resolution) section).
  This is complete and shippable on its own.
- **Milestone 2 — the opt-in layers (later).** Consent handoff, interaction tracking, identity,
  Custom Flags, live updates, the preview panel, runtime locale changes, and offline delivery, each
  introduced by the section that needs it. Start with
  [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff).

This guide uses `ContentfulOptimization`. UIKit apps drive the SDK through the imperative
`OptimizationClient`: you create and initialize one client, hold it for the scene or app lifetime,
and inject it into the view controllers that track events or resolve entries. The SDK does not
replace your app's Contentful client — your UIKit app still owns Contentful fetching, link
resolution, consent UX, identity policy, navigation, caching, and rendering. If your app renders
through SwiftUI views instead, use the
[Integrating the Optimization iOS SDK in a SwiftUI app](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)
guide.

## Quick start

Most UIKit + Contentful apps share one shape: a `SceneDelegate` builds the window and a root view
controller, and a `UIViewController` presents content. This quick start assumes that shape and proves
the smallest result: **the SDK initializes in your scene and one screen event is accepted, and a
visible label flips to confirm it.** It owns one `OptimizationClient` in the scene, initializes it,
injects it into the first view controller, and tracks the current screen from `viewDidAppear(_:)`.

This quick start assumes your application policy permits Optimization to start with accepted consent
and renders no end-user consent UI, so it seeds `StorageDefaults(consent: true)` — the shorthand that
accepts both consent axes at once. If personalization must wait for a consent decision, keep this
structure and add the [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff) step
before you ship, which explains the two axes and the split form that sets them separately.

1. Add the `ContentfulOptimization` Swift Package to your app target from
   `https://github.com/contentful/optimization.swift` (in Xcode: **File > Add Package
   Dependencies**), then build and run the app target once so Swift Package Manager resolves and
   compiles the package. The package supports iOS 15+ and macOS 12+.

2. Own one client in your existing `SceneDelegate`, initialize it, and inject it into your first view
   controller. `initialize(config:)` is synchronous and `throws` (it runs bridge setup inline on the
   main actor), so call it with `try`/`try?` and no `await`.

   **Adapt this to your use case:**

   ```diff
    import UIKit
   +import ContentfulOptimization

    final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
        var window: UIWindow?

   +    // Own one client for the whole scene, then inject this same instance
   +    // into the view controllers that track events or resolve entries.
   +    let client = OptimizationClient()

        func scene(
            _ scene: UIScene,
            willConnectTo _: UISceneSession,
            options _: UIScene.ConnectionOptions
        ) {
            guard let windowScene = scene as? UIWindowScene else { return }

   +        // Synchronous throws, not async: call with try/try? and no await.
   +        // StorageDefaults seeds accepted consent at startup for this proof.
   +        try? client.initialize(config: OptimizationConfig(
   +            clientId: "your-optimization-client-id",
   +            defaults: StorageDefaults(consent: true),
   +            logLevel: .debug,
   +            onEventBlocked: { blocked in
   +                // If the label reads "blocked", this prints why.
   +                print("Optimization blocked \(blocked.method): \(blocked.reason)")
   +            }
   +        ))

   -        let home = HomeViewController()
   +        let home = HomeViewController(client: client)
            window = UIWindow(windowScene: windowScene)
            window?.rootViewController = UINavigationController(rootViewController: home)
            window?.makeKeyAndVisible()
        }
    }
   ```

   The unchanged lines above are illustrative context to match against your own `SceneDelegate`, not
   a block to paste over it. `StorageDefaults` is an SDK config type; `StorageDefaults(consent: true)`
   grants both consent axes at startup.

3. Track the current screen from a view controller and reflect the outcome in a label. `HomeViewController`
   below is illustrative app shape — adapt it to a screen you already render, keeping the
   client-injection initializer and the `trackCurrentScreen` call in `viewDidAppear`.

   **Adapt this to your use case:**

   ```swift
   import ContentfulOptimization
   import UIKit

   final class HomeViewController: UIViewController {
       private let client: OptimizationClient
       private let statusLabel = UILabel()

       init(client: OptimizationClient) {
           self.client = client
           super.init(nibName: nil, bundle: nil)
       }

       @available(*, unavailable)
       required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

       override func viewDidLoad() {
           super.viewDidLoad()
           statusLabel.text = "Waiting for Optimization"
           statusLabel.textAlignment = .center
           statusLabel.translatesAutoresizingMaskIntoConstraints = false
           view.addSubview(statusLabel)
           NSLayoutConstraint.activate([
               statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
               statusLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
           ])
       }

       override func viewDidAppear(_ animated: Bool) {
           super.viewDidAppear(animated)
           Task { @MainActor in
               // Track the current screen once UIKit has made it visible.
               let result = try? await client.trackCurrentScreen(name: "Home")
               statusLabel.text = result?.accepted == true
                   ? "Optimization screen event accepted"
                   : "Optimization screen event blocked"
           }
       }
   }
   ```

4. Verify the first run. Launch the app; the label reads `Optimization screen event accepted`.
   `trackCurrentScreen` returns an `EventEmissionResult` — an SDK result type whose `accepted` flag is
   `true` when the event passed the SDK's local consent and allow-list gate and was emitted or queued
   for delivery. `accepted` does not confirm that Contentful received the event, only that the local
   gate let it through. Because `StorageDefaults(consent: true)` grants consent and `screen` is on the
   SDK's default pre-consent allow-list, the event is accepted. If the label reads
   `Optimization screen event blocked` instead, there are two causes to tell apart. If the consent
   gate rejected the event, the `onEventBlocked` callback prints a line prefixed `Optimization blocked`
   naming the reason and method — search the Xcode console for that prefix. If instead the client
   never initialized (for example a wrong `clientId`), `try?` in step 2 swallowed the thrown error, so
   `onEventBlocked` never fires; the SDK's `logLevel: .debug` output under the
   `com.contentful.optimization` subsystem shows the failed init. To see the init error directly,
   temporarily replace `try?` with a `do { try client.initialize(...) } catch { print(error) }` block.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [Package installation and SDK configuration](#package-installation-and-sdk-configuration)
  - [Client lifetime and UIKit injection](#client-lifetime-and-uikit-injection)
  - [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff)
  - [Contentful fetching and entry resolution](#contentful-fetching-and-entry-resolution)
  - [Screen and navigation tracking](#screen-and-navigation-tracking)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Identity, profile continuity, and reset](#identity-profile-continuity-and-reset)
- [Optional integrations](#optional-integrations)
  - [Custom events and analytics diagnostics](#custom-events-and-analytics-diagnostics)
  - [Custom Flags and MergeTag rendering](#custom-flags-and-mergetag-rendering)
  - [Live updates and locked variants](#live-updates-and-locked-variants)
  - [Preview panel](#preview-panel)
  - [Runtime locale changes](#runtime-locale-changes)
- [Advanced integrations](#advanced-integrations)
  - [Offline delivery, queue observability, and app-owned caching](#offline-delivery-queue-observability-and-app-owned-caching)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- **A UIKit app and Xcode**, with your own Contentful fetching already working and the ability to add
  a Swift package and run an Xcode build. The SDK is added through Swift Package Manager and supports
  iOS 15+ and macOS 12+.
- **Contentful delivery credentials** — space ID, delivery token, environment, and one concrete
  locale — read from your app's configuration layer.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. The `environment` defaults to `main`, so pass it only when your setup differs. The
  Experience API (which picks variants) and the Insights API (which receives event and interaction
  delivery) each have a base URL that defaults correctly; you only set them for mocks or non-default
  hosts (see [Package installation and SDK configuration](#package-installation-and-sdk-configuration)).

You do not need a setup inventory up front. Everything else — consent, entry resolution, screen
tracking, interaction tracking, identity, live updates, preview, runtime locale changes, offline
delivery — is introduced by the section that needs it.

> [!NOTE]
>
> Read the SDK client ID, Contentful credentials, and any base-URL overrides from your app's own
> configuration layer — an xcconfig value, a build setting, or a generated config type. This guide's
> examples use inline placeholder strings for clarity; the iOS reference app centralizes these in a
> shared `AppConfig` because it runs against shared mock defaults. Use whatever configuration
> convention your app already uses and keep it consistent.

## Core integration

### Package installation and SDK configuration

**Integration category:** Required for first integration

Add the package from `https://github.com/contentful/optimization.swift`, then build and run the app
target once in Xcode so Swift Package Manager resolves and compiles it before you wire the client.
Most apps add it through Xcode's **File > Add Package Dependencies**; SwiftPM-manifest targets add it
in `Package.swift`.

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
],
```

Configure the SDK with your Optimization client ID and the environment that matches your Contentful
setup. Only `clientId` is required by the initializer.

1. Pass `clientId` from your configuration layer.
2. Pass `environment` only when it is not the default `main`.
3. Pass `locale` when Experience API requests and event context must use the same language as the
   Contentful entries you render.
4. Set `api` base URLs (`experienceBaseUrl`/`insightsBaseUrl`) only for mock, staging, or other
   non-default endpoints — both default correctly otherwise.
5. Keep `logLevel` at its default `.error` in production unless your operational policy allows more
   verbose logging.

**Adapt this to your use case:**

```swift
let appLocale = "en-US"

let config = OptimizationConfig(
    clientId: "your-optimization-client-id",
    // environment defaults to "main"; pass it only when your setup differs.
    // Keep SDK event and Experience locale aligned with rendered CDA entries.
    locale: appLocale
)
```

For package-level installation notes, see the
[Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md).

### Client lifetime and UIKit injection

**Integration category:** Required for first integration

UIKit integrations use `OptimizationClient` directly. Keep one initialized client alive for the scene
or app lifetime, then inject that instance into every controller or view that resolves entries or
tracks events.

1. Create the client in `SceneDelegate`, `AppDelegate`, or an app-level dependency container, and
   call `initialize(config:)` before presenting content that uses Optimization.
2. Pass the initialized client through initializers instead of creating separate clients in child
   controllers.
3. Return to the main actor before calling the client from asynchronous callbacks; `OptimizationClient`
   is `@MainActor`.
4. Gate UI on readiness when needed: the client publishes `isInitialized`, so observe
   `client.$isInitialized` when a screen must wait for setup before it reads SDK state.

**Adapt this to your use case:**

```swift
final class ProductViewController: UIViewController {
    private let client: OptimizationClient

    // Inject the app-owned client instead of creating a new one here.
    init(client: OptimizationClient) {
        self.client = client
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { @MainActor in
            // Hop back to the main actor before any client call.
            _ = try? await client.trackCurrentScreen(name: "ProductList")
        }
    }
}
```

Use `destroy()` only for test teardown or a deliberate SDK teardown flow, not for normal navigation
between UIKit screens. For lifecycle and main-actor mechanics, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-main-actor).

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

Consent policy belongs to your application. The SDK provides the runtime gate; your app or CMP owns
notice, user choices, consent records, jurisdiction logic, and withdrawal behavior. Consent has two
independent axes: event consent (may the SDK personalize and emit events) and persistence consent
(may the SDK store profile continuity in `UserDefaults`).

1. Use `StorageDefaults(consent: true)` at startup only when application policy permits SDK activity
   at launch.
2. Leave `defaults` unset when the app must collect a choice before gated events can emit, and call
   `consent(...)` from the app-owned banner, CMP callback, or settings flow.
3. Use `consent(_:)` for the boolean shorthand that sets both axes, or `consent(events:persistence:)`
   to set them independently.
4. Pass `allowedEventTypes: []` for strict opt-in, so no SDK event emits before event consent.
5. Observe `client.$state` when the UI must reflect event consent or persistence consent.

**Adapt this to your use case:**

```swift
@objc private func acceptTapped() {
    // Boolean consent sets both event emission and durable profile continuity.
    client.consent(true)
}

@objc private func rejectTapped() {
    client.consent(false)
}

@objc private func allowEventsOnlyTapped() {
    // Split consent: emit events but keep profile continuity session-only.
    client.consent(events: true, persistence: false)
}
```

When `allowedEventTypes` is unset, the SDK's default pre-consent allow-list lets `identify` and
`screen` emit before event consent, so a mobile journey can establish profile context and anonymous
screen analytics. Entry views, entry taps, and custom `track` events are blocked until
consent is accepted. A custom `allowedEventTypes` replaces that default, and `allowedEventTypes: []`
blocks every SDK event until consent is accepted. `consent(false)` clears both axes, purges queues,
and clears durable continuity while in-memory state stays usable until reset or teardown.

**Adapt this to your use case:**

```swift
let config = OptimizationConfig(
    clientId: "your-optimization-client-id",
    // Replaces the default pre-consent allow-list of identify and screen with
    // strict opt-in: nothing emits until consent is accepted.
    allowedEventTypes: []
)
```

For the full consent responsibility model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful fetching and entry resolution

**Integration category:** Required for first integration

The iOS SDK has no fetch-by-ID path, so your app always owns the Contentful Delivery API fetch. You
fetch the entry, hand it to the SDK, and the SDK resolves it locally against the selected
optimizations for the current visitor.

`client.selectedOptimizations` (plural) is the SDK's current set of selected optimizations — one
selection per experience the visitor's profile matched, published on the client and updated from
Experience API responses. `resolveOptimizedEntry(baseline:selectedOptimizations:)` returns a
`ResolvedOptimizedEntry` — an SDK result type that wraps the resolved `entry`, the single
`selectedOptimization` (singular) that was applied to it, and an `optimizationContextId` identifying
the optimization context, the profile-and-selection state that produced the variant. Note the
one-letter difference: `selectedOptimizations` is the set you pass in (or the SDK resolves against),
while `selectedOptimization` is the one selection returned on the result.

1. Fetch entries with one concrete Contentful locale. Do not pass all-locale payloads (`locale=*` or
   all-locale helpers) into entry resolution — they fall back to baseline.
2. Include linked entries deeply enough to resolve the optimization links. `nt_experiences` (plural)
   is the SDK-fixed link field the SDK reads on an optimized entry; it links that entry's
   `nt_experience` (singular) experiences, and each experience links its `nt_variants` and
   `nt_audience` entries. These are SDK-owned Optimization content-model names, not names you choose;
   your fetch must `include` deeply enough to pull them back in one payload. `include: 10` is the
   reference implementation's pattern.
3. Keep the app's Contentful locale aligned with SDK `locale` when rendered content and events must
   use the same language.
4. Resolve entries during view, cell, or wrapper configuration.
5. Render `result.entry`. Use `result.selectedOptimization` and `result.optimizationContextId` only
   when building tracking payloads.

**Follow this pattern:**

```swift
// contentfulEntryService is reader-owned: your app's CDA fetch and link resolution.
let entry = try await contentfulEntryService.fetchEntry(
    id: entryId,
    include: 10,
    // Resolve and pass one concrete CDA locale, not locale=* payloads.
    locale: appLocale
)

let result = client.resolveOptimizedEntry(
    baseline: entry,
    selectedOptimizations: client.selectedOptimizations
)

// Always render result.entry; it is the variant when one applies, or the
// baseline entry otherwise. contentView is reader-owned UI.
contentView.configure(with: result.entry)
```

`resolveOptimizedEntry` is synchronous and fail-soft: it never throws or breaks the UI. It returns
the baseline entry unchanged (with `selectedOptimization` and `optimizationContextId` nil) when the
client is not initialized, when the entry is not optimized, when no selected optimization matches,
when linked optimization data is missing, or when the selected variant is not present in the
payload. Passing `nil` for `selectedOptimizations` tells the resolver to use the SDK's current
selection state; passing an explicit snapshot resolves against exactly that (used for locked screens
in [Live updates and locked variants](#live-updates-and-locked-variants)). For deeper resolver
mechanics, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Screen and navigation tracking

**Integration category:** Required for first integration

The quick start tracked one screen. Real UIKit navigation repeats lifecycle callbacks across modal,
tab, and navigation-controller transitions, so choose the method that matches the event you want.

Use `trackCurrentScreen(name:properties:routeKey:)` for UIKit lifecycle and navigation tracking: it
deduplicates the current route in the SDK by `routeKey` (which defaults to `name`), so a repeat of
the same current screen is skipped and a blocked attempt is retried once consent allows. Use
`screen(name:properties:)` only for intentional one-off raw screen events, which carry no dedupe.

1. Emit from `viewDidAppear(_:)` so UIKit has completed the visible transition.
2. Use a stable screen name that maps to your analytics model.
3. Pass a stable `routeKey` when several instances of one destination should still count as the same
   current screen, or when the default name-based key would collide.
4. Add `properties` only when the downstream analysis needs them.

**Adapt this to your use case:**

```swift
override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    Task { @MainActor in
        // entryId is reader-owned: the value that identifies this destination.
        _ = try? await client.trackCurrentScreen(
            name: "ProductDetail",
            properties: ["entryId": entryId],
            // Stable route key prevents duplicate current-screen events when the
            // lifecycle callback repeats for the same destination.
            routeKey: "product-detail-\(entryId)"
        )
    }
}
```

For shared tracking mechanics and event delivery, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

### Entry interaction tracking

**Integration category:** Common but policy-dependent

UIKit does not automatically infer when a user tapped a Contentful entry or when an entry met a
visibility threshold, so your app owns the geometry and the app decides whether these events are
allowed by its Analytics and privacy policy. Entry views deliver on the wire as `component` events;
entry taps as `component_click`.

**Entry taps.** Build a `TrackingMetadata` (an SDK helper type that derives
`componentId`/`experienceId`/`variantIndex` from an entry and its selected optimization) from the
resolution you already rendered, then pass its fields to a `TrackClickPayload` (an SDK payload type).
Building the metadata from the stored resolution — not by re-resolving at tap time — makes the tap
carry the same optimization context that produced the rendered variant.

1. Resolve and render the entry, and store the `ResolvedOptimizedEntry` you rendered from.
2. On tap, build `TrackingMetadata` from the stored baseline entry and its `selectedOptimization`.
3. Call `client.trackClick(TrackClickPayload(...))` from a `UIControl` action or gesture recognizer.
   For gesture recognizers, gate the dispatch to the completed gesture state instead of suppressing
   later taps for the view's lifetime.

**Adapt this to your use case:**

```swift
// Reader-owned: your view or cell stores the resolution it rendered from.
private var latestBaselineEntry: [String: Any]?
private var latestResolution: ResolvedOptimizedEntry?

func configure(with entry: [String: Any]) {
    // entry is a reader-owned Contentful entry your app fetched.
    let result = client.resolveOptimizedEntry(
        baseline: entry,
        selectedOptimizations: client.selectedOptimizations
    )
    latestBaselineEntry = entry
    latestResolution = result
    contentView.configure(with: result.entry) // contentView is reader-owned UI.
}

@objc private func primaryButtonTapped() {
    guard let entry = latestBaselineEntry, let result = latestResolution else { return }

    // TrackingMetadata carries the optimization context that produced the
    // rendered variant, so the tap matches what the visitor actually saw.
    let metadata = TrackingMetadata(
        entry: entry,
        optimizationContextId: result.optimizationContextId,
        selectedOptimization: result.selectedOptimization
    )

    Task { @MainActor in
        try? await client.trackClick(TrackClickPayload(
            componentId: metadata.componentId,
            experienceId: metadata.experienceId,
            optimizationContextId: metadata.optimizationContextId,
            variantIndex: metadata.variantIndex
        ))
    }
}
```

**Entry views.** Feed app-owned scroll or layout geometry to a `ViewTrackingController` — the SDK's
imperative view-timing engine for UIKit — and it applies the same timing model and emits a
`TrackViewPayload` (an SDK payload type) through the client for you. The controller uses the default
model: an initial view event once the entry accumulates 2 seconds (`dwellTimeMs`) at 80% visibility
(`minVisibleRatio`), periodic duration updates every 5 seconds (`viewDurationUpdateIntervalMs`) while
visible, and a final duration event when visibility ends once at least one event has fired. It also
pauses on backgrounding and re-evaluates on foreground, and dedupes its own sticky views, so you only
own the geometry and the call site.

**Follow this pattern:**

```swift
final class OptimizedEntryView: UIView {
    private let client: OptimizationClient
    private let entry: [String: Any]
    private weak var scrollView: UIScrollView?
    private var trackingController: ViewTrackingController?
    private var offsetObservation: NSKeyValueObservation?

    // Call site: resolve the entry when the view is configured, then (re)build
    // the controller for that resolution — the same place you render the entry.
    func configure() {
        let result = client.resolveOptimizedEntry(baseline: entry)
        rebuildTracking(result: result)
        // ...render result.entry with your own view code...
    }

    // Rebuild the controller whenever a newly resolved variant changes the
    // tracking metadata, ending the previous visibility cycle first.
    private func rebuildTracking(result: ResolvedOptimizedEntry) {
        trackingController?.onDisappear()
        trackingController = ViewTrackingController(
            client: client,
            entry: entry,
            optimizationContextId: result.optimizationContextId,
            selectedOptimization: result.selectedOptimization
        )
        emitVisibility()
        // Call site: feed geometry on every scroll change so the controller can
        // run its timing model. Also call emitVisibility() on layout changes.
        offsetObservation = scrollView?.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in
            Task { @MainActor in self?.emitVisibility() }
        }
    }

    // Reader-owned geometry: your app computes the element's position and feeds
    // it to the controller, which owns timing, consent checks, and duplicate
    // duration-event prevention for the cycle.
    private func emitVisibility() {
        guard let controller = trackingController, let scrollView else { return }
        let frameInScroll = convert(bounds, to: scrollView)
        controller.updateVisibility(
            elementY: frameInScroll.minY,
            elementHeight: bounds.height,
            scrollY: scrollView.contentOffset.y,
            viewportHeight: scrollView.bounds.height
        )
    }
}
```

`ViewTrackingController` is the recommended path because it applies the SDK's visibility timing for
you. If your app already computes its own visibility and duration — or needs a single one-off view
event — call `client.trackView(TrackViewPayload(...))` directly instead of using the controller; it
is the lower-level `async throws` primitive the controller wraps, and you then own the timing the
controller would otherwise apply.

To opt an entry out of view or tap tracking, do not install its controller or gesture recognizer.
For shared tracking mechanics, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

### Identity, profile continuity, and reset

**Integration category:** Common but policy-dependent

Identity policy belongs to the application. The SDK can identify a visitor, update selected
optimizations and `changes` (the inline field and flag values the Experience API returned for the
visitor) from Experience API responses, persist profile-continuity state when allowed, and reset
SDK-managed profile state, but it does not decide when a user becomes known or how account data is
governed.

1. Call `identify(userId:traits:)` after sign-in or when the app has a stable application user ID.
2. Wait for SDK state or rendered content before assuming the profile has affected visible entries.
3. Call `reset()` on logout, account switch, or a privacy flow that must clear SDK-managed profile,
   selected-optimization, change, and anonymous-ID state.
4. Preserve or clear app-owned user identifiers according to your account and privacy policy; the SDK
   does not clear your application storage.

**Adapt this to your use case:**

```swift
Task { @MainActor in
    // identify links the app-owned user ID to the current mobile profile.
    _ = try? await client.identify(
        userId: user.id,
        traits: ["plan": user.plan]
    )
}
```

**Copy this:**

```swift
// reset() clears profile continuity but preserves consent state.
client.reset()
```

`reset()` clears profile continuity (profile, changes, selected optimizations, the anonymous ID, the
current-screen dedupe tracker, and sticky-view keys) but **preserves consent state**, and it no-ops
before initialization. When persistence consent is allowed, the SDK writes continuity to
`UserDefaults` and publishes SDK state from an Experience response after that write settles. In tests
and relaunch flows, wait for SDK-derived UI or state instead of adding arbitrary storage delays. The
SDK persists to `UserDefaults` under the `com.contentful.optimization.` prefix, not to cookies, and
provides no built-in cross-platform identity handoff — implement any web, server, or account
continuity in application code. For the identifier model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md#revocation-and-profile-cleanup).

## Optional integrations

### Custom events and analytics diagnostics

**Integration category:** Optional

Use custom events for business actions that are not tied to a Contentful entry swap, and the event
streams for local diagnostics or app-owned analytics forwarding.

1. Call `track(event:properties:)` for a business event.
2. Subscribe to `eventStream` for accepted events; subscribe to `blockedEventStream` (or configure
   `onEventBlocked` at startup) for events stopped by consent or the allow-list.
3. Subscribe before the events you want to observe fire — `eventStream` is a passthrough publisher
   that does not replay earlier events to late subscribers.

**Copy this:**

```swift
Task { @MainActor in
    // A custom business event, not tied to a Contentful entry swap.
    _ = try? await client.track(event: "Purchase Completed", properties: ["sku": "ABC-123"])
}
```

**Adapt this to your use case:**

```swift
// eventStream is a passthrough publisher with no replay: subscribe before the
// events you want to observe fire, or you miss the earlier ones.
client.eventStream
    .sink { event in analyticsDebugStore.append(event) }
    .store(in: &cancellables)

// blockedEventStream surfaces events stopped by consent or the allow-list —
// the diagnostic for a missing event during integration.
client.blockedEventStream
    .sink { blocked in print("blocked \(blocked.method): \(blocked.reason)") }
    .store(in: &cancellables)
```

When forwarding SDK events to third-party destinations, apply the same app-owned consent policy,
deduplication, and data-minimization rules that govern the destination. For destination mapping,
consent, identity, dedupe, and governance guidance, see
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Custom Flags and MergeTag rendering

**Integration category:** Optional

Use Custom Flags when your Optimization data includes profile-backed feature values, and merge tags
when it includes profile-driven text substitutions in Rich Text. Both read from SDK state
separately from entry-variant resolution.

1. Read a flag once with `getFlag(_:)` when a synchronous value is enough.
2. Subscribe with `flagPublisher(_:)` when the UI must update as flag values change.
3. Resolve merge tags with `getMergeTagValue(mergeTagEntry:)` from your app-owned Rich Text renderer.

**Copy this:**

```swift
// Non-reactive one-shot read; returns nil before init or when unresolved.
let flagValue = client.getFlag("show-promo")
```

**Adapt this to your use case:**

```swift
// Subscribing registers an observeFlag subscription. A flag subscription emits
// a component flag-view event (an analytics exposure) when consent and profile
// allow, so treat it as tracked exposure, not a free read, and govern it like
// any other event.
client.flagPublisher("show-promo")
    .receive(on: RunLoop.main)
    .sink { [weak self] value in self?.applyPromoFlag(value) }
    .store(in: &cancellables)
```

`nt_mergetag` is the SDK-fixed Optimization content type for a merge tag — a profile-driven text
substitution embedded inline in Rich Text; it is not a name you choose. Your app owns extracting the
embedded `nt_mergetag` entry from the Rich Text node before calling the SDK, which resolves the
selector against the current profile and returns the resolved string or `nil`.

**Follow this pattern:**

```swift
// mergeTagEntry is reader-owned: the expanded embedded-entry-inline node's
// data.target you extracted from Rich Text.
let resolved = client.getMergeTagValue(mergeTagEntry: mergeTagEntry)
// resolved is String?; fall back to the merge tag's configured value on nil.
```

For the deeper data model, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#merge-tags-and-localized-profile-values).

### Live updates and locked variants

**Integration category:** Optional

UIKit apps choose whether optimized content updates live or locks to the first selected variant for
the screen. There is no automatic locking in UIKit; you pick the policy by how you pass
`selectedOptimizations` and whether you redraw on state changes.

1. To lock a screen, capture `client.selectedOptimizations ?? []` once after the first resolution and
   pass that explicit snapshot to every `resolveOptimizedEntry` call on the screen. Do not pass `nil`
   for locked screens, because `nil` tells the resolver to use current SDK state.
2. To update live, pass `nil` (or the current `client.selectedOptimizations`) and subscribe to
   `client.$selectedOptimizations` to redraw affected views when selections change.
3. Treat `client.isPreviewPanelOpen` as a reason to redraw live: an open preview panel forces live
   updates so applied overrides appear immediately.

**Adapt this to your use case:**

```swift
private var lockedOptimizations: [[String: Any]] = []
private var hasLockedOptimizations = false

func lockVariantsForScreen() {
    guard !hasLockedOptimizations else { return }
    // Capture an explicit snapshot after the screen's first resolution.
    // Empty array locks to no selections; nil would ask for current SDK state.
    lockedOptimizations = client.selectedOptimizations ?? []
    hasLockedOptimizations = true
}

func render(entry: [String: Any]) {
    guard hasLockedOptimizations else { return }
    let result = client.resolveOptimizedEntry(
        baseline: entry,
        selectedOptimizations: lockedOptimizations
    )
    contentView.configure(with: result.entry)
}
```

**Adapt this to your use case:**

```swift
client.$selectedOptimizations
    // @Published fires in willSet, so hop to the next run-loop turn to read the
    // committed selections before re-resolving.
    .receive(on: RunLoop.main)
    .sink { [weak self] _ in
        guard self?.client.isPreviewPanelOpen == true || self?.liveUpdates == true else { return }
        self?.reloadVisibleContent()
    }
    .store(in: &cancellables)
```

For the precedence between live updates, locked variants, and preview-panel state, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

### Preview panel

**Integration category:** Optional

`PreviewPanelViewController` hosts the SDK preview panel from a UIKit view controller. Gate it behind
a debug or internal-build condition so production users cannot open local audience and variant
overrides.

1. Create a `PreviewContentfulClient` (the built-in `ContentfulHTTPPreviewClient` fetches
   `nt_audience` and `nt_experience` definitions) for the space and environment holding your
   Optimization entries.
2. Add the floating button to a host controller with `addFloatingButton(to:client:contentfulClient:)`,
   passing the same initialized `OptimizationClient` the rest of the app uses so overrides affect the
   same resolver and event state.
3. Keep the preview panel out of public production builds unless your release policy explicitly
   allows it for an internal audience.

**Adapt this to your use case:**

```swift
#if DEBUG
let previewContentfulClient = ContentfulHTTPPreviewClient(
    spaceId: "your-space-id",
    accessToken: "your-cda-token",
    environment: "main"
)

PreviewPanelViewController.addFloatingButton(
    to: homeViewController,
    // Pass the app-owned client so overrides affect the same resolver and state.
    client: client,
    contentfulClient: previewContentfulClient
)
#endif
```

Passing `contentfulClient` is what loads audience and experience definitions by name. Without it the
panel can still open, but no definitions are loaded: the audience section is empty, audience and
variant override controls are unavailable, and existing override summaries can fall back to raw
identifiers.

### Runtime locale changes

**Integration category:** Optional

Use this section when the app can change language or locale after SDK startup. The SDK locale and the
Contentful CDA locale are separate inputs, even when they usually carry the same value.

1. Derive the next app locale from your navigation, i18n, account, or settings layer.
2. Call `setLocale(_:)` to update the SDK Experience and event locale. It updates the SDK locale
   only — it does not refetch Contentful entries or refresh profile state — and it `throws` before
   init or on an invalid locale.
3. Refetch Contentful entries with the same locale and re-resolve visible entries once the localized
   payload and SDK state are both ready.
4. Invalidate app-owned content caches using locale-aware cache keys.

**Adapt this to your use case:**

```swift
let nextLocale = "de-DE"

// Updates the SDK Experience/event locale only; throws on an invalid locale.
try client.setLocale(nextLocale)

// Reader-owned refetch in the same locale, then re-resolve and redraw.
entries = try await contentfulEntryService.fetchEntries(
    ids: entryIds,
    include: 10,
    locale: nextLocale
)
reloadVisibleContent()
```

For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

## Advanced integrations

### Offline delivery, queue observability, and app-owned caching

**Integration category:** Advanced or production-only

The iOS SDK monitors network reachability, queues events while offline, flushes when connectivity
returns, and flushes as the app moves toward the background. No setup is required for the default
offline path: `NWPathMonitor` drives the SDK online state and flushes on reconnect, and the app
lifecycle handler flushes on `willResignActive`.

1. Add `QueuePolicy` only when production telemetry needs queue limits or lifecycle callbacks. The
   offline Experience queue holds up to 100 events by default (tunable via
   `QueuePolicy.offlineMaxEvents`); queues are in-memory only and do not survive process death.
2. Use queue callbacks for operational diagnostics, not for resending blocked or dropped events.
3. Keep Contentful entry caching in the application layer — the SDK does not cache CDA responses for
   UIKit rendering.
4. Call `flush()` only for deliberate release, test, or lifecycle flows; the SDK already flushes on
   background and reconnect.

**Adapt this to your use case:**

```swift
let config = OptimizationConfig(
    clientId: "your-optimization-client-id",
    queuePolicy: QueuePolicy(
        offlineMaxEvents: 500,
        onOfflineDrop: { event in
            // event is a QueueEvent with a type and a context dictionary.
            diagnostics.record("optimization-offline-drop", context: event.context)
        },
        onFlushFailure: { event in
            diagnostics.record("optimization-flush-failure", context: event.context)
        },
        onFlushRecovered: { event in
            diagnostics.record("optimization-flush-recovered", context: event.context)
        }
    )
)
```

## Production checks

Before release, verify the UIKit integration against these checks:

- **Credentials and runtime configuration** — The app uses the intended Optimization client ID,
  Contentful environment, SDK `locale`, and CDA locale. Non-default API base URLs and `.debug`
  logging are absent from production builds unless explicitly approved.
- **Consent behavior** — Startup consent, CMP wiring, refusal, withdrawal, split event and
  persistence consent, and `reset()` behavior match the app's legal and privacy requirements.
- **Event delivery** — Screen, custom, tap, view, identify, and flag-view events appear when allowed
  and are blocked or omitted when policy denies them.
- **Content fallback behavior** — Baseline entries render when selected optimizations are missing,
  unresolved links are returned, variants are out of range, or the visitor is not qualified.
- **Duplicate tracking prevention** — UIKit lifecycle hooks, reusable cells, gesture recognizers,
  and visibility observers do not emit duplicate screen, tap, or view events for one intended
  interaction or visibility cycle.
- **Privacy and governance** — Preview-panel access, event forwarding, profile IDs, user traits,
  app-owned caches, and diagnostics follow the app's data-minimization and retention policy.
- **Local validation path** — Compare your integration against the iOS reference implementation. The
  repository's maintainers validate UIKit behavior with an XCUITest suite driven from
  `implementations/ios-sdk/`; that runner is a maintainer command, not an app command.

  **Reference excerpt:**

  ```sh
  # From implementations/ios-sdk/ in the optimization monorepo — a maintainer
  # command that builds the JS bridge, starts the mock server, and runs XCUITest.
  APP_SHELL=uikit ./scripts/run-e2e.sh
  ```

## Troubleshooting

- **Optimized entries always render the baseline** — Confirm the app fetched a single-locale entry,
  requested enough `include` depth for `nt_experiences` and `nt_variants`, initialized the client,
  and has non-empty `client.selectedOptimizations` for the visitor.
- **Tap or view events do not appear** — Check consent, `allowedEventTypes`, the `componentId` from
  `TrackingMetadata`, UIKit gesture wiring, and whether the view reached the configured visibility
  threshold long enough to emit.
- **Screen events appear more than once** — Review `viewDidAppear(_:)` calls for modal, tab, and
  navigation-controller transitions, and prefer `trackCurrentScreen` with a stable `routeKey` over
  raw `screen` for lifecycle tracking.
- **Preview panel opens but shows identifiers** — Pass a `PreviewContentfulClient` that can fetch
  `nt_audience` and `nt_experience` entries from the correct space and environment.
- **Identified variants disappear after relaunch** — Verify persistence consent is `true`, wait for
  SDK-published profile or selected-optimization state before terminating tests, and confirm logout
  or withdrawal flows are not calling `reset()`.

## Reference implementations to compare against

- [iOS reference implementation](../../implementations/ios-sdk/README.md) — Maintained SwiftUI and
  UIKit shells that exercise the native iOS bridge against the shared mock API: accepted-consent
  startup, single-locale CDA fetching, entry resolution, screen tracking, interaction tracking,
  Custom Flags and merge tags, live updates, offline queueing, and preview-panel overrides. Use it as
  the comparison and validation target for UIKit integration behavior.
