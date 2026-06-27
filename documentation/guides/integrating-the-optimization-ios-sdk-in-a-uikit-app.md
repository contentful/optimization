# Integrating the Optimization iOS SDK in a UIKit app

Use this guide when you want to add Optimization, Analytics, screen tracking, entry interaction
tracking, and preview overrides to a UIKit application using the `ContentfulOptimization` Swift
Package.

Use the SwiftUI guide instead when your app renders optimized entries through SwiftUI views:
[Integrating the Optimization iOS SDK in a SwiftUI app](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md).

## Quick start

This path proves the SDK can initialize in a UIKit scene and emit one screen event. It assumes
application policy permits accepted SDK startup. If your app must wait for a CMP or consent UI,
leave `defaults` unset and wire consent in the [consent handoff](#consent-handoff) section. Strict
opt-in apps must also pass `allowedEventTypes: []` before enabling gated events.

1. Add the `ContentfulOptimization` Swift Package from
   `https://github.com/contentful/optimization.swift` to the app target.
2. Create one `OptimizationClient` for the scene or app lifetime.
3. Initialize the client with the Optimization client ID, Contentful environment, and accepted
   startup consent.
4. Track the current screen from `viewDidAppear(_:)`.
5. Verify the visible label changes to `Optimization screen event accepted`.

**Copy this:**

```swift
import ContentfulOptimization
import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    // Own one SDK client for the scene or app lifetime, then inject this same
    // instance into UIKit controllers that resolve entries or track events.
    private let client = OptimizationClient()

    func scene(
        _ scene: UIScene,
        willConnectTo _: UISceneSession,
        options _: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        try? client.initialize(config: OptimizationConfig(
            clientId: "your-client-id",
            environment: "main",
            // Use accepted startup only when your app's consent policy permits
            // SDK event emission before showing a consent UI.
            defaults: StorageDefaults(consent: true)
        ))

        let home = HomeViewController(client: client)
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = UINavigationController(rootViewController: home)
        window?.makeKeyAndVisible()
    }
}

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
            // Track the current screen after UIKit has made it visible, so
            // verification matches a real navigation lifecycle and repeated
            // callbacks are deduplicated by the SDK.
            let result = try? await client.trackCurrentScreen(name: "Home")
            if result?.accepted == true {
                statusLabel.text = "Optimization screen event accepted"
            } else {
                statusLabel.text = "Optimization screen event blocked"
            }
        }
    }
}
```

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [Package installation and SDK configuration](#package-installation-and-sdk-configuration)
  - [Client lifetime and UIKit injection](#client-lifetime-and-uikit-injection)
  - [Consent handoff](#consent-handoff)
  - [Contentful fetching and entry resolution](#contentful-fetching-and-entry-resolution)
  - [Screen, custom event, and entry tracking](#screen-custom-event-and-entry-tracking)
  - [Identity, profile continuity, and reset](#identity-profile-continuity-and-reset)
- [Optional integrations](#optional-integrations)
  - [Live updates and locked variants](#live-updates-and-locked-variants)
  - [Preview panel](#preview-panel)
  - [Custom Flags and debug event streams](#custom-flags-and-debug-event-streams)
  - [Runtime locale changes](#runtime-locale-changes)
- [Advanced integrations](#advanced-integrations)
  - [Offline delivery, queue observability, and app-owned caching](#offline-delivery-queue-observability-and-app-owned-caching)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Required setup

Use this setup inventory for the full UIKit guide:

| Setup item                                                                 | Category                       | Required for quick start | Where to configure                                                         |
| -------------------------------------------------------------------------- | ------------------------------ | ------------------------ | -------------------------------------------------------------------------- |
| `ContentfulOptimization` Swift Package                                     | Required for first integration | Yes                      | Xcode Swift Package Manager or the app target's `Package.swift`            |
| Optimization client ID and Contentful environment                          | Required for first integration | Yes                      | `OptimizationConfig(clientId:environment:)`                                |
| App-owned Contentful Delivery API client, credentials, and concrete locale | Required for first integration | No                       | Application Contentful service or repository layer                         |
| Single-locale Contentful entry payloads with linked optimization entries   | Required for first integration | No                       | CDA or CPA requests with `include` depth and a non-wildcard `locale`       |
| Scene or app coordinator that owns one `OptimizationClient`                | Required for first integration | Yes                      | `SceneDelegate`, `AppDelegate`, or an app-level dependency container       |
| UIKit view, cell, or wrapper that resolves entries before rendering        | Required for first integration | No                       | `UIViewController`, `UITableViewCell`, `UICollectionViewCell`, or `UIView` |
| Consent and privacy startup policy                                         | Common but policy-dependent    | Conditional              | `StorageDefaults`, app consent UI, CMP callback, or account preference     |
| Pre-consent event allow-list                                               | Common but policy-dependent    | Conditional              | `OptimizationConfig.allowedEventTypes`                                     |
| Screen lifecycle hook                                                      | Required for first integration | Yes                      | `viewDidAppear(_:)`, navigation coordinator, or app router                 |
| Route-key naming for duplicate screen prevention                           | Common but policy-dependent    | No                       | `trackCurrentScreen(name:properties:routeKey:)` or app router              |
| Entry tap and view-tracking metadata                                       | Common but policy-dependent    | Conditional              | UIKit control actions, gesture recognizers, scroll-view geometry, or cells |
| Identity and profile-continuity policy                                     | Common but policy-dependent    | No                       | Sign-in, account, consent, and reset flows                                 |
| Custom Flag reads and analytics debug streams                              | Optional                       | No                       | Feature surfaces, debug views, or app analytics forwarding layer           |
| Preview-panel Contentful client and internal access gate                   | Optional                       | No                       | Debug or internal-build preview setup                                      |
| Queue policy, offline diagnostics, and app-owned content cache policy      | Advanced or production-only    | No                       | `OptimizationConfig(queuePolicy:)`, app telemetry, and content cache code  |

The SDK does not replace the app's Contentful client. Your UIKit app still owns Contentful fetching,
link resolution, consent UX, identity policy, navigation, caching, and rendering.

## Core integration

### Package installation and SDK configuration

**Integration category:** Required for first integration

Add the package from `https://github.com/contentful/optimization.swift`, then initialize the SDK
with the Optimization client ID and the environment that matches your Contentful setup. The package
requires iOS 15 or later.

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
],
```

1. Add the `ContentfulOptimization` product to the app target.
2. Choose the app's Contentful locale, such as `"en-US"`.
3. Pass that same locale to SDK `locale` when Experience API requests and event context need to use
   the same language as the rendered Contentful entries.
4. Keep `logLevel` at its default `.error` for production unless your operational policy explicitly
   allows more verbose logging.

**Copy this:**

```swift
let appLocale = "en-US"

let config = OptimizationConfig(
    clientId: "your-client-id",
    environment: "main",
    // Keep SDK event and Experience locale aligned with rendered CDA entries
    // when the screen uses localized Contentful content.
    locale: appLocale
)
```

Only `clientId` is required by the initializer. `environment` defaults to `"main"`, and `locale` is
omitted unless you pass it. Use API base URL overrides only for mock, test, or non-default API
endpoints. For package-level installation notes, see the
[Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md).

### Client lifetime and UIKit injection

**Integration category:** Required for first integration

UIKit integrations use `OptimizationClient` directly. Keep one initialized client alive for the
scene or app lifetime, then inject that instance into every controller or view that resolves entries
or tracks events.

1. Create the client in `SceneDelegate`, `AppDelegate`, or an app-level dependency container.
2. Call `initialize(config:)` before presenting content that uses Optimization.
3. Pass the initialized client through initializers instead of creating separate clients in child
   controllers.
4. Return to the main actor before calling the client from asynchronous callbacks.
   `OptimizationClient` is `@MainActor`.

**Adapt this to your use case:**

```swift
import ContentfulOptimization
import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    // Keep this initialized client alive across UIKit navigation.
    private let client = OptimizationClient()

    func scene(
        _ scene: UIScene,
        willConnectTo _: UISceneSession,
        options _: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // Initialize before presenting screens that resolve entries or track events.
        try? client.initialize(config: config)

        let root = HomeViewController(client: client)
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = UINavigationController(rootViewController: root)
        window?.makeKeyAndVisible()
    }
}
```

Use `destroy()` for test teardown or a deliberate SDK teardown flow, not for normal navigation
between UIKit screens. For lifecycle and main-actor mechanics, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-main-actor).

### Consent handoff

**Integration category:** Common but policy-dependent

Consent policy remains application-owned. The SDK provides the runtime gate; your app or CMP owns
notice, user choices, consent records, jurisdiction logic, and withdrawal behavior.

1. Use default-on accepted startup only when application policy permits SDK activity at launch.
2. Leave `defaults` unset when the app must collect a choice before gated Analytics events can emit.
3. Pass `allowedEventTypes: []` when strict opt-in policy means no Optimization event can emit
   before consent.
4. Call `client.consent(true)` or `client.consent(false)` from the app's consent controls.
5. Use split consent when event emission and durable profile continuity have separate policy
   decisions.
6. Observe `client.$state` when the UI needs to reflect event consent or persistence consent.

**Copy this:**

```swift
let config = OptimizationConfig(
    clientId: "your-client-id",
    // Accepted startup consent enables gated Analytics events immediately.
    defaults: StorageDefaults(consent: true)
)
```

**Copy this:**

```swift
let config = OptimizationConfig(
    clientId: "your-client-id",
    // Replaces the native default pre-consent allow-list of identify and screen.
    allowedEventTypes: []
)
```

**Adapt this to your use case:**

```swift
@objc private func acceptTapped() {
    // Wire this to the app-owned consent UI or CMP callback.
    client.consent(true)
}

@objc private func rejectTapped() {
    client.consent(false)
}

@objc private func allowEventsOnlyTapped() {
    client.consent(events: true, persistence: false)
}
```

Boolean consent controls both event emission and durable profile-continuity persistence by default.
When `allowedEventTypes` is unset, the native default allow-list lets `identify` and `screen` emit
before consent so a mobile journey can establish profile context and anonymous screen analytics.
Custom `allowedEventTypes` replaces that default, and `allowedEventTypes: []` blocks every SDK event
until consent is accepted. For the full consent responsibility model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful fetching and entry resolution

**Integration category:** Required for first integration

The SDK resolves entries locally after your app has fetched Contentful data and the SDK has selected
optimizations for the visitor.

1. Fetch entries with one concrete Contentful locale. Do not pass all-locale payloads from
   `locale=*` or all-locale SDK helpers into entry resolution.
2. Include linked entries deeply enough for `fields.nt_experiences`, the referenced optimization
   entries, and `fields.nt_variants` to be present as resolved dictionaries.
3. Keep the app's Contentful locale aligned with SDK `locale` when rendered content and events need
   to use the same locale.
4. Resolve entries during view, cell, or wrapper configuration.
5. Render `result.entry`. Use `result.selectedOptimization` and `result.optimizationContextId` only
   when building tracking payloads.

**Follow this pattern:**

```swift
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

// Always render result.entry; it falls back to the baseline entry when no
// selected optimization can be applied.
contentView.configure(with: result.entry)
```

`resolveOptimizedEntry(baseline:selectedOptimizations:)` is synchronous and fail-soft. It returns
the baseline entry when no selected optimization matches, when the entry is not optimized, when the
linked optimization data is missing, or when the selected variant is not present in the Contentful
payload. For deeper resolver mechanics, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md).

### Screen, custom event, and entry tracking

**Integration category:** Common but policy-dependent

UIKit apps decide when a screen is visible, when a user interacted with a Contentful entry, and when
an entry has met the app's visibility threshold.

#### Screen events

1. Emit screen events from `viewDidAppear(_:)` for screens that represent navigation destinations.
2. Use a stable screen name that maps to your analytics model.
3. Add properties only when the downstream analysis needs them.
4. Guard duplicate emissions when a UIKit lifecycle callback fires more often than the event model
   expects.

Use `trackCurrentScreen(name:properties:routeKey:)` for UIKit lifecycle and navigation tracking
because it deduplicates the current route. Use `screen(name:properties:)` only for intentional
one-off raw screen events.

**Copy this:**

```swift
override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)

    Task { @MainActor in
        // Emit from viewDidAppear so UIKit has completed the visible transition.
        _ = try? await client.trackCurrentScreen(
            name: "ProductDetail",
            properties: ["entryId": entryId],
            // Use a stable route key to prevent duplicate current-screen events
            // when UIKit lifecycle callbacks repeat for the same destination.
            routeKey: "product-detail-\(entryId)"
        )
    }
}
```

#### Custom events

Use custom events for business actions that are not tied to a Contentful entry replacement.

**Copy this:**

```swift
Task { @MainActor in
    // This event is useful for local verification through eventStream or the
    // iOS reference app event display.
    _ = try? await client.track(
        event: "Purchase Completed",
        properties: ["sku": sku]
    )
}
```

#### Entry taps

1. Resolve the entry before rendering.
2. Store the most recent `ResolvedOptimizedEntry` produced during render or view configuration.
3. Build tracking metadata from the baseline entry and the selected optimization returned by the
   stored resolution, not by re-resolving at tap time.
4. Call `client.trackClick(TrackClickPayload(...))` from a `UIControl` action or gesture recognizer.
   For gesture recognizers, gate the dispatch to the completed gesture state instead of suppressing
   later taps for the view lifetime.

**Adapt this to your use case:**

```swift
private var latestBaselineEntry: [String: Any]?
private var latestResolution: ResolvedOptimizedEntry?

func configure(entry: [String: Any]) {
    let result = client.resolveOptimizedEntry(
        baseline: entry,
        selectedOptimizations: client.selectedOptimizations
    )

    latestBaselineEntry = entry
    latestResolution = result
    contentView.configure(with: result.entry)
}

@objc private func primaryCTATapped() {
    guard let entry = latestBaselineEntry, let result = latestResolution else { return }

    // Use the same optimization context that produced the rendered variant.
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

#### Entry views

UIKit does not automatically infer component visibility. Use app-owned scroll-view, table-view, or
collection-view geometry and either call `client.trackView(TrackViewPayload(...))` directly or use
`ViewTrackingController` to apply the SDK's visibility timing model.

**Follow this pattern:**

```swift
final class OptimizedEntryView: UIView {
    private let client: OptimizationClient
    private let entry: [String: Any]
    private weak var scrollView: UIScrollView?
    private var trackingController: ViewTrackingController?

    private func rebuildTracking(result: ResolvedOptimizedEntry) {
        // End the previous visibility cycle before replacing tracking metadata
        // for a newly resolved variant.
        trackingController?.onDisappear()
        trackingController = ViewTrackingController(
            client: client,
            entry: entry,
            optimizationContextId: result.optimizationContextId,
            selectedOptimization: result.selectedOptimization
        )
    }

    private func emitVisibility() {
        guard let controller = trackingController, let scrollView else { return }

        let frameInScroll = convert(bounds, to: scrollView)
        // UIKit owns geometry; the SDK controller owns timing, consent checks,
        // and duplicate duration-event prevention for this visibility cycle.
        controller.updateVisibility(
            elementY: frameInScroll.minY,
            elementHeight: bounds.height,
            scrollY: scrollView.contentOffset.y,
            viewportHeight: scrollView.bounds.height
        )
    }
}
```

`ViewTrackingController` uses the same default model documented for the iOS SDK: an initial view
event after 2 seconds at 80% visibility, periodic duration updates every 5 seconds while visible,
and a final duration update after the entry leaves view once a view event has emitted. For shared
tracking mechanics and event delivery, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

### Identity, profile continuity, and reset

**Integration category:** Common but policy-dependent

Identity policy belongs to the application. The SDK can identify a visitor, update selected
optimizations from Experience API responses, persist profile-continuity state when allowed, and
reset SDK-managed profile state.

1. Call `identify(userId:traits:)` after sign-in or when the app has a stable application user ID.
2. Wait for SDK state, rendered content, or app-owned loading state before assuming the profile has
   affected visible entries.
3. Call `reset()` when the app's logout or privacy flow must clear SDK-managed profile,
   selected-optimization, change, and anonymous ID state.
4. Preserve or clear app-owned user identifiers according to your account and privacy policy. The
   SDK does not clear your application storage.

**Copy this:**

```swift
Task { @MainActor in
    _ = try? await client.identify(
        userId: user.id,
        traits: ["plan": user.plan]
    )
}
```

**Copy this:**

```swift
client.reset()
```

When durable profile-continuity persistence is allowed, SDK state from an Experience response is
published after the corresponding `UserDefaults` write settles. In tests and relaunch flows, wait
for SDK-derived UI or state instead of adding arbitrary storage delays.

## Optional integrations

### Live updates and locked variants

**Integration category:** Optional

UIKit apps choose whether optimized content updates live or locks to the first selected variant for
the screen.

1. Use locked variants when content must not change while a visitor is reading a screen.
2. After the first screen or identity state that the screen locks to has resolved, capture
   `client.selectedOptimizations ?? []` and set a separate `hasLockedOptimizations` flag.
3. Pass that explicit snapshot to every `resolveOptimizedEntry` call on the locked screen. Do not
   pass `nil` for locked screens because `nil` tells the resolver to use current SDK state.
4. Use live updates when a debug surface, preview flow, or dynamic screen needs to redraw after
   profile or override changes.
5. Subscribe to `client.$selectedOptimizations` and redraw affected views for live behavior.
6. Treat `client.isPreviewPanelOpen` as a reason to redraw live while previewing.

**Adapt this to your use case:**

```swift
private var lockedOptimizations: [[String: Any]] = []
private var hasLockedOptimizations = false

func lockVariantsForScreen() {
    guard !hasLockedOptimizations else { return }

    // Call this after the screen or identity event this screen locks to
    // has resolved.
    // Capture an explicit screen-level snapshot. Empty array means lock to no
    // selected variants; nil asks the resolver to use current SDK state.
    lockedOptimizations = client.selectedOptimizations ?? []
    hasLockedOptimizations = true
}

func handleScreenEventResolved(entry: [String: Any]) {
    lockVariantsForScreen()
    render(entry: entry)
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
    .receive(on: RunLoop.main)
    .sink { [weak self] _ in
        guard self?.client.isPreviewPanelOpen == true || self?.liveUpdates == true else {
            return
        }

        self?.reloadVisibleContent()
    }
    .store(in: &cancellables)
```

For the precedence between live updates, locked variants, and preview-panel state, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

### Preview panel

**Integration category:** Optional

`PreviewPanelViewController` hosts the SDK preview panel from a UIKit navigation stack. Gate it
behind a debug or internal-build condition so production users cannot open local audience and
variant overrides.

1. Create or reuse a `PreviewContentfulClient` that can fetch `nt_audience` and `nt_experience`
   entries.
2. Add the floating button to a host controller, or present `PreviewPanelViewController` yourself.
3. Pass the same initialized `OptimizationClient` used by the rest of the app.
4. Pass a `PreviewContentfulClient` when the panel needs audience and experience override controls.
5. Keep the preview panel out of public production builds unless your release policy explicitly
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
    // Pass the app-owned SDK instance so preview overrides affect the same
    // resolver and event state used by the screen.
    client: client,
    contentfulClient: previewContentfulClient
)
#endif
```

Passing `contentfulClient` is optional only for profile and debug state. Without it, the panel can
still open, but no audience or experience definitions are loaded: the audience section is empty,
audience and variant override controls are unavailable, and existing override summaries can fall
back to identifiers.

### Custom Flags and debug event streams

**Integration category:** Optional

Use Custom Flags when your Contentful optimization data includes inline variable changes rather than
entry replacement. Use event streams for local diagnostics, app-owned debug views, or governed
analytics forwarding.

1. Read a flag once with `getFlag(_:)` when a synchronous value is enough.
2. Subscribe with `flagPublisher(_:)` when the UI needs to update as the SDK receives changed flag
   values.
3. Subscribe to `eventStream` only for diagnostics or application-owned forwarding that has passed
   consent and destination governance review.
4. Subscribe to `blockedEventStream`, or configure `onEventBlocked` at startup, to debug consent or
   pre-consent allow-list blocks during integration.

**Copy this:**

```swift
let flagValue = client.getFlag("boolean")
```

**Adapt this to your use case:**

```swift
client.flagPublisher("boolean")
    .receive(on: RunLoop.main)
    .sink { [weak self] value in
        self?.applyBooleanFlag(value)
    }
    .store(in: &cancellables)
```

**Adapt this to your use case:**

```swift
client.eventStream
    .sink { event in
        analyticsDebugStore.append(event)
    }
    .store(in: &cancellables)
```

When forwarding SDK events to third-party destinations, apply the same app-owned consent policy,
deduplication, and data-minimization rules that govern the destination.

Use `EventEmissionResult`, queue callbacks, logs, and app-owned diagnostics for other guard or
suppression cases.

### Runtime locale changes

**Integration category:** Optional

Use this section when the app can change language or locale after SDK startup. The SDK locale and
the Contentful CDA locale are separate inputs, even when they usually carry the same value.

1. Derive the next app locale from the app's navigation, i18n, account, or settings layer.
2. Call `setLocale(_:)` to update the SDK Experience/event locale.
3. Refetch Contentful entries with the same app locale when rendered content needs to change.
4. Invalidate app-owned content caches using locale-aware cache keys.
5. Re-resolve visible entries after the localized Contentful payload and SDK state are both ready.

**Adapt this to your use case:**

```swift
let nextLocale = "de-DE"

try client.setLocale(nextLocale)
entries = try await contentfulEntryService.fetchEntries(
    ids: entryIds,
    include: 10,
    // Refetch CDA content in the same locale used for SDK event context.
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
offline path.

1. Add `QueuePolicy` only when production telemetry needs queue limits or queue lifecycle callbacks.
2. Use queue callbacks for operational diagnostics, not for resending blocked or dropped events.
3. Keep Contentful entry caching in the application layer. The SDK does not cache CDA responses for
   UIKit rendering.
4. Treat hybrid server-client continuity as not applicable to a native UIKit-only app. Use SDK
   profile continuity plus app-owned account state instead.
5. Call `flush()` only for deliberate release, test, or lifecycle flows. The SDK already flushes on
   background and reconnect events.

**Adapt this to your use case:**

```swift
let config = OptimizationConfig(
    clientId: "your-client-id",
    queuePolicy: QueuePolicy(
        offlineMaxEvents: 500,
        onOfflineDrop: { event in
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

- **Credentials and runtime configuration** - The app uses the intended Optimization client ID,
  Contentful environment, SDK `locale`, and CDA locale. Non-default API base URLs and `.debug`
  logging are absent from production builds unless explicitly approved.
- **Consent behavior** - Default-on startup, CMP wiring, refusal, withdrawal, split event and
  persistence consent, and `reset()` behavior match the app's legal and privacy requirements.
- **Event delivery** - Screen, custom, tap, view, identify, and flag-view events appear when allowed
  and are blocked or omitted when policy denies them.
- **Content fallback behavior** - Baseline entries render when selected optimizations are missing,
  unresolved links are returned, variants are out of range, or the user is not qualified.
- **Duplicate tracking prevention** - UIKit lifecycle hooks, reusable cells, gesture recognizers,
  and visibility observers do not emit duplicate screen, tap, or view events for one intended
  interaction or visibility cycle.
- **Privacy and governance** - Preview-panel access, event forwarding, profile IDs, user traits,
  app-owned caches, and diagnostics follow the app's data-minimization and retention policy.
- **Local validation path** - Compare the app against the iOS reference implementation, or run the
  UIKit XCUITest flow with the mock server when changing native integration behavior:
  `APP_SHELL=uikit ./scripts/run-e2e.sh` from `implementations/ios-sdk/`.

## Troubleshooting

- **Optimized entries always render the baseline** - Confirm the app fetched a single-locale entry,
  requested enough `include` depth for `nt_experiences` and `nt_variants`, initialized the client,
  and has non-empty `client.selectedOptimizations` for the visitor.
- **Tap or view events do not appear** - Check consent, `allowedEventTypes`, the component ID from
  `TrackingMetadata`, UIKit gesture wiring, and whether the view reached the configured visibility
  threshold long enough to emit.
- **Screen events appear more than once** - Review `viewDidAppear(_:)` calls for modal, tab, and
  navigation-controller transitions, then add route-key or app-level guards that match your
  analytics model.
- **Preview panel opens but shows identifiers** - Pass a `PreviewContentfulClient` that can fetch
  audience and experience entries from the correct space and environment.
- **Identified variants disappear after relaunch** - Verify persistence consent is `true`, wait for
  SDK-published profile or selected-optimization state before terminating tests, and confirm logout
  or withdrawal flows are not calling `reset()`.

## Reference implementations to compare against

- [iOS reference implementation](../../implementations/ios-sdk/README.md) - Demonstrates SwiftUI and
  UIKit shells that exercise the native iOS bridge, default accepted consent, single-locale CDA
  fetching, entry resolution, interaction tracking, screen tracking, Custom Flags, offline queueing,
  and preview-panel overrides against the same mock API.
