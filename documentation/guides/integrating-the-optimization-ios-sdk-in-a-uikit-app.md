---
fern:
  slug: integrate-the-optimization-ios-sdk-in-a-uikit-app
  section: Guides
  description: >-
    Use this guide to add Contentful personalization to a UIKit app with the
    `ContentfulOptimization` Swift Package.
---

# Integrate the Optimization iOS SDK in a UIKit app

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
[Integrate the Optimization iOS SDK in a SwiftUI app](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)
guide. A UIKit app that hosts some screens in SwiftUI through `UIHostingController` can use that
guide's SwiftUI view surface on those screens with this same client: those views read the client from
the SwiftUI environment, so inject it with `.environmentObject(client)` on the hosted view rather
than wrapping the screen in `OptimizationRoot`, which creates and initializes a client of its own.

## Quick start

Most UIKit + Contentful apps share one shape: a `SceneDelegate` builds the window and a root view
controller, and a `UIViewController` presents content. This quick start assumes that shape and proves
the smallest result: **the SDK initializes in your scene and one screen event is accepted, and a
visible label flips to confirm it.** It owns one `OptimizationClient` in the scene, initializes it,
injects it into the first view controller, and tracks the current screen from `viewDidAppear(_:)`.

This quick start assumes your application policy permits Optimization to start with accepted consent
and renders no end-user consent UI, so it configures `StorageDefaults(consent: true)` — the shorthand
that accepts both consent axes at once. Read that as a startup default, not a one-time seed: a
configured value takes precedence over whatever is stored in `UserDefaults` on every launch, so a
shipped `consent: true` re-grants consent on each launch even after a user revoked it. If
personalization must wait for a consent decision, keep this structure and add the
[Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff) step before you ship, which
explains the two axes, the split form that sets them separately, and why an app that collects a
choice leaves `defaults` unset.

1. Add the `ContentfulOptimization` Swift Package to your app target from
   `https://github.com/contentful/optimization.swift` (in Xcode: **File > Add Package
   Dependencies**), then build and run the app target once on a simulator or a device so Swift
   Package Manager resolves and compiles the package. The package supports iOS 15+.

2. Own one client in your existing `SceneDelegate`, initialize it, and inject it into your first view
   controller. `initialize(config:)` is synchronous and `throws` — it loads the SDK's bridge and runs
   bridge setup inline on the main actor — so call it with `try` and no `await`. **The bridge** is the
   SDK's embedded JavaScript runtime: the iOS SDK runs the same Optimization core as the other SDKs in
   the suite inside a JavaScriptCore context, one per client. `clientId` is your Optimization client
   ID; [Before you start](#before-you-start) says where to find it in the Contentful web app.

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

   +        // Synchronous throws, not async: call with try and no await. Catching
   +        // and printing keeps a failed startup visible instead of silent.
   +        do {
   +            try client.initialize(config: OptimizationConfig(
   +                clientId: "your-optimization-client-id",
   +                // Startup default, not a one-time seed: this wins over a stored choice.
   +                defaults: StorageDefaults(consent: true),
   +                logLevel: .debug,
   +                onEventBlocked: { blocked in
   +                    // If the label reads "blocked", this prints why.
   +                    print("Optimization blocked \(blocked.method): \(blocked.reason)")
   +                }
   +            ))
   +        } catch {
   +            print("Optimization initialize failed: \(error)")
   +        }

   -        let home = HomeViewController()
   +        let home = HomeViewController(client: client)
            window = UIWindow(windowScene: windowScene)
            window?.rootViewController = UINavigationController(rootViewController: home)
            window?.makeKeyAndVisible()
        }
    }
   ```

   The unchanged lines above are illustrative context to match against your own `SceneDelegate`, not
   a block to paste over it. `StorageDefaults` is the SDK config type that holds the SDK's startup
   state, consent included; `StorageDefaults(consent: true)` sets both consent axes — event consent
   and persistence consent — as the startup default the SDK resolves before it reads a stored choice.

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

   **If your first screen comes from a storyboard**, do not paste the `init(coder:)` above: UIKit
   instantiates storyboard controllers through exactly that initializer, so the `fatalError` crashes
   the app on launch. Keep UIKit's initializer and take the client through a settable property that
   the scene delegate fills in after the storyboard has built the controller — or read it from an
   app-level dependency container the controller can reach on its own.

   **Adapt this to your use case:**

   ```swift
   final class HomeViewController: UIViewController {
       // Reader-owned injection point instead of an initializer parameter, so
       // UIKit's init(coder:) stays intact. viewDidAppear is the first read.
       var client: OptimizationClient!

       // ...viewDidLoad and viewDidAppear exactly as above...
   }

   // In SceneDelegate.scene(_:willConnectTo:), after the storyboard built the window:
   if let home = (window?.rootViewController as? UINavigationController)?
       .viewControllers.first as? HomeViewController
   {
       // Inject the one scene-owned client, not a new one.
       home.client = client
   }
   ```

4. Verify the first run. Launch the app on a simulator or a device; the label reads
   `Optimization screen event accepted`. `trackCurrentScreen` returns an `EventEmissionResult` — an
   SDK result type whose `accepted` flag is `true` when the event passed the SDK's local consent and
   allow-list gate and was emitted or queued for delivery. `accepted` does not confirm that Contentful
   received the event, only that the local gate let it through. Because
   `StorageDefaults(consent: true)` sets consent and `screen` is on the SDK's default pre-consent
   allow-list, the event is accepted.

**If the label reads `Optimization screen event blocked`,** the two `print` calls from step 2 name the
cause in the Xcode console. A line prefixed `Optimization blocked` means the consent gate rejected the
event and names the reason and method. A line prefixed `Optimization initialize failed` means the
client never initialized, so nothing reached the gate at all.
[Troubleshooting](#troubleshooting) covers what each branch usually is.

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
  iOS 15+.
- **Contentful delivery credentials** — space ID, delivery token, environment, and one concrete
  locale — read from your app's configuration layer.
- **A configured `contentful.swift` client** — Contentful's Swift delivery SDK, added to your app
  target and able to fetch one entry with a concrete locale. Every entry example below starts from a
  `Contentful.Entry` this client returned.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. In the Contentful web app the path depends on which navigation your organization uses: in
  **classic navigation**, go to **Apps → Installed apps → Contentful Personalization → SDK keys**; in
  **new navigation** (the Contentful app with ExO navigation enabled), go to **Platform/Apps →
  Installed apps → Contentful Personalization → SDK keys**. The client ID and environment are listed
  there.

  `OptimizationConfig.environment` defaults to `main`, so pass it only when your setup differs. That
  default belongs to `OptimizationConfig` alone: the preview panel's own Contentful client
  (`ContentfulHTTPPreviewClient`, in [Preview panel](#preview-panel)) defaults its `environment` to
  `master`, so pass yours explicitly there. The Experience API
  (which picks variants) and the Insights API (which receives event and interaction delivery) each
  have a base URL that defaults correctly; you only set them for mocks or non-default hosts (see
  [Package installation and SDK configuration](#package-installation-and-sdk-configuration)).

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

The quick start added the package through Xcode. What is new here is the SwiftPM-manifest form of the
same dependency, and the full `OptimizationConfig` surface behind the handful of keys the quick start
passed.

**Adapt this to your use case:**

```swift
dependencies: [
    .package(url: "https://github.com/contentful/optimization.swift", from: "<version>"),
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
setup. Only `clientId` is required by the initializer. An app builds one `OptimizationConfig` and
calls `initialize(config:)` once, in the scene or app startup the quick start edited; the config
snippets in later sections add keys to that same config rather than introducing a second one.

1. Pass `clientId` from your configuration layer.
2. Pass `environment` only when it is not the default `main`.
3. Pass `locale` when Experience API requests and event context must use the same language as the
   Contentful Delivery API (CDA) entries you render.
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
   controllers. For controllers UIKit instantiates itself — storyboard or nib scenes — use a settable
   property or an app-level dependency container the controller reads from, and keep UIKit's
   `init(coder:)` intact.
3. Return to the main actor before calling the client from asynchronous callbacks; `OptimizationClient`
   is `@MainActor`.
4. Gate UI on readiness when needed: the client publishes `isInitialized`, so observe
   `client.$isInitialized` when a screen must wait for setup before it reads SDK state.

`OptimizationClient` is an `ObservableObject`, and its reactive values are Combine publishers reached
through the `$` prefix: `client.isInitialized` is the current `Bool`, while `client.$isInitialized` is
the publisher that emits when it changes. Subscribing needs `import Combine` and somewhere to keep the
subscription alive — a `Set<AnyCancellable>` property, conventionally called `cancellables`, that lives
as long as the object doing the subscribing. Every Combine snippet later in this guide assumes a bag
like the one below on whichever object subscribes.

**Adapt this to your use case:**

```swift
import Combine
import ContentfulOptimization
import UIKit

final class ProductViewController: UIViewController {
    private let client: OptimizationClient
    // Keeps every Combine subscription in this controller alive.
    private var cancellables = Set<AnyCancellable>()

    // Inject the app-owned client instead of creating a new one here.
    init(client: OptimizationClient) {
        self.client = client
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Readiness gate: $isInitialized is the publisher behind isInitialized.
        client.$isInitialized
            .sink { [weak self] isReady in self?.setContentHidden(!isReady) }
            .store(in: &cancellables)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { @MainActor in
            // Hop back to the main actor before any client call.
            _ = try? await client.trackCurrentScreen(name: "ProductList")
        }
    }
}
```

`setContentHidden(_:)` is reader-owned: your own method for showing a placeholder until the SDK is
ready.

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
   at launch, and only when no stored user choice can contradict it.
2. Leave `defaults` unset when the app must collect a choice before gated events can emit, and call
   `consent(...)` from the app-owned banner, CMP callback, or settings flow.
3. Use `consent(_:)` for the boolean shorthand that sets both axes, or `consent(events:persistence:)`
   to set them independently.
4. Pass `allowedEventTypes: []` for strict opt-in, so no SDK event emits before event consent.
5. Observe `client.$state` when the UI must reflect event consent or persistence consent.

`StorageDefaults` values are startup defaults, not one-time seeds. At every launch, `initialize`
resolves the configured values over what is persisted in `UserDefaults`, so a configured `consent` or
`persistenceConsent` replaces a stored user choice on that launch and every launch after it. An app
that ships `StorageDefaults(consent: true)` therefore re-grants consent a user revoked, silently. That
is the reason step 2 above matters: when your app collects a choice, leave `defaults` unset so the
stored decision is what the SDK starts from, and let `consent(...)` carry your resolved policy.

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
screen analytics. Before consent, that list is the whole admission rule: entry views, entry taps,
custom `track` events, and `page` events (the page-view event the SDK shares with the web SDKs; UIKit
apps track screens instead) are blocked because they are absent from it, not because consent is
undecided. Accepting event consent admits every type at once. A custom `allowedEventTypes` replaces the
default list, so a type you add there emits with no consent decision at all, and
`allowedEventTypes: []` blocks every SDK event until consent is accepted. `consent(false)` clears both
axes, purges queues, and clears durable continuity while in-memory state stays usable until reset or
teardown.

**Adapt this to your use case:**

```swift
// The same config the scene initializes with, plus one key.
let config = OptimizationConfig(
    clientId: "your-optimization-client-id",
    // Replaces the default pre-consent allow-list of identify and screen with
    // strict opt-in: nothing emits until consent is accepted.
    allowedEventTypes: []
)
```

`client.state` is a snapshot value of type `OptimizationState`, and `client.$state` is the publisher
behind it. Consent lives on that snapshot rather than on the client itself: read `state.consent` and
`state.persistenceConsent` (each an optional `Bool`, where `nil` means the visitor has not decided
yet), plus `state.profile` and `state.changes` — the flag and inline field values the Experience API
returned for this visitor — when the UI reflects profile-driven values. The client's
own published properties are a different set — `isInitialized`, `selectedOptimizations`, `locale`,
`isPreviewPanelOpen`, `previewState` — so subscribe to `client.$state` for consent and to
`client.$selectedOptimizations` for selections, not to one for both.

**Adapt this to your use case:**

```swift
client.$state
    // Consent is a field on the state snapshot, so this is the subscription a
    // consent banner or privacy screen observes.
    .sink { [weak self] state in
        self?.updateConsentUI(
            eventConsent: state.consent,
            persistenceConsent: state.persistenceConsent
        )
    }
    .store(in: &cancellables)
```

`updateConsentUI(eventConsent:persistenceConsent:)` is reader-owned, and `cancellables` is the
subscription bag from
[Client lifetime and UIKit injection](#client-lifetime-and-uikit-injection).

For the full consent responsibility model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful fetching and entry resolution

**Integration category:** Required for first integration

This is where personalization happens. The iOS SDK has no native managed fetch path: your app fetches
the entry as it already does and hands the fetched entry to `resolveOptimizedEntry`, which swaps in the
selected variant locally, synchronously, for the current visitor. Start from the call itself, then read
what it returns.

The client is `@MainActor`, so resolution belongs on a main-actor type — a `UIView`, a
`UIViewController`, or a cell. Resolve where you configure content, so a re-configured view resolves
again. One returned field the call site branches on right away: `isEmptyVariant`, which is `true` when
the visitor's selection is an **empty variant** — an authored variant with no content, meaning "show
nothing here". The paragraphs after the snippet cover the rest of the result.

**Adapt this to your use case:**

```swift
import Contentful
import ContentfulOptimization
import UIKit

@MainActor
final class ArticleCardView: UIView {
    // Injected app-owned client; see Client lifetime and UIKit injection.
    private let client: OptimizationClient
    private let contentView = CardContentView() // Reader-owned UI.

    // entry is the Contentful.Entry your app fetched for this card.
    func configure(with entry: Contentful.Entry) {
        let result = client.resolveOptimizedEntry(
            baseline: entry,
            selectedOptimizations: client.selectedOptimizations
        )

        // An empty variant means "show nothing here for this visitor".
        contentView.isHidden = result.isEmptyVariant
        guard !result.isEmptyVariant else { return }

        // Content type IDs and field names below are your content model's.
        switch result.entry.contentTypeId {
        case "hero" where result.entry.hasField("headline"):
            let headline: String? = result.entry.getField("headline")
            contentView.showHero(headline: headline)
        case "cta" where result.entry.hasField("label"):
            let label: String? = result.entry.getField("label")
            contentView.showCTA(label: label)
        default:
            contentView.showUnsupportedContent()
        }
    }
}
```

1. Fetch one entry with one concrete locale, either by its entry ID or by a route slug. Pass that
   fetched entry to resolution — never the ID or the slug. Do not pass all-locale payloads (`locale=*`
   or all-locale helpers): the resolver cannot read locale-keyed field maps, so those fall back to
   baseline.
2. Include linked entries deeply enough to resolve the optimization links. `nt_experiences` (plural)
   is the SDK-fixed link field the SDK reads on an optimized entry; it links that entry's
   `nt_experience` (singular) experiences, and each experience links its `nt_variants` and
   `nt_audience` entries. These are SDK-owned Optimization content-model names, not names you choose;
   your fetch must `include` deeply enough to pull them back in one payload. `include: 10` is the
   reference implementation's pattern.
3. Keep the app's Contentful locale aligned with SDK `locale` when rendered content and events must
   use the same language.
4. Resolve entries during view, cell, or wrapper configuration.
5. Branch on `result.entry.contentTypeId`, check `hasField(...)`, and then read the matching field
   with `getField(...)`.
6. Use `result.selectedOptimization` and `result.optimizationContextId` only when building tracking
   payloads.

Both lookups are ordinary `contentful.swift` queries through the Contentful client your app already
owns. The slug form filters on content type and the slug field as exact equalities and asks for two
items, so a duplicate slug is something you can detect rather than silently resolve: return the entry
only for exactly one item, send zero items through your not-found path, and treat more than one as an
authoring or configuration error. Replace `page` and `slug` with your content type and slug-field IDs.
The SDK never performs this request or reads these lookup values.

`fetchArray` reports through a completion handler, so one continuation makes it awaitable and lets the
call site handle a fetch failure instead of dropping it.

Together the two snippets are the whole path, and it is worth reading in one direction: the view
controller fetches a **baseline** entry, hands it to `cardView.configure(with:)`, and that method — the
`ArticleCardView` above — calls `resolveOptimizedEntry`, which swaps in the visitor's selected variant
locally and synchronously before anything renders. Nothing in the fetch is personalized; the entry that
comes back from Contentful is the same for every visitor. Resolution is the only step that differs per
visitor, which is why it belongs in view configuration rather than in the fetch: a re-configured or
reused cell resolves again against the current `selectedOptimizations`, while a cached fetch stays
valid. The view controller owns the `OptimizationClient` it injected into the card, so both objects
resolve against the same client state.

**Adapt this to your use case:**

```swift
import Contentful
import ContentfulOptimization
import UIKit

// One entry by its Contentful entry ID.
func entryIdQuery(_ entryId: String, locale: String) -> Query {
    Query.where(sys: .id, .equals(entryId))
        .include(10)
        // One concrete locale; an all-locale response falls back to baseline.
        .localizeResults(withLocaleCode: locale)
}

// Or one entry by route slug, for routes that carry a public slug.
func slugQuery(_ routeSlug: String, locale: String) -> Query {
    Query.where(contentTypeId: "page")
        .where(field: "slug", .equals(routeSlug))
        .include(10)
        .localizeResults(withLocaleCode: locale)
        // Two, so a duplicate slug is detectable instead of silently resolved.
        .limit(to: 2)
}

@MainActor
final class ArticleViewController: UIViewController {
    // Both clients are app-owned and injected; see Client lifetime and UIKit injection.
    private let client: OptimizationClient
    private let contentfulClient: Contentful.Client
    private let appLocale: String
    // The view from the snippet above. It holds the same OptimizationClient, and its
    // configure(with:) is the only place resolution happens.
    private let cardView: ArticleCardView

    func loadCard(slug: String) async {
        do {
            let items = try await fetchEntries(matching: slugQuery(slug, locale: appLocale))
            switch items.count {
            case 1:
                // Hand the baseline entry to the card. configure(with:) calls
                // resolveOptimizedEntry, so the variant swap happens inside this line.
                cardView.configure(with: items[0])
            case 0:
                showNotFound() // Reader-owned not-found path.
            default:
                // More than one match is an authoring or configuration error.
                reportAmbiguousSlug(slug)
            }
        } catch {
            reportFetchFailure(error) // Reader-owned error path.
        }
    }

    // fetchArray reports through a completion handler; one continuation makes it awaitable.
    private func fetchEntries(matching query: Query) async throws -> [Contentful.Entry] {
        let response: HomogeneousArrayResponse<Contentful.Entry> =
            try await withCheckedThrowingContinuation { continuation in
                contentfulClient.fetchArray(of: Contentful.Entry.self, matching: query) { result in
                    continuation.resume(with: result)
                }
            }
        return response.items
    }
}
```

Now the values the call returns. `client.selectedOptimizations` (plural) is the SDK's current set of
selected optimizations — one selection per experience the visitor's profile matched, published on the
client and updated from Experience API responses. `resolveOptimizedEntry(baseline:selectedOptimizations:)`
returns a `ResolvedOptimizedEntry` — an SDK result type that wraps the resolved `entry`, the single
`selectedOptimization` (singular) that was applied to it, and an `optimizationContextId` identifying
the optimization context, the profile-and-selection state that produced the variant. Note the
one-letter difference: `selectedOptimizations` is the set you pass in (or the SDK resolves against),
while `selectedOptimization` is the one selection returned on the result. Passing `nil` for
`selectedOptimizations` uses current client state; an explicit snapshot locks resolution to that
selection (see [Live updates and locked variants](#live-updates-and-locked-variants)).

On an empty variant the result still hands back the baseline `entry`. That is there so interaction
tracking keeps its context, not for you to render — UIKit does no hiding for you, which is why the
snippet checks `result.isEmptyVariant` before touching its content. The SDK sets the flag only for a
literal boolean `true`; an absent, false, or otherwise invalid value renders normally.

`ResolvedOptimizedEntry.entry` is the SDK-owned `CTEntry` wrapper around the resolved entry. A selected
linked variant can use any Contentful content type, and `contentTypeId` identifies that type without
validating its fields — which is why the pattern is branch on `contentTypeId`, confirm the field with
`hasField(...)`, then read it with `getField(...)`.

`resolveOptimizedEntry` is synchronous and fail-soft: it never throws or breaks the UI. Two different
situations hand back the baseline, and they differ in what metadata comes with it:

- **A client-side failure** — the client is not initialized, the baseline cannot be serialized, or the
  bridge result cannot be parsed — returns the baseline entry unchanged with `selectedOptimization` and
  `optimizationContextId` nil, and logs a warning.
- **A resolver-side fallback** — no matching selection, unresolved `nt_experiences` or `nt_variants`
  links, an all-locale payload, or a selection that points at the baseline instead of a variant — also
  returns the baseline, but it can arrive **with** selected-optimization metadata attached. Treat
  non-nil metadata as "the resolver had a selection for this entry", not as proof that a variant
  replaced it.

That distinction is what [Entry interaction tracking](#entry-interaction-tracking) builds on when it
derives a `TrackingMetadata` from `result.selectedOptimization`. For the shared resolution and fallback
rules, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#fallback-behavior).

[Before you start](#before-you-start) assumes you already have a `contentful.swift` client. If you do
not, construct one from your space ID, environment, and Delivery API token — the queries above run
through it:

**Adapt this to your use case:**

```swift
import Contentful

let contentfulClient = Client(
    spaceId: "<your-space-id>",
    environmentId: "<your-environment-id>",
    accessToken: "<your-delivery-api-token>"
)
```

### Screen and navigation tracking

**Integration category:** Required for first integration

The quick start tracked one screen. Real UIKit navigation repeats lifecycle callbacks across modal,
tab, and navigation-controller transitions, so choose the method that matches the event you want.

`trackCurrentScreen(name:properties:routeKey:)` and `screen(name:properties:)` both emit the same
underlying screen event and return the same result shape; the difference is dedupe.
`trackCurrentScreen` deduplicates the current route in the SDK by `routeKey` (which defaults to
`name`), so a repeat of the same current screen from a repeated `viewDidAppear(_:)` is skipped, and a
blocked attempt is retried once consent allows. Plain `screen(name:properties:)` re-emits on every
call with no dedupe — call it directly only when your app wants that: an intentional one-off event,
or navigation tracking where every appearance should count as a fresh screen event rather than
deduping repeats of the same route.

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
        // entryId comes from your route or Contentful lookup; when it is a Contentful entry ID, use the opaque ID.
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

1. Resolve and render the entry, and store both it and the `ResolvedOptimizedEntry` you rendered from.
2. On tap, build `TrackingMetadata` from the stored entry and the resolution's `selectedOptimization`.
3. Call `client.trackClick(TrackClickPayload(...))` from a `UIControl` action or gesture recognizer.
   For gesture recognizers, gate the dispatch to the completed gesture state instead of suppressing
   later taps for the view's lifetime.

Keep the fetched `Contentful.Entry` and the resolution it produced side by side, both typed.
`TrackingMetadata` takes the baseline as a dictionary rather than a typed entry, and reads exactly one
value out of it: `sys.id`, which becomes `componentId`. The experience, variant index, and sticky flag
all come from `selectedOptimization`. Encode with `CTEntry` at that call and nowhere else — the
dictionary is what one SDK initializer accepts, not a shape to store in your own view, which stays
typed. Both stored properties and both methods below belong to the same view, cell, or view controller
that resolved the entry.

**Adapt this to your use case:**

```swift
// Reader-owned: your view or cell stores the entry and resolution it rendered,
// both typed.
private var latestBaselineEntry: Contentful.Entry?
private var latestResolution: ResolvedOptimizedEntry?

func configure(with entry: Contentful.Entry) {
    let result = client.resolveOptimizedEntry(
        baseline: entry,
        selectedOptimizations: client.selectedOptimizations
    )
    latestBaselineEntry = entry
    latestResolution = result
    contentView.isHidden = result.isEmptyVariant
    guard !result.isEmptyVariant else { return }
    contentView.configure(with: result.entry) // contentView is reader-owned UI.
}

@objc private func primaryButtonTapped() {
    guard let entry = latestBaselineEntry, let result = latestResolution else { return }

    // TrackingMetadata carries the optimization context that produced the
    // rendered variant, so the tap matches what the visitor actually saw. The
    // CTEntry encode stays at this boundary, so the view keeps a typed entry.
    let metadata = TrackingMetadata(
        entry: CTEntry(entry).toDictionary(),
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
model: an initial view event once the entry has accumulated a cumulative 2 seconds (`dwellTimeMs`) at
or above 80% visibility (`minVisibleRatio`) — visible time adds up, so scrolling away and back does not
restart the count — periodic duration updates every 5 seconds (`viewDurationUpdateIntervalMs`) while
visible, and a final duration event when visibility ends, once at least one event has fired. It also
pauses on backgrounding and re-evaluates on foreground, and dedupes its own sticky views, so you own
the geometry and the call sites.

Those call sites are the part a UIKit app is responsible for, and there are three: geometry updates
while the entry is on screen, a rebuild when a new resolution changes the tracking metadata, and
`onDisappear()` when the entry leaves the screen. Skip the last one and the visibility cycle never
closes, so the final duration event never fires — and a reused cell keeps reporting the previous
entry's cycle. `contentHost` is a reader-owned container: the class's omitted initializer and layout
code must add it with `addSubview(contentHost)` and size or constrain it before `configure()` runs; the
SDK does not create or mount that container. `ViewTrackingController` and `TrackingMetadata` read the
baseline entry in dictionary form — they have no typed-entry initializer — so a typed `Contentful.Entry`
is encoded once with `CTEntry` and that one dictionary is reused for every rebuild.

**Follow this pattern:**

```swift
final class OptimizedEntryView: UIView {
    private let client: OptimizationClient
    private let contentHost = UIView()
    private let entry: Contentful.Entry
    // ViewTrackingController takes the baseline as a dictionary, so the typed
    // entry is encoded once here and reused for every rebuild.
    private lazy var entryDictionary: [String: Any] = CTEntry(entry).toDictionary()
    private weak var scrollView: UIScrollView?
    private var trackingController: ViewTrackingController?
    private var offsetObservation: NSKeyValueObservation?

    // Call site 1: resolve the entry when the view is configured, then (re)build
    // the controller for that resolution — the same place you render the entry.
    func configure() {
        let result = client.resolveOptimizedEntry(baseline: entry)
        rebuildTracking(result: result)
        contentHost.isHidden = result.isEmptyVariant
        if !result.isEmptyVariant {
            // ...render result.entry inside contentHost with your own view code...
        }
    }

    // Rebuild the controller whenever a newly resolved variant changes the
    // tracking metadata, ending the previous visibility cycle first.
    private func rebuildTracking(result: ResolvedOptimizedEntry) {
        trackingController?.onDisappear()
        trackingController = ViewTrackingController(
            client: client,
            entry: entryDictionary,
            optimizationContextId: result.optimizationContextId,
            selectedOptimization: result.selectedOptimization
        )
        observeScrollOffset()
        emitVisibility()
    }

    // Call site 2: feed geometry on every scroll change and every layout pass so
    // the controller can run its timing model.
    private func observeScrollOffset() {
        offsetObservation?.invalidate()
        offsetObservation = scrollView?.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in
            Task { @MainActor in self?.emitVisibility() }
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        emitVisibility()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil else { return }
        observeScrollOffset()
        emitVisibility()
    }

    // Call site 3: end the cycle when the entry leaves the screen, and stop
    // observing with it. A reusable cell runs the same teardown from
    // prepareForReuse().
    override func willMove(toWindow newWindow: UIWindow?) {
        super.willMove(toWindow: newWindow)
        guard newWindow == nil else { return }
        trackingController?.onDisappear()
        offsetObservation?.invalidate()
        offsetObservation = nil
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
current-screen dedupe tracker, and sticky-view keys) and any preview-panel overrides currently applied,
but **preserves consent state**, and it no-ops before initialization. When persistence consent is allowed, the SDK writes continuity to
`UserDefaults` before publishing SDK state from an Experience response. In tests and relaunch flows,
wait for SDK-derived UI or state instead of adding arbitrary storage delays. The SDK persists to
`UserDefaults` under the `com.contentful.optimization.` prefix, not to cookies, and provides no
built-in cross-platform identity handoff — implement any web, server, or account continuity in
application code. For the identifier model, see
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

Both streams are Combine publishers, so they need `import Combine` and the `cancellables` bag from
[Client lifetime and UIKit injection](#client-lifetime-and-uikit-injection) on whichever object
subscribes.

**Adapt this to your use case:**

```swift
// eventStream is a passthrough publisher with no replay: subscribe before the
// events you want to observe fire, or you miss the earlier ones.
client.eventStream
    // analyticsDebugStore is reader-owned: your own diagnostic sink.
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
[Forward Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Custom Flags and MergeTag rendering

**Integration category:** Optional

A **Custom Flag** is a named value an experience personalizes instead of swapping a whole entry — a
badge label, a discount percentage, a boolean that turns a section on. The Experience API returns the
visitor's values as the `changes` on SDK state, and `getFlag(_:)` reads one of them by name. That name
is not one you invent: it must match the flag authored in your Optimization data, the way
`"show-promo"` does below. Merge tags are the Rich Text counterpart: profile-driven text substitutions
inside a Rich Text field. Both read from SDK state separately from entry-variant resolution.

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
    // applyPromoFlag(_:) is reader-owned: your own UI update for the value.
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
// resolved is String?; nil means neither the profile value nor the merge tag's
// own configured fallback field resolved.
```

The resolver already falls back to the merge tag's configured fallback field, so `nil` means neither
the profile value nor that fallback resolved. Substituting your own placeholder text on `nil` is
defensive rendering, not a required step.

For the deeper data model, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#merge-tags-and-localized-profile-values).

### Live updates and locked variants

**Integration category:** Optional

Live updates in UIKit exist, and they are entirely app-driven. There is no view wrapper and no
automatic mechanism: when the SDK publishes new selections, nothing on screen changes until your code
resolves again and redraws. Both options in this section are therefore policies you implement — lock a
screen to the selections its first render used, or subscribe and redraw — and you choose between them
by what you pass for `selectedOptimizations` and whether you subscribe at all.

1. To lock a screen, capture `client.selectedOptimizations ?? []` at the screen's first resolution and
   pass that explicit snapshot to every `resolveOptimizedEntry` call on the screen. Do not pass `nil`
   for locked screens, because `nil` tells the resolver to use current SDK state.
2. To update live, pass `nil` (or the current `client.selectedOptimizations`) and subscribe to
   `client.$selectedOptimizations` to redraw affected views when selections change.
3. Decide what an open preview panel means for your screens. Nothing forces live updates in UIKit, so
   overrides applied in the panel appear only if you redraw: subscribe to `client.$isPreviewPanelOpen`
   and `client.$previewState` alongside `$selectedOptimizations`, and treat an open panel as a reason to
   re-resolve even on an otherwise locked screen.

**Adapt this to your use case:**

```swift
// nil until this screen has resolved once; an explicit snapshot afterwards.
private var lockedOptimizations: [[String: Any]]?

// Call site: every render on this screen goes through here — the first one from
// viewDidLoad or cell configuration, and every later redraw.
func render(entry: Contentful.Entry) {
    // The first render is what locks. Empty array locks to no selections; nil
    // would keep asking for current SDK state on every later render.
    if lockedOptimizations == nil {
        lockedOptimizations = client.selectedOptimizations ?? []
    }

    let result = client.resolveOptimizedEntry(
        baseline: entry,
        selectedOptimizations: lockedOptimizations
    )
    contentView.isHidden = result.isEmptyVariant
    guard !result.isEmptyVariant else { return }
    contentView.configure(with: result.entry)
}
```

Locking on the first render keeps the screen from waiting on a separate locking step. Selections come
from an Experience API response, though, so the first render can happen before any selection exists —
which locks the screen to none. The SwiftUI view surface handles this by locking on the first non-nil
value instead; in UIKit that decision is yours: to match it, set `lockedOptimizations` back to `nil` and
render again when a `$selectedOptimizations` subscription delivers the first non-nil value.

**Adapt this to your use case:**

```swift
client.$selectedOptimizations
    // @Published fires in willSet, so hop to the next run-loop turn to read the
    // committed selections before re-resolving.
    .receive(on: RunLoop.main)
    .sink { [weak self] _ in
        // liveUpdates and reloadVisibleContent() are reader-owned: your screen's
        // own policy flag and its redraw.
        guard self?.client.isPreviewPanelOpen == true || self?.liveUpdates == true else { return }
        self?.reloadVisibleContent()
    }
    .store(in: &cancellables)
```

`cancellables` is again the subscription bag from
[Client lifetime and UIKit injection](#client-lifetime-and-uikit-injection), so this subscription needs
`import Combine` on the file that holds it.

For the precedence between live updates, locked variants, and preview-panel state, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

### Preview panel

**Integration category:** Optional

`PreviewPanelViewController` hosts the SDK preview panel from a UIKit view controller. Gate it behind
a debug or internal-build condition so production users cannot open local audience and variant
overrides.

1. Supply a Contentful client for the space and environment holding your Optimization entries. Pass
   an existing `contentful.swift` `Contentful.Client` directly and the SDK wraps it for you, or use
   the built-in `ContentfulHTTPPreviewClient` when the app has no Contentful client to share. Either
   one fetches the `nt_audience` and `nt_experience` definitions.
2. Add the floating button to a host controller with `addFloatingButton(to:client:contentfulClient:)`,
   passing the same initialized `OptimizationClient` the rest of the app uses so overrides affect the
   same resolver and event state.
3. Keep the preview panel out of public production builds unless your release policy explicitly
   allows it for an internal audience.

The button attaches to a view controller that already exists, so the natural place for this is where
the scene builds its root controller — the same `SceneDelegate` method the quick start edited, where
both the client and the host controller are in scope.

**Adapt this to your use case:**

```swift
func scene(
    _ scene: UIScene,
    willConnectTo _: UISceneSession,
    options _: UIScene.ConnectionOptions
) {
    // ...window and root controller setup from the quick start...

    #if DEBUG
    let previewContentfulClient = ContentfulHTTPPreviewClient(
        spaceId: "your-space-id",
        accessToken: "your-cda-token",
        // Defaults to "master" on this client, so pass yours explicitly.
        environment: "main"
    )

    PreviewPanelViewController.addFloatingButton(
        to: home,
        // Pass the app-owned client so overrides affect the same resolver and state.
        client: client,
        contentfulClient: previewContentfulClient
    )
    #endif
}
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
// Called from your language picker or settings screen. The refetch is async, so
// the whole sequence lives in one async method (or a Task) on that controller.
@MainActor
func applyLocale(_ nextLocale: String) async {
    do {
        // Updates the SDK Experience/event locale only; throws on an invalid locale.
        try client.setLocale(nextLocale)

        // Reader-owned refetch in the same locale, then re-resolve and redraw.
        entries = try await contentfulEntryService.fetchEntries(
            ids: entryIds,
            include: 10,
            locale: nextLocale
        )
        reloadVisibleContent()
    } catch {
        // Reader-owned: keep the previous locale's content on screen.
        reportLocaleChangeFailure(error)
    }
}
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
// Again the one config the scene initializes with, plus one key.
let config = OptimizationConfig(
    clientId: "your-optimization-client-id",
    queuePolicy: QueuePolicy(
        offlineMaxEvents: 500,
        onOfflineDrop: { event in
            // event is a QueueEvent with a type and a context dictionary;
            // diagnostics is reader-owned: your own operational logging.
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
  unresolved links are returned, variants are out of range, or the visitor is not qualified. Every
  supported resolved content type maps to a renderer; a variant content type that differs from the
  baseline is rendered as that variant, not treated as fallback.
- **Duplicate tracking prevention** — UIKit lifecycle hooks, reusable cells, gesture recognizers,
  and visibility observers do not emit duplicate screen, tap, or view events for one intended
  interaction or visibility cycle.
- **Privacy and governance** — Preview-panel access, event forwarding, profile IDs, user traits,
  app-owned caches, and diagnostics follow the app's data-minimization and retention policy.
- **Confirm in Live Events** — in addition to local log and status checks, open the target Contentful
  space and environment's Live Events view in the Contentful web app, trigger a real flow from the app
  (a screen view, an entry view or tap, an `identify()` call, or a custom `track()` call), and confirm
  the corresponding event arrives with the expected wire type (`identify`, `screen`, `component`,
  `component_click`, or `track`) and payload fields.
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

- **The build fails with `No such module 'ContentfulOptimization'`** — Confirm the package is added to
  the app target's dependencies (the product is named `ContentfulOptimization`), build the app target
  once so Swift Package Manager resolves and compiles it, and confirm the target's minimum deployment
  version is iOS 15 or later. If `import Contentful` is what fails to resolve, add `contentful.swift` to
  the app target as well.
- **The app crashes on launch with `init(coder:) is not supported`** — A storyboard or nib is
  instantiating a view controller whose `init(coder:)` was replaced by the constructor-injection form.
  Keep UIKit's `init(coder:)`, take the client through a settable property or an app-level dependency
  container, and set it before the view appears.
- **The quick-start label reads `Optimization screen event blocked`** — Two causes. If the consent gate
  rejected the event, `onEventBlocked` prints a line prefixed `Optimization blocked` naming the reason
  and method, so search the Xcode console for that prefix, then check consent and `allowedEventTypes`.
  If the client never initialized, the caught error prints instead, and the SDK's `logLevel: .debug`
  output under the `com.contentful.optimization` subsystem shows the failed init. `initialize` throws a
  `configError` for an invalid `locale` and a `resourceLoadError` when the packaged bridge resource
  cannot be loaded, so the printed error names which of the two you hit.
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
