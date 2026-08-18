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
  entries. This is shippable on its own once its consent posture matches your policy: the quick start
  starts with consent already accepted, and the
  [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff) section replaces that
  shortcut with an app-owned decision.
- **Milestone 2 — the opt-in layers (later).** Consent handoff, interaction tracking, identity,
  Custom Flags, live updates, the preview panel, strict event policy, and offline delivery, each
  introduced by the section that needs it.

This guide uses the `ContentfulOptimization` Swift Package. You mount one `OptimizationRoot` around
the SwiftUI tree that uses SDK views; it creates and initializes the SDK client, restores state from
`UserDefaults`, and provides it to the components and modifiers below it. Your app still owns its
Contentful entry fetching, consent policy, identity policy, navigation, and final rendering. If your
app is UIKit-based, use
[the UIKit iOS integration guide](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md) instead.

There is one SDK behind both guides, so a mixed app can mix surfaces: a UIKit app that hosts some
screens in SwiftUI through `UIHostingController` can use the SwiftUI views on those hosted screens,
because they read one `OptimizationClient` from the SwiftUI environment. Provide the hosted root with
the client the app already created (`.environmentObject(client)`) rather than mounting a second
`OptimizationRoot` per hosted screen, and follow the UIKit guide for the rest of the app.

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
shorthand that accepts both consent axes at once. Treat that line as a temporary shortcut for the
first run: a configured `StorageDefaults` value is a startup default the SDK applies on **every**
launch, taking precedence over whatever consent is stored on the device, so shipping it would keep
re-accepting consent for a visitor who declined. If personalization must wait for a consent decision,
keep this structure and replace that line before you ship as described in
[Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff), which explains the two
axes, the split form that sets them separately, and why an app that collects a choice leaves
`defaults` unset.

1. Add the `ContentfulOptimization` Swift Package. In Xcode, choose **File → Add Package
   Dependencies** and enter the package URL `https://github.com/contentful/optimization.swift`. If
   your app is defined by a `Package.swift` manifest, add the dependency and product there instead
   and set a real version for `from:`.

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
   ]
   ```

   There is no `pod install` step for a Swift Package. After adding the package, build and run the
   app on a simulator (**Product → Run**, or ⌘R) so the SDK's bundled JavaScript runtime resource is
   linked into the build.

   That resource is the SDK's optimization core — the same core the other Optimization SDKs run,
   shipped with the package as a JavaScript bundle. It executes inside a JavaScriptCore context the SDK
   client owns, and the Swift API you call is a thin native layer over it. The SDK's logs call that
   Swift-to-JavaScript boundary **the bridge**; you never call it yourself, but step 3 has you read its
   log lines.

2. Wrap your app root in `OptimizationRoot`, pass your Optimization client ID — the value from your
   Optimization project settings, listed under [Before you start](#before-you-start) — set
   `logLevel: .debug` so the SDK logs its activity, and add `.trackScreen(name:)` to one screen you
   already render.

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
   +                    // Startup consent default, reapplied every launch; the Consent section replaces it.
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
  the app layer and pass each fetched single-locale `Contentful.Entry` to `OptimizedEntry` or
  `resolveOptimizedEntry(...)`. The SDK targets iOS 15+; it ships as a Swift Package with
  no `pod install` step, so you add it in Xcode (or `Package.swift`) and run a normal build on a
  simulator.
- **Contentful delivery credentials** — space ID, delivery token, and environment — read from your
  app's runtime configuration and used by your own Contentful fetching layer.
- **A configured `contentful.swift` client** that already fetches at least one entry with a concrete
  locale. That is the client this guide's fetch examples extend; the SDK ships an adapter for the
  `Contentful.Entry` values it returns, so those entries go straight into the SDK's typed entry APIs.
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

  The Experience API (which picks variants) and the Insights API (which receives event and
  interaction delivery) each have a base URL that defaults correctly; you set them only for mocks or
  non-default hosts (see [Install and initialize the SwiftUI root](#install-and-initialize-the-swiftui-root)).

Everything else — consent, entry resolution, screen tracking, interaction tracking, identity, live
updates, preview, offline delivery — is introduced by the section that needs it.

> [!NOTE]
>
> Read the SDK and Contentful config from your app's runtime configuration. This guide's examples use
> inline placeholder strings for clarity; the reference implementation reads its values from shared
> app configuration because it runs against shared mock defaults. Use whatever configuration
> convention your iOS app already uses and keep it consistent.

## Core integration

### Install and initialize the SwiftUI root

**Integration category:** Required for first integration

You wrapped your app root in `OptimizationRoot` in the quick start, so this section adds only what the
quick start left out: the `environment` and `locale` values, `api` endpoint overrides, and how a view
below the root reaches the client. The quick start's `defaults` and `logLevel` lines stay as they
were — the [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff) section is what
replaces `defaults`, and you lower `logLevel` when you stop needing the console output.

`OptimizationRoot` is the normal SwiftUI entry point: it owns one
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
                    // Still the quick start's startup consent; the Consent section replaces it.
                    defaults: StorageDefaults(consent: true),
                    // Keep .debug while integrating, then lower it for release builds.
                    logLevel: .debug
                )
            ) {
                RootView()
            }
        }
    }
}

struct SDKLocaleLabel: View {
    // Descendant views read the client OptimizationRoot created and initialized.
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        // locale is @Published, so this view updates when the app calls setLocale.
        Text(client.locale ?? "no SDK locale set")
    }
}
```

`logLevel` defaults to `.error`; `.debug` and `.log` also enable remote JavaScript inspection in
debug builds. `OptimizationClient` methods that emit events are `async` and called from tasks or
event handlers — [Custom events and analytics diagnostics](#custom-events-and-analytics-diagnostics)
shows that shape. For lifecycle details, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-main-actor).
For package status and installation options, see
[the Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md).

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

Consent policy stays application-owned. Consent has two independent axes: **event consent** (may the
SDK personalize and emit events) and **persistence consent** (may the SDK store profile continuity in
`UserDefaults`). The boolean call `client.consent(_:)` sets both at once; the split call
`client.consent(events:persistence:)` sets them independently. `StorageDefaults(consent: true)`
accepts both axes at startup — use it only when application policy permits Optimization by default and
you render no consent UI.

`StorageDefaults` values are startup defaults, not one-time seeds. A configured value takes precedence
over the value stored in `UserDefaults` on **every** launch, so a configured `consent: true` keeps
re-accepting consent for a visitor who declined on an earlier launch: the stored choice never wins
against it. That is the reason for the rule below — an app that collects its own consent decision
leaves `StorageDefaults.consent` (and `persistenceConsent`) unset, and calls `client.consent(...)`
from resolved app policy instead, so the SDK reflects only what the app passes.

1. Set `StorageDefaults(consent: true)` only when policy permits default-on Optimization and no
   consent UI is shown.
2. Otherwise leave consent unset and call `client.consent(true)` after the visitor accepts,
   `client.consent(false)` after they reject.
3. Use the split form when events are allowed but durable profile continuity must stay session-only.
4. Read `client.state.consent` and `client.state.persistenceConsent` when consent UI must reflect SDK
   state. `client.state.consent` is tri-state — `true`, `false`, or `nil` when the visitor has not
   decided yet — so gate the banner on `client.state.consent == nil` to show it only until a choice is
   made.

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

struct ConsentGate<Content: View>: View {
    @EnvironmentObject private var client: OptimizationClient
    @ViewBuilder var content: () -> Content

    var body: some View {
        // consent is nil until the visitor decides; show the banner only while undecided.
        if client.state.consent == nil {
            ConsentBanner()
        } else {
            content()
        }
    }
}
```

**Copy this:**

```swift
// Allows events but keeps profile continuity session-only.
client.consent(events: true, persistence: false)
```

Before event consent is accepted, `allowedEventTypes` is the whole admission rule, and the native
default allows `identify` and `screen`. Every type absent from that list is blocked: entry-view events
(delivered as `component`), tap events (`component_click`), custom `track` events, and `page` events —
the page-view event the SDK shares with the web SDKs, which SwiftUI apps replace with `screen`.
Accepting event consent admits every type at once; adding a type to `allowedEventTypes` admits that one
type with no consent decision at all. `client.consent(false)` clears event and persistence consent,
purges queued events, and clears durable profile continuity, while in-memory state stays usable until
reset or teardown. To block every SDK event before consent — including `identify` and `screen` — set
`allowedEventTypes: []`; see
[Strict event policy and endpoint controls](#strict-event-policy-and-endpoint-controls). For the
cross-SDK consent model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful entry fetching and locale shape

**Integration category:** Required for first integration

The iOS SDK does not fetch managed Contentful entries for your application UI. Fetching remains in
your app regardless of how the route identifies an entry. If the app already has a Contentful entry
ID, keep its existing single-entry ID request. If a route carries a public slug, the app can query by
content type and slug instead. Either way you pass the fetched `Contentful.Entry` to `OptimizedEntry`
or `client.resolveOptimizedEntry(...)` — never the ID or the slug, which the native SDK does not read.
The only thing the SDK fetches for itself is the preview panel's own audience and experience
definitions.

Two properties of that fetch decide whether personalization can work at all, and both fail quietly:

- **Exactly one concrete locale.** The resolver reads direct field values, so an all-locale response
  (the delivery API's `locale=*` mode) falls back to baseline even though the request succeeded and the
  entry looks complete.
- **Enough `include` depth.** `nt_experiences` is the SDK-owned link field the resolver reads on an
  optimized entry; it links that entry's `nt_experience` entries, and each experience links its
  `nt_variants` (and `nt_audience`). These are fixed Optimization content-model identifiers you do not
  choose. Fetch deep enough to pull all of them back in one payload — the reference implementation uses
  a depth of 10. `nt_config` is a JSON field on the experience, not a link, so it needs no extra depth.
  If a link is missing from the payload, resolution falls back to baseline.

The SDK Experience/event `locale` is distinct from the Contentful delivery locale: your app chooses the
delivery locale for its own fetch, and `OptimizationConfig(locale:)` sets the locale the Experience API
and events use. Keep them aligned when rendered content and Experience responses must match.

1. Choose the application Contentful locale in your app's navigation, i18n, or account layer.
2. Pass the same locale to `OptimizationConfig(locale:)` when Experience responses and event context
   must align with rendered content.
3. Fetch by entry ID, or by content type and slug when the route supplies one, and pass the one fetched
   entry to native resolution.
4. When the app locale changes, call `client.setLocale(...)`, refetch entries with the new locale, and
   re-render. `setLocale(...)` updates only the SDK Experience/event locale; it does not refetch
   Contentful or refresh profile state, and it throws before initialization or on an invalid locale.
5. After the locale change, emit a fresh Experience event — the `screen`, `identify`, or `page` call
   your app already owns for the current state — when rendered output depends on SDK-derived profile
   data, `selectedOptimizations` (the visitor's current set of variant selections), flags, or merge
   tags that must reflect the new locale. Without a new event, those stay on the previous locale's
   response.

Both fetch properties are set on the `contentful.swift` query your app already builds. The
`contentfulClient` parameter below is the client from [Before you start](#before-you-start); its
`fetchArray` reports through a completion handler, so an `async` call site bridges it with a
continuation.

**Adapt this to your use case:**

```swift
import Contentful
import ContentfulOptimization

// App-owned locale; replace this with the value from your locale policy.
let appLocale = "en-US"

let config = OptimizationConfig(
    clientId: "<your-client-id>",
    // Aligns Experience API responses and event context with the rendered Contentful locale.
    locale: appLocale
)

func fetchEntry(
    id: String,
    locale: String,
    using contentfulClient: Contentful.Client
) async throws -> Contentful.Entry? {
    let query = Query.where(sys: .id, .equals(id))
        // Deep enough for nt_experiences -> nt_experience -> nt_variants in one payload.
        .include(10)
        // One concrete locale; an all-locale payload resolves to baseline.
        .localizeResults(withLocaleCode: locale)

    let response: HomogeneousArrayResponse<Contentful.Entry> =
        try await withCheckedThrowingContinuation { continuation in
            contentfulClient.fetchArray(of: Contentful.Entry.self, matching: query) { result in
                continuation.resume(with: result)
            }
        }
    return response.items.first
}
```

When the route carries a slug instead of an ID, the same two properties apply, plus a limit of two so a
duplicate slug is detectable rather than silently resolved to whichever entry came back first. Return
the entry only when the response contains exactly one item; surface zero items through the app's
not-found path and more than one as an authoring or configuration error. The content type and
slug-field IDs belong to your app and content model — the native SDK never reads them or performs this
request.

**Adapt this to your use case:**

```swift
// routeSlug is your app's; "page" and "slug" are your content type and slug-field IDs.
let query = Query.where(contentTypeId: "page")
    .where(field: "slug", .equals(routeSlug))
    .include(10)
    // Two, not one: a second item means the slug is ambiguous.
    .limit(to: 2)
    .localizeResults(withLocaleCode: appLocale)
```

Pass the entry either query returns to the `OptimizedEntry` or direct-resolution path in
[Entry resolution and fallback rendering](#entry-resolution-and-fallback-rendering).

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

For the full data shape and locale boundary, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
and
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Entry resolution and fallback rendering

**Integration category:** Required for first integration

`OptimizedEntry` renders a Contentful entry through the resolver. It detects an optimized entry by the
presence of the `nt_experiences` field; a non-optimized entry passes through unchanged, and an
optimized entry resolves against the visitor's selected variants. When you pass a `Contentful.Entry`,
the render closure receives the SDK-owned `CTEntry` wrapper.

Read that wrapper in two steps, because the entry you get back is not necessarily shaped like the one
you passed in: a selected variant is its own linked entry and can use any Contentful content type.

1. `CTEntry.contentTypeId` tells you which Contentful content type you actually received, so your app
   can choose the renderer for it.
2. Inside that renderer, call `hasField(...)` before `getField(...)`. `contentTypeId` identifies the
   content type; it does not validate that the entry carries the fields that content type usually has.

The content type IDs and renderers below belong to your app.

An **empty variant** is a variant authored to render nothing rather than to replace content. When one
is selected, `OptimizedEntry` omits your app's content and does not call your content closure. The SDK still retains
the resolved selection and tracking metadata. Because no visible content supplies geometry in that
state, there may be nothing measurable or tappable, so a view or tap event is not guaranteed. A later
non-empty result calls the closure with the current entry. An absent or invalid empty-variant field
renders normally.

Resolution is synchronous and fail-soft. `client.resolveOptimizedEntry(baseline:selectedOptimizations:)`
returns the SDK-owned `ResolvedOptimizedEntry`, which contains the resolved `CTEntry`, the applied
`selectedOptimization` — the single selection that produced this entry's variant, as opposed to the
client's `selectedOptimizations`, which is the visitor's whole current set — an optional
`optimizationContextId`, and `isEmptyVariant`. Only a
boolean `true` marks an empty variant. If resolution fails, it contains the baseline entry with
`selectedOptimization` and `optimizationContextId` set to `nil` instead of
breaking the UI. Pass `nil` for `selectedOptimizations` to use current client state, or pass an
explicit snapshot.

1. Pass the fetched `Contentful.Entry` to `OptimizedEntry`, branch on `CTEntry.contentTypeId`, and
   read fields only inside the matching branch.
2. Provide your own loading treatment while the app-owned fetch is pending — `OptimizedEntry` needs an
   entry to render, so gate it on your fetched state.
3. Use `client.resolveOptimizedEntry(...)` directly only when a component must separate resolution
   from rendering, and route its `CTEntry` through the same renderer.

**Adapt this to your use case:**

```swift
import Contentful
import ContentfulOptimization
import SwiftUI

struct PersonalizedSection: View {
    // nil until your app-owned CDA fetch settles.
    let entry: Contentful.Entry?

    var body: some View {
        if let entry {
            OptimizedEntry(entry: entry) { resolvedEntry in
                ResolvedEntryContent(entry: resolvedEntry)
            }
        } else {
            // Your own loading treatment; OptimizedEntry needs a fetched entry to render.
            ProgressView()
        }
    }
}

private struct ResolvedEntryContent: View {
    let entry: CTEntry

    @ViewBuilder
    var body: some View {
        switch entry.contentTypeId {
        case "hero" where entry.hasField("headline"):
            HeroCard(headline: entry.getField("headline") ?? "")
        case "cta" where entry.hasField("label"):
            CTAButton(label: entry.getField("label") ?? "")
        case "page" where entry.hasField("title"):
            PageSection(title: entry.getField("title") ?? "")
        default:
            UnsupportedEntryView()
        }
    }
}
```

The direct resolver keeps the same native call shape and uses current client state when
`selectedOptimizations` is omitted.

**Follow this pattern:**

```swift
struct DirectResolutionView: View {
    @EnvironmentObject private var client: OptimizationClient
    let entry: Contentful.Entry

    var body: some View {
        let result = client.resolveOptimizedEntry(baseline: entry)
        if !result.isEmptyVariant {
            ResolvedEntryContent(entry: result.entry)
        }
    }
}
```

Both examples pass the fetched `Contentful.Entry` straight to the typed API rather than hand-mapping it
to a dictionary first: the SDK-owned adapter builds the `{sys, fields, metadata}` shape the resolver
expects, and what comes back is a `CTEntry` you read with `getField` instead of a raw dictionary you
cast.

For the shared resolution and fallback rules, see
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

`OptimizedEntry` tracks two interactions for the entry it wraps: entry views and entry taps. Both
default to enabled. `OptimizationRoot` sets the tree-wide defaults through its `trackViews` and
`trackTaps` parameters, and each `OptimizedEntry` can override them per entry.

Three sets of names describe those same two interactions, and only the first set is yours to choose:
`trackViews`/`trackTaps` are the configuration switches you pass; `trackView`/`trackClick` are fixed
SDK-owned consent keys the SDK checks internally, as `hasConsent(method: "trackView")` for views and
`hasConsent(method: "trackClick")` for taps; and `component`/`component_click` are the event types an
entry view and an entry tap are delivered as — the names you use in `allowedEventTypes` and see in
event payloads. Both interactions stay blocked until event consent (or an allow-list entry) permits
them.

View tracking is viewport-based. Wrap scrollable content in `OptimizationScrollView` so view timing
uses the real scroll position; without an enclosing scroll view, tracking assumes `scrollY` is `0` and
uses the screen height as the viewport, which suits only non-scrolling or already-visible layouts. The
default view threshold is 80% visibility (`minVisibleRatio` `0.8`) for a cumulative 2000 ms
(`dwellTimeMs`) — visible time accumulates, so the threshold does not require one unbroken visible
window. After the first view event, duration updates emit every 5000 ms
(`viewDurationUpdateIntervalMs`) while the entry stays visible.

A tap observer on the `OptimizedEntry` wrapper emits the `component_click` event, then calls the
optional `onTap` closure. That closure receives the **baseline** entry you passed in, not the resolved
variant — only the render closure receives the resolved entry — so do not read variant-dependent
fields from it. Because `onTap` runs through that same tap observer, `trackTaps: false` on that
`OptimizedEntry` disables both the tap event and `onTap`.

1. Leave view and tap tracking enabled for entries that need exposure and interaction analytics.
2. Set `trackViews: false` or `trackTaps: false` on `OptimizationRoot` to change the default for the
   whole tree, or on an individual `OptimizedEntry` for one surface. A root `trackTaps: false` is a
   default, not a lock: an entry that passes `trackTaps: true`, or a non-nil `onTap`, still emits
   `component_click`.
3. Wrap scrollable entry lists in `OptimizationScrollView` for accurate viewport timing.
4. Tune `dwellTimeMs`, `minVisibleRatio`, and `viewDurationUpdateIntervalMs` per entry only when
   analytics requirements differ from the defaults.
5. Use a `Button` or app gesture inside the render closure for navigation, and `onTap` only when the
   SDK tap event should also drive it.

**Adapt this to your use case:**

```swift
OptimizationRoot(config: config, trackTaps: false) {
    // Tap tracking off by default below here; an entry with trackTaps: true or a
    // non-nil onTap still tracks taps.
    RootView()
}
```

The snippets in this section show SDK call shapes only, so place each expression inside your own `View`
body or `Scene` — a bare `OptimizationRoot(...)` or `OptimizedEntry(...)` expression cannot sit at file
scope. `config`, `posts`, `cta`, `navigate(to:)`, `analytics`, and the card views are your app's.

**Adapt this to your use case:**

```swift
OptimizationScrollView {
    LazyVStack(alignment: .leading, spacing: 12) {
        ForEach(Array(posts.enumerated()), id: \.offset) { _, post in
            // Per-entry thresholds override the tree defaults from OptimizationRoot.
            OptimizedEntry(entry: post, dwellTimeMs: 1000, minVisibleRatio: 0.5) { resolvedEntry in
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
// render closure instead, which carries the variant's fields. A non-nil onTap
// also enables tap tracking for this entry under a root trackTaps: false.
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
struct PurchaseButton: View {
    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        Button("Purchase") {
            Task {
                // Event methods are async; custom track events stay blocked until
                // event consent is accepted.
                _ = try? await client.track(event: "Purchase Completed", properties: ["sku": "sku-1"])
            }
        }
    }
}
```

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

**Custom Flags** are named values the Experience API returns for the current visitor alongside variant
selections — a switch, label, or number your app reads and applies itself instead of rendering a
replacement entry. A **merge tag** is the inline counterpart inside Rich Text: an embedded `nt_mergetag`
entry that resolves to a value from the visitor's profile. Both read profile-backed values, separately
from entry variant selection.

Flag names are not app-invented. `client.getFlag(_:)` looks the name up in the flag values the
Experience API returned for this visitor, so the key has to match the one in your Optimization data;
`"priorityBadge"` below stands in for that name.

`client.getFlag(_:)` is a one-time, non-reactive read; `client.flagPublisher(_:)`
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

As in the tracking section, these are call shapes to place inside your own `View` body or `Scene`, and
`config`, `dashboardEntry`, `legalCopyEntry`, and the two content views are your app's.

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
4. Pass `ContentfulSDKPreviewClient(client:)` when your app already reads Contentful through
   `contentful.swift`, so the panel shares that client's configuration and session. Use
   `ContentfulHTTPPreviewClient` when there is no Contentful client to share.

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

Build `previewPanel` where your app builds its configuration, and keep the `OptimizationRoot`
expression inside your `Scene` as in the quick start.

`PreviewPanelOverlay` reads the client from the SwiftUI environment, so it must sit under an
`OptimizationRoot`. It remains available when the app needs to place the panel's overlay itself, but
`PreviewPanelConfig` keeps the setup attached to the root SDK provider.

## Advanced integrations

### Strict event policy and endpoint controls

**Integration category:** Advanced or production-only

Use advanced configuration when production policy requires stricter pre-consent behavior, explicit
event allow-lists, non-default endpoints, or queue observability.

1. Pass `allowedEventTypes: []` when no SDK event can emit before consent.
2. Pass a narrow `allowedEventTypes` list when policy permits only specific pre-consent events. Its
   elements are event type names: `identify`, `screen`, `page`, `track`, `component` (an entry view),
   and `component_click` (an entry tap). Leaving `allowedEventTypes` unset behaves like
   `["identify", "screen"]`, the native default.
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
    // Blocks every SDK event until explicit consent is accepted; a narrow list such as
    // ["identify", "screen"] would admit only those two before consent.
    allowedEventTypes: [],
    queuePolicy: QueuePolicy(
        flush: QueueFlushPolicy(flushIntervalMs: 1000, maxConsecutiveFailures: 3),
        offlineMaxEvents: 100
    ),
    onEventBlocked: { blocked in
        // Verification hook: confirm denied events do not leave the SDK.
        // debugLogger is your app's own logger.
        debugLogger.info("Blocked \(blocked.method): \(blocked.reason)")
    }
)
```

### Offline delivery and lifecycle flushing

**Integration category:** Advanced or production-only

After initialization the SDK monitors network reachability and app lifecycle. A `NetworkMonitor`
(`NWPathMonitor`) calls `setOnline(_:)` on connectivity changes and `flush()` on reconnect, and an
`AppStateHandler` calls `flush()` when the app resigns active for a best-effort background drain. That
app-state handler is compiled in wherever UIKit can be imported, which is the case in an iOS app build,
so a SwiftUI-lifecycle app gets the resign-active flush too — you do not need to add your own.
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
- **Content fallback** — The Contentful client fetches single-locale entries with enough include depth
  for optimized entries, baseline rendering still works when no variant matches or data is
  incomplete, and every supported resolved content type maps to a renderer. A variant content type
  that differs from the baseline is rendered as that variant, not treated as fallback.
- **Duplicate-tracking prevention** — one `OptimizationRoot` owns the SwiftUI tree, each route uses
  one screen-tracking path, `.trackScreen(name:)` is attached once per logical screen, and the app
  does not wrap the same rendered entry more than once for one impression.
- **Privacy and governance** — forwarded analytics payloads apply destination consent and do not
  replay events the SDK blocked, profile traits are approved, the preview panel is absent from public
  builds or gated to approved internal users, and persisted profile continuity matches consent
  records.
- **Local validation path** — validate against the iOS reference implementation or the app's own
  targeted XCUITest flow before relying on production telemetry.
- **Confirm in Live Events** — in addition to local log and status checks, open the target Contentful
  space and environment's Live Events view in the Contentful web app, trigger a real flow from the app
  (a screen view, an entry view or tap, an `identify()` call, or a custom `track()` call), and confirm
  the corresponding event arrives with the expected wire type (`identify`, `screen`, `component`,
  `component_click`, or `track`) and payload fields.

## Troubleshooting

Use these checks for common SwiftUI integration failures:

| Symptom                                                               | Check                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The app stays on the readiness spinner and no `[bridge]` lines appear | `OptimizationRoot` renders `ProgressView()` until the client reports `isInitialized`, and `initialize(config:)` throws instead of reporting it, so a permanent spinner means initialization failed. Confirm the app was built and run after the Swift Package was added, so the SDK's bundled JavaScript resource is in the build (a missing resource is a `resourceLoadError`), and that any `locale` you passed is a valid BCP-47 value (an invalid one is a `configError`). |
| A build fails on `no such module`                                     | Confirm the `ContentfulOptimization` product is listed in your app target's dependencies, not only in the project's package list. The typed-entry examples also `import Contentful`, which needs `contentful.swift` resolvable from the same target.                                                                                                                                                                                                                           |
| An `OptimizedEntry` render closure does not type-check                | The closure's parameter type follows the entry you pass: `OptimizedEntry(entry:)` with a `Contentful.Entry` hands the closure a `CTEntry`, and the dictionary initializer hands it an entry dictionary. Match the closure to the entry you fetch, or convert the fetch to return `Contentful.Entry`.                                                                                                                                                                           |
| Personalized content stays baseline                                   | Confirm consent permits optimization, a `screen` or `identify` event has produced selected optimizations, the CDA payload is single-locale (not `locale=*`), and linked variants are included deeply enough.                                                                                                                                                                                                                                                                   |
| Entry view or tap events are missing                                  | Confirm `trackViews`/`trackTaps` were not opted out, consent permits `trackView`/`trackClick`, the entry stayed visible past the dwell threshold, scrollable content uses `OptimizationScrollView`, and the entry has a `sys.id`.                                                                                                                                                                                                                                              |
| Screen events duplicate or go missing                                 | Attach `.trackScreen(name:)` once to the stable screen root, use one screen-tracking path per route, and pass an explicit `routeKey` when a dynamic screen name can change for the same logical route.                                                                                                                                                                                                                                                                         |
| Preview panel shows identifiers only                                  | Pass a `PreviewContentfulClient` so the panel can fetch `nt_audience` and `nt_experience` definitions and show names instead of raw IDs.                                                                                                                                                                                                                                                                                                                                       |
| Flag values do not update                                             | Subscribe after `OptimizationRoot` initializes, keep the Combine subscription or Swift concurrency task alive for as long as the view needs updates, and verify the flag key exists in SDK change/profile state.                                                                                                                                                                                                                                                               |

## Reference implementations to compare against

- [iOS reference implementation](../../implementations/ios-sdk/README.md) — the maintained SwiftUI and
  UIKit shells that exercise shared native iOS bridge behavior, single-locale Contentful fetching,
  entry resolution, interaction tracking, screen tracking, Custom Flags, offline delivery, and
  preview-panel overrides against the same mock API.
