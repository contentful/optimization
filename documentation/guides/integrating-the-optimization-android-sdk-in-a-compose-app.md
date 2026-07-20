# Integrating the Optimization Android SDK in a Jetpack Compose app

Use this guide to add Contentful personalization to a Jetpack Compose app with the Optimization
Android SDK. By the end of the quick start, the SDK is initialized inside your Compose app and emits
one screen event that its consent gate accepts — the event Contentful uses to keep that visitor's
personalization consistent.

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

The Android SDK persists the profile to `SharedPreferences` across app launches when persistence
consent — the visitor's separate permission to store profile state on the device, explained in
[Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff) — allows it.

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

This guide uses the `com.contentful.java:optimization-android` library. You mount one
`OptimizationRoot` around the Compose tree that uses SDK helpers; it creates and initializes the SDK
client, restores state from `SharedPreferences`, and provides it to the components and effects below
it. Your app still owns its Contentful entry fetching, consent policy, identity policy, navigation,
app-owned caching, and final rendering. If your app is View-based, use
[the Android Views integration guide](./integrating-the-optimization-android-sdk-in-a-views-app.md)
instead.

## Quick start

Most Compose + Contentful apps share one shape: a Compose `Activity` whose `setContent { }` wraps the
app UI. This quick start assumes that shape and proves the smallest result: **the SDK initializes and
emits one screen event that its consent gate accepts** — an "accepted" event is one the SDK's local
consent and allow-list checks let through to send, which is what you can observe on the device; it is
not a confirmation that Contentful received it. Entry rendering needs an app-specific Contentful
fetch, so it moves to [Entry resolution and fallback rendering](#entry-resolution-and-fallback-rendering)
in Core; here you wrap your app UI in `OptimizationRoot` and mark one screen with
`ScreenTrackingEffect`.

This quick start assumes your application policy permits Optimization to start with accepted consent
and renders no end-user consent UI, so it sets `defaults = StorageDefaults(consent = true)` — the
SDK-owned holder of startup defaults, whose `consent` flag accepts both consent axes at once. If
personalization must wait for a consent decision, keep this structure and add the
[Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff) step before you ship, which
explains the two axes and the split form that sets them separately.

1. Add the Android SDK from Maven Central to your application module and run a Gradle build. There is
   no separate native prebuild step; the SDK's JavaScript runtime ships inside the AAR.

   **Adapt this to your use case:**

   ```kotlin
   repositories {
       mavenCentral()
   }

   dependencies {
       implementation("com.contentful.java:optimization-android:<version>")
   }
   ```

2. Wrap your app UI in `OptimizationRoot`, pass your Optimization client ID, set
   `logLevel = OptimizationLogLevel.debug` so the SDK logs its activity, and add `ScreenTrackingEffect`
   to one screen you already render.

   **Adapt this to your use case:**

   ```diff
    import android.os.Bundle
    import androidx.activity.ComponentActivity
    import androidx.activity.compose.setContent
    import androidx.compose.runtime.Composable
   +import com.contentful.optimization.compose.OptimizationRoot
   +import com.contentful.optimization.compose.ScreenTrackingEffect
   +import com.contentful.optimization.core.OptimizationConfig
   +import com.contentful.optimization.core.OptimizationLogLevel
   +import com.contentful.optimization.core.StorageDefaults

    class MainActivity : ComponentActivity() {
        override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)
            setContent {
   -            HomeScreen()
   +            // Wrap the tree that uses SDK helpers; one client stays alive for its lifetime.
   +            OptimizationRoot(
   +                config = OptimizationConfig(
   +                    clientId = "<your-client-id>",
   +                    // Accepted startup consent; the Consent section replaces this with your policy.
   +                    defaults = StorageDefaults(consent = true),
   +                    // debug surfaces the accepted screen event in logcat.
   +                    logLevel = OptimizationLogLevel.debug,
   +                ),
   +            ) {
   +                HomeScreen()
   +            }
            }
        }
    }

    @Composable
    fun HomeScreen() {
   +    // Emits one screen event; the SDK dedupes repeats of the same screen.
   +    ScreenTrackingEffect(screenName = "Home")
        HomeContent()
    }
   ```

   The `MainActivity` and `HomeScreen` scaffolding above is illustrative context to match against your
   own app, not a file to paste over yours. Wrap your existing `setContent { }` tree in
   `OptimizationRoot` and add `ScreenTrackingEffect` to a screen you already render — keep the rest of
   your composables as they are.

3. Verify the first run. Launch the app on a device or emulator. Because
   `logLevel = OptimizationLogLevel.debug` is set, the SDK logs its activity to logcat under the
   `ContentfulOptimization` tag. `ScreenTrackingEffect` sends the screen event through
   `trackCurrentScreen`, so filter logcat to the `ContentfulOptimization` tag and look for the pair of
   bridge lines it logs — `[bridge] Calling trackCurrentScreen async` followed by
   `[bridge] trackCurrentScreen succeeded`, whose result payload contains `"accepted":true`. That
   `succeeded` line with `accepted` true is the proof the event passed the consent gate. If you see
   `"accepted":false` instead — or configure `onEventBlocked` and see the screen event arrive there —
   the event was blocked by consent or the allow-list rather than emitted; see
   [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff). The
   [Custom events and analytics diagnostics](#custom-events-and-analytics-diagnostics) section adds a
   programmatic `eventStream` observer for asserting on events in code rather than reading logs.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [Install and initialize `OptimizationRoot`](#install-and-initialize-optimizationroot)
  - [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff)
  - [Contentful entry fetching and locale shape](#contentful-entry-fetching-and-locale-shape)
  - [Entry resolution and fallback rendering](#entry-resolution-and-fallback-rendering)
  - [Screen and navigation tracking](#screen-and-navigation-tracking)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Identity, profile continuity, and reset](#identity-profile-continuity-and-reset)
- [Optional integrations](#optional-integrations)
  - [Custom events and analytics diagnostics](#custom-events-and-analytics-diagnostics)
  - [Custom Flags and MergeTag rendering](#custom-flags-and-mergetag-rendering)
  - [Live updates](#live-updates)
  - [Preview panel](#preview-panel)
- [Advanced integrations](#advanced-integrations)
  - [Strict event policy and queue controls](#strict-event-policy-and-queue-controls)
  - [Offline delivery and lifecycle flushing](#offline-delivery-and-lifecycle-flushing)
  - [Content caching and hybrid continuity boundaries](#content-caching-and-hybrid-continuity-boundaries)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- **A Jetpack Compose app you can build with Gradle**, targeting Android `minSdk` 24 or later with
  Java 11 bytecode. The SDK ships as a single AAR on Maven Central, so you add the dependency and run
  a normal Gradle build — there is no separate native prebuild step. The Android SDK does not fetch
  Contentful entries for your application UI (only the preview panel fetches its own definitions):
  your app fetches entries in its own layer and passes the resulting single-locale entry maps to
  `OptimizedEntry` or `client.resolveOptimizedEntry(...)`.
- **Contentful delivery credentials** — space ID, delivery token, and environment — read from your
  app's runtime configuration and used by your own Contentful fetching layer.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. `environment` has a Kotlin-side default of `"main"`, so pass it only when your Contentful
  environment differs. The Experience API (which picks variants) and the Insights API (which receives
  event and interaction delivery) each have a base URL that defaults correctly; you set them through
  `OptimizationApiConfig` only for mocks or non-default hosts (see
  [Install and initialize `OptimizationRoot`](#install-and-initialize-optimizationroot)).

You do not need a setup inventory up front. Everything else — consent, entry resolution, screen
tracking, interaction tracking, identity, live updates, preview, offline delivery — is introduced by
the section that needs it.

> [!NOTE]
>
> Read the SDK and Contentful config from your app's runtime configuration. This guide's examples use
> inline placeholder strings for clarity; the reference implementation reads its values from a shared
> `AppConfig` object because it runs against shared mock defaults. Use whatever configuration
> convention your Android app already uses — `BuildConfig` fields, resources, or a config object — and
> keep it consistent.

## Core integration

### Install and initialize `OptimizationRoot`

**Integration category:** Required for first integration

You wrapped your app UI in `OptimizationRoot` in the quick start; this section covers its full
configuration surface. `OptimizationRoot` is the normal Compose entry point: it creates one
`OptimizationClient` with `remember`, calls the client's `initialize(config)` in a `LaunchedEffect`,
provides the initialized client through the `LocalOptimizationClient` composition local (plus tracking
defaults through `LocalTrackingConfig`), and renders a `CircularProgressIndicator()` until the client
reports `isInitialized`. Descendant composables that call SDK methods directly read the client with
`LocalOptimizationClient.current`.

`initialize(config)` is a `suspend` function — Android diverges from the iOS SDK's synchronous,
throwing init because bridge calls hop onto a dedicated QuickJS dispatcher. It loads persisted consent
from `SharedPreferences`, resolves defaults, evaluates the SDK's bundled JavaScript runtime, runs
bridge initialization on that dispatcher, then flips `isInitialized`; `OptimizationRoot` runs it inside
a `LaunchedEffect` for you. `OptimizationClient` exposes async work (events and entry resolution) as
`suspend` functions and its state as Kotlin `StateFlow`/`SharedFlow`, not Combine publishers. Call
suspending methods from Compose effects, event-handler coroutine scopes, or another app-owned coroutine
scope.

1. Add `com.contentful.java:optimization-android` from Maven Central and build the app.
2. Create one `OptimizationConfig` with the Optimization client ID. `environment` defaults to `"main"`,
   so pass it only when your Contentful environment differs.
3. Pass `locale` when Experience API responses and event context must use the same app locale as your
   Contentful entry fetches.
4. Pass an `api` (`OptimizationApiConfig`) override only for staging, mocks, or non-default hosts; both
   base URLs default correctly otherwise, so most apps omit `api`.
5. Read the initialized client with `LocalOptimizationClient.current` inside descendant composables
   that call SDK methods directly.

**Adapt this to your use case:**

```kotlin
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.compose.OptimizationRoot
import com.contentful.optimization.core.OptimizationConfig
import com.contentful.optimization.core.OptimizationLogLevel
import kotlinx.coroutines.launch

@Composable
fun AppRoot() {
    // One SDK-owned client stays alive for the Compose tree that uses Optimization.
    OptimizationRoot(
        config = OptimizationConfig(
            clientId = "<your-client-id>",
            // environment defaults to "main"; set it only when your Contentful environment differs.
            locale = "en-US",
            logLevel = OptimizationLogLevel.warn,
        ),
    ) {
        AppNavGraph()
    }
}

@Composable
fun PurchaseButton() {
    // Descendant composables read the client OptimizationRoot created and initialized.
    val client = LocalOptimizationClient.current
    val scope = rememberCoroutineScope()

    Button(onClick = {
        scope.launch {
            // Event methods are suspend; call them from a coroutine scope.
            client.track(event = "Purchase Completed", properties = mapOf("sku" to "sku-1"))
        }
    }) {
        Text("Purchase")
    }
}
```

`logLevel` defaults to `OptimizationLogLevel.error`; `debug` and `log` surface the bridge activity
lines you used in the quick start. For lifecycle details, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-coroutines).
For package status and installation details, see
[the Optimization Android SDK README](../../packages/android/README.md).

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

Consent policy stays application-owned. Consent has two independent axes: **event consent** (may the
SDK personalize and emit events) and **persistence consent** (may the SDK store profile continuity in
`SharedPreferences`). The boolean call `client.consent(accept)` sets both at once; the split call
`client.consent(events, persistence)` sets them independently. `StorageDefaults(consent = true)` seeds
accepted event and persistence consent at startup — use it only when application policy permits
Optimization by default and you render no consent UI.

`StorageDefaults` values are startup defaults, not one-time seeds: a configured value takes precedence
over the stored `SharedPreferences` value every launch, so a configured `consent` can replace a stored
choice. Apps that persist a user's own decision leave `StorageDefaults.consent` unset and call
`client.consent(...)` from resolved app policy instead.

1. Seed accepted consent with `StorageDefaults(consent = true)` only when policy permits default-on
   Optimization and no consent UI is shown.
2. Otherwise leave consent unset and call `client.consent(true)` after the visitor accepts,
   `client.consent(false)` after they reject.
3. Use the split form when events are allowed but durable profile continuity must stay session-only.
4. Read `client.state` when consent UI must reflect SDK state across app launches.

**Adapt this to your use case:**

```kotlin
@Composable
fun ConsentControls(content: @Composable () -> Unit) {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()

    if (state.consent == null) {
        Row {
            // Wire these calls to your CMP or privacy UI, not to SDK-owned policy.
            Button(onClick = { client.consent(true) }) { Text("Accept") }
            Button(onClick = { client.consent(false) }) { Text("Reject") }
        }
    } else {
        content()
    }
}
```

**Copy this:**

```kotlin
// Allows events but keeps profile continuity session-only.
client.consent(events = true, persistence = false)
```

The split form above keeps the profile, its selected optimizations — the per-experience variant
selections the Experience API returned for this visitor — and `changes` — the inline field and flag
values it returned — in memory only, so nothing is written to `SharedPreferences`. Before event consent is accepted, the native default allow-list lets `identify`
and `screen` events emit; entry-view events (wire type `component`), tap events (`component_click`),
and custom `track` events are blocked until consent is accepted or you allow-list them.
`client.consent(false)` clears event and persistence consent, purges queued events, and clears durable
profile continuity, while in-memory state stays usable until reset or teardown. To block every SDK
event before consent — including `identify` and `screen` — set `allowedEventTypes = emptyList()`; see
[Strict event policy and queue controls](#strict-event-policy-and-queue-controls). For the cross-SDK
consent model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful entry fetching and locale shape

**Integration category:** Required for first integration

The Android SDK does not fetch Contentful entries for your application UI — only the preview panel
fetches its own audience and experience definitions. Your app fetches entries from the Contentful
Delivery API and passes the resulting single-locale entry maps (`Map<String, Any>`) to `OptimizedEntry`
or `client.resolveOptimizedEntry(...)`. There is no fetch-by-ID path in the Android SDK, so the
Contentful client and its request options stay entirely yours.

Fetch with one concrete locale and enough `include` depth to resolve the linked optimization data.
`nt_experiences` is the SDK-owned link field the resolver reads on an optimized entry; it links that
entry's `nt_experience` entries, and each experience links its `nt_variants` (and `nt_audience`). These
are fixed Optimization content-model identifiers you do not choose. `nt_config` is a JSON field on the
experience, not a link, so it needs no extra include depth. Fetch deep enough to pull the linked
entries back in one payload — the reference implementation uses `include=10`. Do not pass all-locale
CDA responses such as `locale=*`; the resolver expects direct single-locale field values and falls
back to baseline on an all-locale payload.

The SDK Experience/event `locale` is distinct from the Contentful CDA locale: your app chooses the CDA
locale for its own fetch, and `OptimizationConfig(locale = ...)` sets the locale the Experience API and
events use. Keep them aligned when rendered content and Experience responses must match.

1. Choose the application Contentful locale in your app's navigation, i18n, or account layer.
2. Pass the same locale to `OptimizationConfig(locale = ...)` when Experience responses and event
   context must align with rendered content.
3. Fetch entries with a concrete locale and enough include depth for `nt_experiences` →
   `nt_experience` → `nt_variants`/`nt_audience`.
4. When the app locale changes, call `client.setLocale(...)`, refetch entries with the new locale, and
   re-render. `setLocale(...)` updates only the SDK Experience/event locale; it does not refetch
   Contentful or refresh profile state, and it throws before initialization or on an invalid locale.

**Adapt this to your use case:**

```kotlin
@Composable
fun HomeScreen(contentfulClient: ContentfulDeliveryClient) {
    // selectedAppLocale() and contentfulClient are your app's own locale source and fetching layer.
    val appLocale = selectedAppLocale()
    var heroEntry by remember { mutableStateOf<Map<String, Any>?>(null) }

    LaunchedEffect(appLocale) {
        // Your own CDA fetch: one concrete locale, include depth for linked experiences and variants.
        heroEntry = contentfulClient.fetchEntry(
            id = "<entry-id>",
            locale = appLocale,
            include = 10,
        )
    }

    HomeContent(heroEntry = heroEntry)
}
```

For the full data shape and locale boundary, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
and
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Entry resolution and fallback rendering

**Integration category:** Required for first integration

`OptimizedEntry` renders a Contentful entry through the resolver. It detects an optimized entry by the
presence of the `fields.nt_experiences` field; a non-optimized entry passes through unchanged and
renders the baseline once, and an optimized entry resolves against the visitor's selected variants. The
render lambda receives the resolved entry map — the selected variant, or the baseline entry when no
variant matches — with the same field shape as the baseline, so your renderer reads fields without
branching on whether a variant was applied.

Resolution is fail-soft, and `client.resolveOptimizedEntry(baseline, selectedOptimizations)` is a
`suspend` function on Android (the iOS SDK's is synchronous; Android must suspend because the bridge
call hops to the QuickJS dispatcher). It returns a `ResolvedOptimizedEntry` — the SDK-owned result
wrapper holding the resolved `entry` and the `selectedOptimization` (singular) applied to it. If the
client is not initialized, serialization fails, or the bridge result cannot be parsed, it returns the
baseline entry unchanged (with `selectedOptimization` null) and continues rather than throwing or
breaking the UI. The `selectedOptimizations` argument (plural) is the visitor's current per-experience
selections: pass `null` (the default) to omit the argument and resolve against the SDK's live selection
state, or pass an explicit snapshot to resolve against exactly that. `client.selectedOptimizations` is
the `StateFlow` that publishes that plural set as it changes.

1. Pass the baseline Contentful entry map to `OptimizedEntry` and read fields from the resolved entry
   in the render lambda.
2. Keep field parsing and view rendering in your own composables; the resolved entry keeps the baseline
   field shape.
3. Provide your own loading treatment while the app-owned fetch is pending — `OptimizedEntry` needs an
   entry to render, so gate it on your fetched state.
4. Use `client.resolveOptimizedEntry(...)` directly only when a component must separate resolution from
   rendering.

**Adapt this to your use case:**

```kotlin
@Composable
fun HeroSection(entry: Map<String, Any>) {
    OptimizedEntry(
        entry = entry,
        accessibilityIdentifier = "home-hero-optimization",
    ) { resolvedEntry ->
        // resolvedEntry is the selected variant, or the baseline entry when none matches.
        HeroCard(entry = resolvedEntry)
    }
}
```

**Follow this pattern:**

```kotlin
@Composable
fun DirectResolution(entry: Map<String, Any>) {
    val client = LocalOptimizationClient.current
    var resolvedEntry by remember(entry) { mutableStateOf(entry) }

    LaunchedEffect(entry) {
        // Collect the flow so re-resolution follows every profile, preview, or consent change;
        // reading selectedOptimizations.value would capture only the current snapshot.
        client.selectedOptimizations.collect { selectedOptimizations ->
            resolvedEntry = client.resolveOptimizedEntry(
                baseline = entry,
                selectedOptimizations = selectedOptimizations,
            ).entry
        }
    }

    CtaHeader(entry = resolvedEntry)
}
```

The resolver does not fetch Contentful entries, evaluate audiences, call the Experience API, or mutate
state; it joins the current selected optimization metadata with linked entries already present in the
Contentful payload. For the fallback rules, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#fallback-behavior).

### Screen and navigation tracking

**Integration category:** Required for first integration

You added `ScreenTrackingEffect` in the quick start. It fires from a `LaunchedEffect` keyed on the
screen name and `state.consent`, so it calls `client.trackCurrentScreen(name)` on first composition,
when the screen name changes, and when a consent change allows a previously blocked screen to emit.
`trackCurrentScreen` dedupes in the bridge by route key (defaulting to the name), so a repeat of the
same current screen is skipped and a blocked attempt is retried once consent allows. Plain
`client.screen(name)` emits with no dedupe.

Place `ScreenTrackingEffect` once at the root composable of each route or destination. For a dynamic
screen name or an app-defined route key — for example a detail screen whose name depends on loaded data
— call `client.trackCurrentScreen(name, properties, routeKey)` from a `LaunchedEffect` instead. Track a
given route through one path only: do not both place `ScreenTrackingEffect` and call
`trackCurrentScreen`/`screen` for the same route, or you will emit duplicate or conflicting events.

1. Place `ScreenTrackingEffect` once at the route or destination root of each screen that maps to an
   analytics screen.
2. Use stable names for navigation destinations so downstream reporting can group events.
3. For dynamic names or an explicit route key, call `client.trackCurrentScreen(...)` from a
   `LaunchedEffect` once the data is available.
4. Use one screen-tracking path per route to avoid duplicate events from repeated child composition.

**Follow this pattern:**

```kotlin
@Composable
fun HomeScreen() {
    // Place at the destination root to prevent duplicate screen events.
    ScreenTrackingEffect(screenName = "Home")
    HomeContent()
}
```

**Adapt this to your use case:**

```kotlin
@Composable
fun DetailsScreen(postId: String) {
    val client = LocalOptimizationClient.current

    LaunchedEffect(postId) {
        // Key the dynamic screen by route identity so navigation changes emit in sequence.
        client.trackCurrentScreen(
            name = "BlogPostDetail",
            properties = mapOf("postId" to postId),
            routeKey = "blog-post-$postId",
        )
    }

    DetailsContent(postId = postId)
}
```

The Android reference implementation exercises screen tracking with Compose Navigation and asserts the
visited sequence through the SDK event stream.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizedEntry` tracks two interactions for the entry it wraps: entry views and entry taps (there is
no hover on Android). Both default to enabled. `OptimizationRoot` sets the tree-wide defaults through
its `trackViews` and `trackTaps` parameters, and each `OptimizedEntry` can override them per entry.
`trackViews` and `trackTaps` are the configuration switches; on the wire an entry view is delivered as
a `component` event and a tap as a `component_click` event. Delivery is gated on consent: view tracking
checks `hasConsent("trackView")` and tap tracking checks `hasConsent("trackClick")`, so both stay
blocked until event consent (or an allow-list entry) permits them.

View tracking is viewport-based. Wrap scrollable content in `OptimizationLazyColumn` so view timing
uses the real scroll position; without an enclosing scroll context, tracking assumes `scrollY` is `0`
and uses the system display height as the viewport, which suits only non-scrolling or already-visible
layouts. The default view threshold is 80% visibility (`minVisibleRatio` `0.8`) held for 2000 ms
(`dwellTimeMs`); after the first view event, duration updates emit every 5000 ms
(`viewDurationUpdateIntervalMs`) while the entry stays visible.

A tap uses Compose's `clickable {}` on the `OptimizedEntry` wrapper: it emits the `component_click`
event, then calls the optional `onTap` lambda. That lambda receives the **baseline** entry you passed
in, not the resolved variant — only the render lambda receives the resolved entry — so do not read
variant-dependent fields from it. Because `onTap` runs through that same click handler, setting
`trackTaps = false` disables both the tap event and `onTap`. For variant-dependent navigation, drive it
from the resolved entry the render lambda provides.

1. Leave view and tap tracking enabled for entries that need exposure and interaction analytics.
2. Set `trackViews = false` or `trackTaps = false` on `OptimizationRoot` for a tree-wide opt-out, or on
   an individual `OptimizedEntry` for one surface.
3. Wrap scrollable entry lists in `OptimizationLazyColumn` for accurate viewport timing.
4. Tune `dwellTimeMs`, `minVisibleRatio`, and `viewDurationUpdateIntervalMs` per entry only when
   analytics requirements differ from the defaults.
5. Drive navigation from the resolved entry in the render lambda, and use `onTap` only for side effects
   the SDK tap event should also trigger.

**Adapt this to your use case:**

```kotlin
OptimizationRoot(config = config, trackTaps = false) {
    // Tree-wide tap opt-out: no OptimizedEntry below emits component_click.
    AppNavGraph()
}
```

**Adapt this to your use case:**

```kotlin
OptimizationLazyColumn {
    items(entries) { entry ->
        // onTap fires after component_click and receives the baseline entry, not the resolved
        // variant — use it for side effects that need no variant fields.
        OptimizedEntry(
            entry = entry,
            onTap = { _ -> analytics.log("cta-tapped") },
        ) { resolvedEntry ->
            CtaCard(entry = resolvedEntry)
        }
    }
}
```

**Adapt this to your use case:**

```kotlin
OptimizedEntry(
    entry = cta,
    // Disables the SDK tap event and onTap; navigation is app-owned here.
    trackTaps = false,
) { resolvedEntry ->
    // Navigate with the resolved entry so navigation uses the variant's fields.
    Button(onClick = { navigateToEntry(resolvedEntry) }) {
        CtaCard(entry = resolvedEntry)
    }
}
```

For timing thresholds, scroll context, and delivery behavior, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

### Identity, profile continuity, and reset

**Integration category:** Common but policy-dependent

Identify a user when your product has an application-owned identity to associate with the profile.
`client.identify(userId, traits)` is a suspend call that links that identity to the current profile.
The SDK publishes its state reactively as Kotlin flows: `client.state` is a `StateFlow` whose snapshot
carries the profile, consent, and `changes`, and `client.selectedOptimizations` and
`client.optimizationPossible` (a `StateFlow<Boolean>` that is `true` when the current consent and
allow-list configuration can produce optimizations at all) are also `StateFlow`s. Compose reads any of
them with `collectAsState()`.
Keep traits limited to values approved for Optimization profile use.

When persistence consent allows it, the SDK stores profile continuity — profile, changes, selected
optimizations, and the anonymous id — in `SharedPreferences` across app launches, writing with
`commit()` so the continuity write settles to disk before the corresponding client state is published
(tests can wait for SDK-derived state instead of adding storage-timing sleeps before relaunching).
`client.reset()` clears that continuity (profile, changes, selected optimizations, anonymous id, and
the current-screen dedupe) but preserves the stored consent decision, so the next SDK activity still
follows the visitor's existing consent. `reset()` no-ops before initialization.

1. Call `identify(...)` from the authenticated flow or account state change that owns identity.
2. Read `client.state` (and `selectedOptimizations`/`optimizationPossible`) from Compose state when UI
   must reflect SDK state.
3. Call `client.reset()` on sign-out or a privacy reset that must clear profile continuity.
4. Keep application-owned account IDs, server cookies, and third-party destination identifiers in the
   systems that own them.

**Adapt this to your use case:**

```kotlin
@Composable
fun AccountControls() {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()
    val scope = rememberCoroutineScope()

    Column {
        Text("Consent: ${state.consent}")
        Button(onClick = {
            scope.launch {
                // Send identity only after your app's account and privacy policy approves it.
                client.identify(userId = "user-123", traits = mapOf("plan" to "pro"))
            }
        }) {
            Text("Identify")
        }
        Button(onClick = {
            // Clears SDK-managed profile continuity; the stored consent decision survives.
            client.reset()
        }) {
            Text("Reset")
        }
    }
}
```

## Optional integrations

### Custom events and analytics diagnostics

**Integration category:** Optional

Use `client.track(event, properties)` for application-owned business events, and the SDK event streams
for debug surfaces, local validation, or forwarding to your analytics pipeline. The SDK does not
configure third-party analytics destinations for you.

`client.eventStream` and `client.blockedEventStream` are both replay-buffered `SharedFlow`s
(`replay = 64`) — so unlike the iOS SDK's passthrough Combine publisher, a late subscriber on Android
still receives the recent events already emitted, up to the last 64. `eventStream` carries accepted
events; `blockedEventStream` carries events blocked by consent or the allow-list and also fires the
`onEventBlocked` config callback. This is the programmatic observer the quick start pointed to:
collect `eventStream` to assert on the accepted `screen` event in code instead of reading logcat. Keep
any downstream destination consent checks in your app before forwarding.

1. Call `client.track(...)` from the composable event handler that owns the business action, after
   event consent is accepted or an approved `allowedEventTypes` policy permits `track`.
2. Collect `client.eventStream` in debug surfaces or test-only composables that inspect emitted events.
3. Collect `client.blockedEventStream` or pass `onEventBlocked` when validating consent gates.
4. Apply your destination consent policy before forwarding SDK context to another analytics tool.

**Adapt this to your use case:**

```kotlin
@Composable
fun PurchaseButton() {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()
    val scope = rememberCoroutineScope()
    // Replace this gate with your app-owned policy if track is explicitly allow-listed.
    val canTrackPurchase = state.consent == true

    Button(
        enabled = canTrackPurchase,
        onClick = {
            scope.launch {
                // Custom events are blocked until event consent is accepted unless allow-listed.
                client.track(event = "Purchase Completed", properties = mapOf("sku" to "sku-1"))
            }
        },
    ) {
        Text("Purchase")
    }
}
```

**Adapt this to your use case:**

```kotlin
@Composable
fun AnalyticsDebugPanel() {
    val client = LocalOptimizationClient.current
    var latestType by remember { mutableStateOf("none") }

    LaunchedEffect(client) {
        // eventStream replays its recent buffer, so a collector that attaches after an event
        // fired still receives it; forward downstream only after your own consent checks.
        client.eventStream.collect { event ->
            latestType = event["type"] as? String ?: "unknown"
        }
    }

    Text("Most recent SDK event: $latestType")
}
```

For cross-SDK forwarding patterns, see
[Forwarding Optimization SDK context to analytics and tag management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Custom Flags and MergeTag rendering

**Integration category:** Optional

Custom Flags and merge tags read profile-backed values the Experience API returns, separately from
entry variant selection. `client.getFlag(name)` is a one-time, non-reactive JSON read that returns
`null` before initialization; `client.observeFlag(name)` returns a `StateFlow<JSONValue?>` (the Android
idiom — the iOS SDK uses a Combine publisher) that updates as the flag value changes. Subscribing to a
flag registers an observation that emits a `component` flag-view event through the event stream when
consent and profile allow, so flag delivery is an analytics exposure — apply the same governance you
use for other SDK events.

`client.getMergeTagValue(mergeTagEntry)` is a suspend call that resolves an inline `nt_mergetag` entry
— the SDK-owned merge-tag content-model identifier — against the current profile and returns the
resolved string, or `null` when it cannot resolve (also `null` before initialization). Your app owns
extracting the embedded `nt_mergetag` entry from Rich Text before calling it, and owns where the value
renders.

1. Use `client.getFlag(name)` for a one-time flag read after the SDK is initialized.
2. Use `client.observeFlag(name)` when Compose state must follow flag changes.
3. Resolve Rich Text `nt_mergetag` entries with `client.getMergeTagValue(mergeTagEntry)` after your
   fetcher has inlined the target entry.
4. Provide app-owned fallback rendering when a flag or merge-tag value is missing.

**Adapt this to your use case:**

```kotlin
@Composable
fun BooleanFlagBadge() {
    val client = LocalOptimizationClient.current
    // Observing a flag emits a flag-view component event for delivered values.
    val flagValue = remember { client.observeFlag("boolean") }.collectAsState()

    Text("Flag value: ${flagValue.value}")
}
```

**Follow this pattern:**

```kotlin
suspend fun resolveMergeTagText(
    client: OptimizationClient,
    mergeTagEntry: Map<String, Any>,
): String {
    // Keep fallback copy in the app so an unresolved merge tag does not break rendering.
    return client.getMergeTagValue(mergeTagEntry)
        ?: readFallbackValue(mergeTagEntry)
        ?: "[Merge Tag]"
}
```

The Android reference implementation resolves Rich Text merge tags with `getMergeTagValue(...)` and
asserts the rendered text in the shared Maestro variant flows.

### Live updates

**Integration category:** Optional

By default, `OptimizedEntry` locks to the first variant it resolves so content does not change while a
visitor is reading it. Enable live updates when a screen needs mounted entries to react to profile
changes or preview overrides without a reload.

1. Set `liveUpdates = true` on `OptimizationRoot` when most mounted entries in the tree must update as
   SDK state changes.
2. Set `liveUpdates = true` on an individual `OptimizedEntry` for a localized live section.
3. Set `liveUpdates = false` on an individual `OptimizedEntry` to keep it locked even under a live
   global default.
4. Expect the preview panel to force live updates while it is open so overrides apply immediately.

**Adapt this to your use case:**

```kotlin
OptimizationRoot(config = config, liveUpdates = true) {
    // Mounted entries inherit live updates unless they set their own liveUpdates value.
    AppNavGraph()
}
```

**Adapt this to your use case:**

```kotlin
OptimizedEntry(
    entry = dashboardEntry,
    // Use per-entry live updates for content that must follow profile or preview changes.
    liveUpdates = true,
) { resolvedEntry ->
    Dashboard(entry = resolvedEntry)
}
```

The resolution order is: an open preview panel forces live updates (overriding an explicit
`liveUpdates = false`), then a per-entry `liveUpdates` value, then the `OptimizationRoot` `liveUpdates`
default, then the locked default. When the preview panel closes, a locked `OptimizedEntry` snapshots
the current selections so applied overrides persist. For the precedence rules, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

### Preview panel

**Integration category:** Optional

Use the preview panel only in debug or internal builds. `PreviewPanelConfig(enabled, contentfulClient)`
is the Compose path: `OptimizationRoot(previewPanel = ...)` wraps content in `PreviewPanelOverlay` (a
floating action button plus a `ModalBottomSheet`) for you. Pass a `PreviewContentfulClient` so the
panel can fetch the SDK-owned `nt_audience` and `nt_experience` definitions and show audience and
experience names; without one the panel still opens but is degraded — it shows "No audience data" and
falls back to raw identifiers in override summaries.

1. Pass `PreviewPanelConfig` to `OptimizationRoot` only for builds that can expose preview tooling.
2. Pass a `PreviewContentfulClient` when the panel needs audience and experience names.
3. Use `ContentfulHTTPPreviewClient` for a direct CDA-backed panel, or implement `PreviewContentfulClient`
   around your existing Contentful client.
4. Verify the floating action button is absent from production release variants.

**Adapt this to your use case:**

```kotlin
val previewContentfulClient = ContentfulHTTPPreviewClient(
    spaceId = "<space-id>",
    accessToken = "<delivery-api-token>",
    environment = "main",
)

OptimizationRoot(
    config = config,
    previewPanel = if (BuildConfig.DEBUG) {
        // Keep preview tooling and credentials out of public release builds.
        PreviewPanelConfig(contentfulClient = previewContentfulClient)
    } else {
        null
    },
) {
    AppNavGraph()
}
```

The panel's floating action button and sheet live in the Compose tree created by `OptimizationRoot`.
The Android reference implementation uses `PreviewPanelConfig(contentfulClient = ...)` and runs shared
Maestro flows for panel visibility, profile data, refresh behavior, and audience or variant overrides.

## Advanced integrations

### Strict event policy and queue controls

**Integration category:** Advanced or production-only

Use strict event policy controls only after privacy review defines which events can emit before consent
and how blocked or queued events are observed.

1. Set `allowedEventTypes = emptyList()` when no Optimization events can emit before consent.
2. Configure a narrow allow-list only for event types approved by your product and privacy policy.
3. Use `onEventBlocked` or collect `blockedEventStream` to verify consent or `allowedEventTypes` blocks
   during development.
4. Use `QueuePolicy` only when the default queue behavior needs production-specific limits or
   diagnostics.

Use these `allowedEventTypes` selectors when allow-listing Android events:

| Selector          | Allows                                         |
| ----------------- | ---------------------------------------------- |
| `identify`        | Identity Experience events                     |
| `page`            | Page Experience events from `client.page(...)` |
| `screen`          | Screen Experience events                       |
| `track`           | Custom business events from `track(...)`       |
| `component`       | Entry view events and flag-view payloads       |
| `component_click` | Entry tap events                               |
| `flag`            | Custom Flag view tracking without all views    |

Android does not expose hover tracking; `component_hover` applies only to SDKs that support hover, such
as Web and Node. For the cross-SDK selector list and consent behavior, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md#event-allow-lists-and-blocked-events).

**Adapt this to your use case:**

```kotlin
val strictConfig = OptimizationConfig(
    clientId = "<your-client-id>",
    // Empty means no SDK events are allowed before explicit consent.
    allowedEventTypes = emptyList(),
    queuePolicy = QueuePolicy(
        offlineMaxEvents = 100,
        onOfflineDrop = { event -> logDroppedOptimizationEvent(event) },
    ),
    // Blocked events are for verification; they are not re-sent after later consent.
    onEventBlocked = { blockedEvent -> logBlockedOptimizationEvent(blockedEvent) },
)
```

Blocked events are dropped at the SDK boundary and are not re-sent after `consent(true)`. The
`blockedEventStream` is a diagnostic only — being replay-buffered, a late subscriber still sees recent
blocked entries, but observing a blocked event does not deliver it. Keep any application-owned retry or
forwarding behavior aligned with your consent policy.

### Offline delivery and lifecycle flushing

**Integration category:** Advanced or production-only

After initialization the SDK monitors network reachability and app lifecycle. A `NetworkMonitor`
(`ConnectivityManager`) calls `setOnline(...)` on connectivity changes and `flush()` on reconnect; an
`AppLifecycleHandler` (a `ProcessLifecycleOwner` observer) calls `flush()` when the app moves to the
background for a best-effort drain. Queues are in-memory only — there is no durable outbox — and the
offline Experience buffer is capped at 100 events by default (tunable via `QueuePolicy.offlineMaxEvents`);
nothing survives process death.

1. Let the SDK manage normal network and lifecycle handling after `OptimizationRoot` initializes the
   client.
2. Call `client.flush()` only from explicit app-owned delivery checkpoints or tests.
3. Use `client.setOnline(...)` only for deterministic test or diagnostic flows, not as a replacement
   for the SDK network monitor.
4. Validate offline-sensitive release behavior with deterministic SDK controls or platform tests
   instead of relying on unstable emulator network toggles.

**Follow this pattern:**

```kotlin
LaunchedEffect(Unit) {
    // Deterministic network controls, for tests or diagnostics only.
    client.consent(true) // Accept event consent before queueing a custom track event.
    client.setOnline(false)
    client.track(event = "Queued Event")
    client.setOnline(true)
    client.flush()
}
```

For runtime details, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#offline-and-app-lifecycle-delivery).

### Content caching and hybrid continuity boundaries

**Integration category:** Advanced or production-only

Native Compose apps do not use the Node or browser hybrid-continuity model. The Android SDK stores SDK
consent and profile-continuity state in `SharedPreferences`, but it does not own app Contentful response
caches, server cookies, or SSR-to-browser anonymous-id handoff, and there is no built-in cross-platform
id handoff.

1. Keep Contentful response caching in the application fetching layer.
2. Include the application Contentful locale and entry IDs in cache keys when localized content can
   differ.
3. Invalidate or refetch cached Contentful entries when the app locale changes.
4. Do not treat Android `StorageDefaults` as a replacement for server-side profile persistence or
   cross-device account identity.

For server and browser continuity patterns, use the web and Node guides instead of this native Compose
guide.

## Production checks

Before releasing a Compose integration, verify these points against the target app build:

- **Credentials and runtime configuration** — the app uses the intended Optimization client ID,
  Contentful environment, SDK Experience/event locale, Android `minSdk`, Java bytecode level, Maven
  artifact version, and any approved Experience API or Insights API endpoint overrides; mock or
  localhost base URLs are absent from production configuration.
- **Consent behavior** — default-on accepted startup is used only when policy permits it; user-choice
  flows call `consent(true | false)`; split event/persistence consent matches your persistence policy;
  and rejected consent blocks non-allowed event types, consistently across app relaunches.
- **Event delivery** — screen, entry view, entry tap, Custom Flag, and custom business events are
  accepted or blocked according to consent state, blocked calls appear in diagnostics, queued events
  flush on reconnection or backgrounding, and forwarded events honor downstream consent policy.
- **Content fallback behavior** — entries are fetched with one CDA locale and enough include depth for
  optimized entries, and unresolved links, all-locale payloads, missing selected optimizations, and
  out-of-range variants render baseline content instead of crashing.
- **Duplicate-tracking prevention** — the app mounts one `OptimizationRoot` for the active SDK tree,
  places screen tracking at route roots with one path per route, avoids nesting multiple SDK tap
  wrappers around the same surface, and uses `OptimizationLazyColumn` for list entry view tracking.
- **Privacy and governance** — preview tooling and preview credentials are gated to debug or internal
  builds, SDK consent is not used as the consent record, forwarded analytics payloads apply destination
  consent and do not replay blocked events, and profile reset or consent withdrawal clears the
  app-owned identifiers that policy requires.
- **Local validation path** — validate against the Android reference implementation or your app's own
  targeted Compose instrumentation flow before relying on production telemetry.

**Reference excerpt:**

```bash
# These run against this repository's maintained Android reference implementation, not your app.
# SDK unit tests, from packages/android/ContentfulOptimization:
./gradlew testDebugUnitTest
# Targeted Compose Maestro suites, from the monorepo root:
pnpm implementation:run -- android-sdk test:e2e:compose -- --flow <suite>
```

## Troubleshooting

| Symptom                                | Likely cause                                                                                                            | Check                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `No OptimizationClient provided`       | A composable called SDK helpers outside `OptimizationRoot`.                                                             | Move the composable under the `OptimizationRoot` that owns the SDK client.                                         |
| Entries always render baseline content | The entry is not optimized, selected optimizations are missing, links are unresolved, or the CDA payload is all-locale. | Verify consent, a `screen` or `identify` event, `include` depth, a concrete `locale`, and `fields.nt_experiences`. |
| Entry view or tap events are missing   | Tracking was opted out, consent does not permit `trackView`/`trackClick`, or the list lacks a scroll context.           | Confirm `trackViews`/`trackTaps`, consent, the dwell threshold, and `OptimizationLazyColumn` for lists.            |
| Screen events duplicate or go missing  | `ScreenTrackingEffect` is placed in repeated child composables, or more than one path tracks the route.                 | Place the effect at the route or destination root, keep names stable, and use one screen-tracking path.            |
| Preview panel shows identifiers only   | No `PreviewContentfulClient` was passed, so the panel cannot fetch definitions.                                         | Pass a `PreviewContentfulClient` so the panel fetches `nt_audience`/`nt_experience` and shows names.               |

## Reference implementations to compare against

- [Android reference implementation](../../implementations/android-sdk/README.md) — the maintained
  Compose and Android Views shells that exercise native Android bridge behavior, single-locale CDA
  fetching, entry resolution, interaction tracking, screen tracking, live updates,
  `getMergeTagValue(...)`, Custom Flags, event diagnostics, and preview-panel overrides against the
  same mock API.
  </content>
  </invoke>
