# Integrating the Optimization Android SDK in a Jetpack Compose app

Use this guide when you want to add Optimization, Analytics, screen tracking, entry interaction
tracking, Custom Flags, MergeTag rendering, and preview overrides to a native Android application
built with Jetpack Compose.

The Optimization SDK looks at the current visitor and decides which content variant to show, then
swaps the baseline entry your app fetched for the selected variant. Your application provides the
Contentful entries (fetched from the Delivery API), a consent policy that tells the SDK whether it
may track and personalize, and the locale string used for Contentful CDA requests. The SDK handles
variant selection; your app handles fetching, rendering, and consent UI.

The Compose integration uses `OptimizationRoot`, `OptimizedEntry`, `OptimizationLazyColumn`, and
`ScreenTrackingEffect`. Your application still owns Contentful entry fetching, consent policy,
identity policy, navigation, app-owned caching, and final rendering. Use the Android Views guide
instead when your app is View-based:
[Integrating the Optimization Android SDK in an Android Views app](./integrating-the-optimization-android-sdk-in-a-views-app.md).

## Before you start

- An Optimization client ID from your Contentful Optimization workspace.
- A Contentful space with at least one entry that has optimization data. The entry must include
  `nt_experiences` and `nt_variants` fields linked to optimization and variant entries.
- Contentful space ID, environment name (usually `main`), and a Delivery API access token.
- The application locale string you use for Contentful CDA requests (for example, `en-US`).
- Android Studio installed.

## Quick start

Use this path when your application policy permits Optimization to start with accepted consent. If
your policy requires an end-user choice first, complete the consent handoff section before sending
an accepted SDK event.

1. Add the Android SDK from Maven Central to your Android application module.

   **Copy this:**

   ```kotlin
   repositories {
       mavenCentral()
   }

   dependencies {
       implementation("com.contentful.java:optimization-android:<version>")
   }
   ```

2. Configure the SDK with accepted startup consent, mount `OptimizationRoot`, and emit one screen
   event from the first Compose route.

   **Adapt this to your use case:**

   ```kotlin
   import androidx.compose.runtime.Composable
   import com.contentful.optimization.compose.OptimizationRoot
   import com.contentful.optimization.compose.ScreenTrackingEffect
   import com.contentful.optimization.core.OptimizationConfig
   import com.contentful.optimization.core.OptimizationLogLevel
   import com.contentful.optimization.core.StorageDefaults

   val optimizationConfig = OptimizationConfig(
       clientId = "your-optimization-client-id",
       environment = "main",
       // Use this default only when your app policy permits accepted consent at startup.
       defaults = StorageDefaults(consent = true),
       logLevel = if (BuildConfig.DEBUG) OptimizationLogLevel.debug else OptimizationLogLevel.error,
   )

   @Composable
   fun AppRoot() {
       OptimizationRoot(
           config = optimizationConfig,
           // Own one SDK client for the Compose tree that emits Optimization events.
       ) {
           HomeScreen()
       }
   }

   @Composable
   fun HomeScreen() {
       // Emit one screen event from the route root, not from repeated child composables.
       ScreenTrackingEffect(screenName = "Home")
       HomeContent()
   }
   ```

3. Verify the first run. If it worked, the SDK diagnostics or debug logs show one accepted screen or
   page event.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
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

## Required setup

Use this setup inventory before you move beyond the quick start:

| Setup item                                                                                   | Category                       | Required for quick start | Where to configure                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ | ----------------------------------------------------------------------------------- |
| Android app module using Jetpack Compose, Android `minSdk` 24 or later, and Java 11 bytecode | Required for first integration | Yes                      | Android application Gradle configuration                                            |
| Maven Central repository and `com.contentful.java:optimization-android` dependency           | Required for first integration | Yes                      | Application Gradle repositories and dependencies                                    |
| Optimization client ID and environment                                                       | Required for first integration | Yes                      | `OptimizationConfig`, usually from app runtime configuration                        |
| Experience API and Insights API endpoint overrides                                           | Common but policy-dependent    | No                       | `OptimizationApiConfig` for staging, mock, or non-default hosts                     |
| Contentful Delivery API client, space, environment, access token, and CDA host               | Required for first integration | No                       | Application-owned Contentful fetching layer                                         |
| Optimized Contentful entries with linked `nt_experiences` and variant data                   | Required for first integration | No                       | Contentful content model, entries, and CDA `include` depth                          |
| Single Contentful CDA locale and SDK Experience/event locale                                 | Required for first integration | No                       | App locale policy, Contentful requests, and `OptimizationConfig.locale`             |
| `OptimizationRoot` mounted around the Compose tree that uses SDK helpers                     | Required for first integration | Yes                      | Compose app root, navigation root, or feature root                                  |
| Screen, route, or lifecycle tracking hook                                                    | Required for first integration | Yes                      | `ScreenTrackingEffect` or app-owned client calls in Compose screen lifecycle        |
| Accepted consent startup policy or user-choice handoff                                       | Common but policy-dependent    | Yes                      | `StorageDefaults`, `allowedEventTypes`, and application consent UI or CMP callbacks |
| Entry view and tap tracking policy                                                           | Common but policy-dependent    | No                       | `OptimizationRoot` tracking defaults and per-entry `OptimizedEntry` options         |
| User identity, profile continuity, and reset policy                                          | Common but policy-dependent    | No                       | Account, session, or settings screens that call `identify(...)` and `reset()`       |
| Custom business events and analytics diagnostics                                             | Optional                       | No                       | `track(...)`, `eventStream`, `blockedEventStream`, and app-owned forwarding code    |
| Custom Flags and MergeTag rendering                                                          | Optional                       | No                       | Components that call `getFlag(...)`, `observeFlag(...)`, or `getMergeTagValue(...)` |
| Live updates for mounted entries                                                             | Optional                       | No                       | `OptimizationRoot.liveUpdates` and per-entry `OptimizedEntry.liveUpdates`           |
| Preview panel and preview-definition Contentful client                                       | Optional                       | No                       | `PreviewPanelConfig`, `PreviewContentfulClient`, and debug or internal-build gates  |
| Strict pre-consent allow-list, queue policy, and blocked-event diagnostics                   | Advanced or production-only    | No                       | `OptimizationConfig.allowedEventTypes`, `queuePolicy`, and `onEventBlocked`         |
| Offline, lifecycle, and local reference-app validation path                                  | Advanced or production-only    | No                       | Release checks, Android reference implementation, and targeted Maestro suites       |

The Android SDK does not fetch Contentful entries for your application UI. Fetch entries in the
application layer, then pass single-locale entry maps to `OptimizedEntry` or
`client.resolveOptimizedEntry(...)`.

## Core integration

### Install and initialize `OptimizationRoot`

**Integration category:** Required for first integration

`OptimizationRoot` is the normal Compose entry point. It creates an `OptimizationClient`, calls
`initialize(config)`, provides the initialized client through `LocalOptimizationClient`, applies
tracking defaults to descendant `OptimizedEntry` components, and renders a loading indicator until
the client is ready. For package status and installation details, see the
[Optimization Android SDK README](../../packages/android/README.md).

1. Configure Maven Central in the consuming Android build.
2. Add `com.contentful.java:optimization-android` to the application module.
3. Create one `OptimizationConfig` with the Optimization client ID, environment, and SDK
   Experience/event locale.
4. Pass endpoint overrides only when your app uses staging, mock, or non-default API hosts.
5. Wrap the Compose tree that uses SDK helpers in `OptimizationRoot`.
6. Read `LocalOptimizationClient.current` inside descendant composables that call SDK methods
   directly.

**Copy this:**

```kotlin
dependencies {
    implementation("com.contentful.java:optimization-android:<version>")
}
```

**Adapt this to your use case:**

```kotlin
import androidx.compose.runtime.Composable
import com.contentful.optimization.compose.OptimizationRoot
import com.contentful.optimization.core.OptimizationApiConfig
import com.contentful.optimization.core.OptimizationConfig

val config = OptimizationConfig(
    clientId = "your-optimization-client-id",
    environment = "main",
    api = OptimizationApiConfig(
        experienceBaseUrl = "https://experience.ninetailed.co/",
        insightsBaseUrl = "https://ingest.insights.ninetailed.co/",
    ),
    locale = "en-US",
)

@Composable
fun AppRoot() {
    // Mount once around the Compose subtree that shares this SDK client.
    OptimizationRoot(
        config = config,
    ) {
        AppNavGraph()
    }
}
```

`OptimizationClient` exposes async work as `suspend` functions and state as Kotlin flows. Call
suspending methods from Compose effects, event-handler coroutine scopes, lifecycle-aware coroutines,
or another app-owned coroutine scope. For lifecycle details, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-coroutines).

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

Consent policy remains application-owned. Use the default accepted startup path only when
application policy permits Optimization by default and no end-user consent UI is rendered.
Otherwise, leave consent unset and connect your CMP, account preference, or in-app banner to the
SDK.

1. Seed accepted consent with `StorageDefaults(consent = true)` when policy permits default-on
   Optimization.
2. Leave consent unset when the app needs to collect a user decision first.
3. Call `client.consent(true)` after the visitor accepts and `client.consent(false)` after the
   visitor rejects.
4. Use split consent when events can emit but durable profile continuity must stay session-only.
5. Read `client.state` when consent UI needs to reflect SDK state across app launches.

**Copy this:**

```kotlin
val defaultOnConfig = OptimizationConfig(
    clientId = "your-optimization-client-id",
    // Use default accepted consent only when your app does not need a prior user choice.
    defaults = StorageDefaults(consent = true),
)
```

**Adapt this to your use case:**

```kotlin
@Composable
fun ConsentControls(content: @Composable () -> Unit) {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()

    if (state.consent == null) {
        Row {
            // Wire these calls to your CMP or privacy UI, not to SDK-owned policy.
            Button(onClick = { client.consent(true) }) {
                Text("Accept")
            }
            Button(onClick = { client.consent(false) }) {
                Text("Reject")
            }
        }
    } else {
        content()
    }
}
```

By default, mobile `identify` and screen events can emit before event consent is accepted. Entry
views, entry taps, `page` (which tells the SDK which page the visitor is viewing so it can evaluate
personalization for that page), and custom `track` events are blocked until consent is accepted or
their event types are allow-listed. Boolean consent calls control both event emission and durable
profile continuity. Use this form when events can emit but profile, selected optimizations (the list
of content variants the SDK has picked for this visitor), changes, and anonymous identity must stay
session-only:

**Copy this:**

```kotlin
client.consent(events = true, persistence = false)
```

For cross-SDK policy details, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful entry fetching and locale shape

**Integration category:** Required for first integration

Your app owns Contentful fetching. The SDK resolver expects standard single-locale Contentful CDA
entry maps with direct field values and linked optimization entries already resolved in the payload.

1. Choose the application Contentful locale from your native app state, navigation, i18n, or account
   preference layer.
2. Pass the same locale to `OptimizationConfig.locale` when Experience API responses and event
   context need to stay aligned with rendered Contentful content.
3. Fetch optimized entries with one concrete CDA locale, not `locale=*`.
4. Include linked entries deeply enough for `fields.nt_experiences`, optimization config, and linked
   variant entries.
5. Pass the resulting `Map<String, Any>` entry objects to SDK helpers.

**Adapt this to your use case:**

```kotlin
@Composable
fun HomeScreen(contentfulClient: ContentfulDeliveryClient) {
    val appLocale = getAppLocale()
    var entries by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }

    LaunchedEffect(appLocale) {
        // Fetch one CDA locale and enough linked entries for nt_experiences and variants.
        entries = contentfulClient.fetchEntries(
            ids = listOf("hero-entry-id", "cta-entry-id"),
            include = 10,
            locale = appLocale,
        )
    }

    HomeContent(entries = entries)
}
```

The SDK top-level `locale` does not modify your Contentful client or refetch content after locale
changes. For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).
For the single-locale CDA shape and fallback rules, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Entry resolution and fallback rendering

**Integration category:** Required for first integration

`OptimizedEntry` resolves a Contentful entry against the selected variants for the visitor, passes
non-optimized entries through unchanged, and falls back to the baseline entry when optimization data
is missing, unresolved, out of range, or not selected for the visitor. The render lambda receives
the entry map your app must convert into its own view model or Compose hierarchy.

1. Render each optimized Contentful entry through `OptimizedEntry`.
2. Keep field parsing and UI rendering in application components.
3. Use `accessibilityIdentifier` when tests or accessibility tooling need a stable wrapper
   identifier.
4. Use `client.resolveOptimizedEntry(...)` (which picks the correct variant entry from the list of
   selected optimizations, or returns the baseline entry when no match exists) directly only when a
   custom UI abstraction needs the same local resolver without the Compose wrapper.

**Adapt this to your use case:**

```kotlin
@Composable
fun HeroSection(entry: Map<String, Any>) {
    OptimizedEntry(
        entry = entry,
        accessibilityIdentifier = "home-hero-optimization",
    ) { resolvedEntry ->
        // Always render the resolved entry; the SDK returns the baseline when no variant is usable.
        HeroCard(entry = resolvedEntry)
    }
}
```

**Follow this pattern:**

```kotlin
LaunchedEffect(entry) {
    // Direct resolution is for custom abstractions that cannot use the Compose wrapper.
    client.selectedOptimizations.collect { selectedOptimizations ->
        val result = client.resolveOptimizedEntry(
            baseline = entry,
            selectedOptimizations = selectedOptimizations,
        )

        resolvedEntry = result.entry
    }
}
```

Collect `selectedOptimizations` inside the effect when custom UI must re-resolve after profile (the
visitor identity state maintained by the SDK), preview, or consent-driven selection changes. Reading
`client.selectedOptimizations.value` only captures the current snapshot.

The resolver does not fetch Contentful entries, evaluate audiences, call the Experience API, or
mutate state. It joins the current selected optimization metadata with linked entries already
present in the Contentful payload. For deeper mechanics, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md).

### Screen and navigation tracking

**Integration category:** Required for first integration

Compose apps track native screens from composable lifecycle. `ScreenTrackingEffect` emits the
current screen through the SDK and rechecks consent state, so an active screen can emit after
tracking becomes allowed.

1. Call `ScreenTrackingEffect` once from the root composable for each route or screen destination.
2. Use stable screen names that match your analytics taxonomy.
3. For dynamic names or data-dependent properties, call `client.trackCurrentScreen(...)` from a
   `LaunchedEffect`.
4. Keep screen tracking at the route root to avoid duplicate events from repeated child composition.

**Copy this:**

```kotlin
@Composable
fun HomeScreen() {
    // Put screen tracking at the destination root to prevent duplicate screen events.
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
        // Key dynamic screens by route identity so navigation changes emit in sequence.
        client.trackCurrentScreen(
            name = "BlogPostDetail",
            properties = mapOf("postId" to postId),
            routeKey = "blog-post-$postId",
        )
    }

    DetailsContent(postId = postId)
}
```

The Android reference implementation exercises screen tracking with Compose Navigation and asserts
the visited sequence through the SDK event stream.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizationRoot` defines global tracking defaults. `OptimizedEntry` can override those defaults
per entry. View and tap tracking default to on; pass `trackViews = false` or `trackTaps = false`
globally or per entry when a surface must opt out.

1. Leave view and tap tracking enabled for entries that need exposure and interaction analytics.
2. Disable tap tracking where the wrapped entry does not represent a meaningful interaction.
3. Use `OptimizationLazyColumn` for `LazyColumn` content so entry visibility uses the list viewport.
4. Tune `minVisibleRatio`, `dwellTimeMs`, or `viewDurationUpdateIntervalMs` per entry only when the
   default timing does not match the component.
5. Avoid wrapping the same clickable surface with both SDK tap tracking and another SDK tap call.

**Copy this:**

```kotlin
OptimizationRoot(
    config = config,
    // Opt out globally only when this screen must not emit tap analytics.
    trackTaps = false,
) {
    AppNavGraph()
}
```

**Adapt this to your use case:**

```kotlin
OptimizationLazyColumn {
    items(entries) { entry ->
        OptimizedEntry(
            entry = entry,
            // Avoid adding another SDK tap call around this same clickable surface.
            onTap = { resolvedEntry -> navigateToEntry(resolvedEntry) },
        ) { resolvedEntry ->
            CtaCard(entry = resolvedEntry)
        }
    }
}
```

Entry view tracking emits after 2 seconds at 80% visibility, sends duration updates every 5 seconds
while visible, and sends a final duration update when the entry leaves view after a view event has
already fired. For timing and event-delivery details, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

### Identity, profile continuity, and reset

**Integration category:** Common but policy-dependent

Identity policy belongs to your application. Use SDK identity methods only after your product,
privacy, and account logic decides which user ID and traits can be sent. Android persists consent
and profile-continuity state in `SharedPreferences` when persistence consent permits it.

1. Call `identify(...)` from an authenticated account flow or another approved identity moment.
2. Read `client.state`, `selectedOptimizations`, and `optimizationPossible` from Compose state when
   UI needs to reflect SDK state.
3. Call `reset()` when the active SDK profile must be cleared from the current session.
4. Keep application-owned account IDs, server cookies, and third-party destination identifiers in
   the systems that own them.

**Adapt this to your use case:**

```kotlin
@Composable
fun AccountControls() {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()
    val scope = rememberCoroutineScope()

    Column {
        Text("Consent: ${state.consent}")
        Button(
            onClick = {
                scope.launch {
                    // Send identity only after your app's account and privacy policy approves it.
                    client.identify(
                        userId = "user-123",
                        traits = mapOf("plan" to "pro"),
                    )
                }
            },
        ) {
            Text("Identify")
        }
        Button(onClick = { client.reset() }) {
            Text("Reset")
        }
    }
}
```

When durable profile continuity is allowed, the SDK stores profile, selected optimizations, changes,
and anonymous ID before it publishes the corresponding state update. Tests can wait for SDK state
instead of adding storage-delay sleeps before relaunching the app.

## Optional integrations

### Custom events and analytics diagnostics

**Integration category:** Optional

Use `track(...)` for app-owned business events. Use `eventStream` and `blockedEventStream` for debug
surfaces, tests, and application-owned analytics forwarding. The SDK does not configure third-party
analytics destinations for you.

1. Call `track(...)` from the application event handler that owns the business action after event
   consent is accepted or an approved `allowedEventTypes` policy permits `track`.
2. Subscribe to `eventStream` in debug surfaces or test-only views that need to inspect emitted
   events.
3. Subscribe to `blockedEventStream` or pass `onEventBlocked` when validating consent gates.
4. Apply your destination consent policy before forwarding SDK context to another analytics tool.

**Adapt this to your use case:**

```kotlin
@Composable
fun PurchaseButton() {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()
    val scope = rememberCoroutineScope()
    // Replace this gate with your app-owned policy if `track` is explicitly allow-listed.
    val canTrackPurchase = state.consent == true

    Button(
        enabled = canTrackPurchase,
        onClick = {
            scope.launch {
                client.track(
                    // Custom events are blocked until event consent is accepted unless allow-listed.
                    event = "Purchase Completed",
                    properties = mapOf("sku" to "sku-1"),
                )
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
    var latestEvent by remember { mutableStateOf<Map<String, Any>?>(null) }

    LaunchedEffect(client) {
        // Use this stream for diagnostics or app-owned forwarding after downstream consent checks.
        client.eventStream.collect { event ->
            latestEvent = event
        }
    }

    val latestType = latestEvent?.get("type") ?: "none"
    Text("Most recent SDK event: $latestType")
}
```

For destination mapping patterns, see
[Forwarding Optimization SDK context to analytics and tag management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Custom Flags and MergeTag rendering

**Integration category:** Optional

Custom Flags and MergeTag helpers read profile-backed values from the same initialized
`OptimizationClient`. Use them inside components that already run under `OptimizationRoot`.

1. Use `client.getFlag(name)` for a one-time flag read.
2. Use `client.observeFlag(name)` when a component needs a `StateFlow` that updates with flag value
   changes.
3. Use `client.getMergeTagValue(mergeTagEntry)` while rendering Contentful Rich Text that includes
   resolved `nt_mergetag` entries.
4. Provide application fallback text when a merge tag is unresolved, missing, or unavailable for the
   active profile.

**Adapt this to your use case:**

```kotlin
@Composable
fun BooleanFlagBadge() {
    val client = LocalOptimizationClient.current
    // Observed flags emit flag-view events for delivered values.
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
    // Keep fallback copy in the app so unresolved merge tags do not break rendering.
    return client.getMergeTagValue(mergeTagEntry)
        ?: readFallbackValue(mergeTagEntry)
        ?: "[Merge Tag]"
}
```

The Android reference implementation resolves Rich Text merge tags with `getMergeTagValue(...)` and
asserts the rendered text in the shared Maestro variant flows.

### Live updates

**Integration category:** Optional

By default, `OptimizedEntry` locks to the first variant it resolves so content does not change while
a visitor is reading it. Enable live updates when a screen needs mounted entries to react to profile
changes or preview overrides without a reload.

1. Set `OptimizationRoot(liveUpdates = true)` when mounted entries inherit live updates by default.
2. Set `OptimizedEntry(liveUpdates = true)` for an entry that must update even when the global
   default is locked.
3. Set `OptimizedEntry(liveUpdates = false)` for an entry that must stay locked even when the global
   default is live.
4. Treat the preview panel as a live-update override while it is open.

**Copy this:**

```kotlin
OptimizationRoot(
    config = config,
    // Mounted entries inherit live updates unless they set their own liveUpdates value.
    liveUpdates = true,
) {
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

When the preview panel closes, locked entries keep the previewed selected optimization as their
locked value. For precedence rules, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

### Preview panel

**Integration category:** Optional

The preview panel is a developer and internal-review tool. Gate it behind debug or internal-build
configuration, and keep preview credentials out of public release builds.

1. Pass `PreviewPanelConfig` to `OptimizationRoot` only for builds that can expose preview tooling.
2. Pass a `PreviewContentfulClient` when the panel needs audience and experience names.
3. Omit `contentfulClient` when identifier-only preview data is enough.
4. Verify the floating action button is absent from production release variants.

**Adapt this to your use case:**

```kotlin
val previewContentfulClient = ContentfulHTTPPreviewClient(
    spaceId = "your-space-id",
    accessToken = "your-contentful-delivery-token",
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
The Android reference implementation uses `PreviewPanelConfig(contentfulClient = ...)` and runs
shared Maestro flows for panel visibility, profile data, refresh behavior, and audience or variant
overrides.

## Advanced integrations

### Strict event policy and queue controls

**Integration category:** Advanced or production-only

Use strict event policy controls only after privacy review defines which events can emit before
consent and how blocked or queued events are observed.

1. Set `allowedEventTypes = emptyList()` when no Optimization events can emit before consent.
2. Configure a narrow allow-list only for event types approved by your product and privacy policy.
3. Use `onEventBlocked` or `blockedEventStream` to verify consent or `allowedEventTypes` blocks
   during development.
4. Use `QueuePolicy` only when the default queue behavior needs production-specific limits or
   diagnostics.

Use these `allowedEventTypes` selectors exactly when allow-listing Android events:

| Selector          | Allows                                         |
| ----------------- | ---------------------------------------------- |
| `identify`        | Identity Experience events                     |
| `page`            | Page Experience events from `client.page(...)` |
| `screen`          | Screen Experience events                       |
| `track`           | Custom business events from `track(...)`       |
| `component`       | Entry view events and flag-view payloads       |
| `component_click` | Entry tap events                               |
| `flag`            | Custom Flag view tracking without all views    |

Android does not expose hover tracking. `component_hover` applies to SDKs that support hover, such
as Web and Node.

For the cross-SDK selector list and consent behavior, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md#event-allow-lists-and-blocked-events).

**Adapt this to your use case:**

```kotlin
val strictConfig = OptimizationConfig(
    clientId = "your-optimization-client-id",
    // Empty means no SDK events are allowed before explicit consent.
    allowedEventTypes = emptyList(),
    queuePolicy = QueuePolicy(
        offlineMaxEvents = 100,
        onOfflineDrop = { event ->
            logDroppedOptimizationEvent(event)
        },
    ),
    // Blocked events are for verification; they are not replayed after later consent.
    onEventBlocked = { blockedEvent ->
        logBlockedOptimizationEvent(blockedEvent)
    },
)
```

Blocked events are dropped at the SDK boundary and are not replayed after `consent(true)`. Keep any
application-owned retry or forwarding behavior aligned with your consent policy.

### Offline delivery and lifecycle flushing

**Integration category:** Advanced or production-only

The Android SDK monitors network reachability and process lifecycle after initialization. Events
queue in memory while the device is offline, flush when connectivity returns, and flush when the app
moves toward the background.

1. Let the SDK manage normal network and lifecycle handling after `OptimizationRoot` initializes the
   client.
2. Call `flush()` only from explicit app-owned delivery checkpoints or tests.
3. Use `setOnline(...)` only for deterministic test or diagnostic flows, not as a replacement for
   the SDK network monitor.
4. Validate offline-sensitive release behavior with deterministic SDK controls or platform tests
   instead of relying on unstable emulator network toggles.

**Follow this pattern:**

```kotlin
LaunchedEffect(Unit) {
    // Use deterministic network controls only in tests or diagnostics.
    // Accept event consent before queueing a custom track event in a test flow.
    client.consent(true)
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

Native Compose apps do not use the Node or browser hybrid-continuity model. The Android SDK stores
SDK consent and profile-continuity state, but it does not own app Contentful response caches, server
cookies, or SSR-to-browser anonymous ID handoff.

1. Keep Contentful response caching in the application fetching layer.
2. Include the application Contentful locale and entry IDs in cache keys when localized content can
   differ.
3. Invalidate or refetch cached Contentful entries when the app locale changes.
4. Do not treat Android `StorageDefaults` as a replacement for server-side profile persistence or
   cross-device account identity.

For server and browser continuity patterns, use the web and Node guides instead of this native
Compose guide.

## Production checks

Before releasing a Compose integration, verify these points:

- **Credentials and runtime configuration** - The app uses the intended Optimization client ID,
  Contentful environment, API hosts, SDK locale, Android `minSdk`, Java bytecode level, and Maven
  artifact version for the release build.
- **Consent behavior** - Default-on accepted startup, explicit opt-in, denial, split
  event/persistence consent, and withdrawal match the application's policy and remain consistent
  across app relaunches.
- **Event delivery** - Screen, custom event, view, and tap events are accepted only when policy
  permits them, blocked calls appear in diagnostics, queued events flush on reconnection or
  backgrounding, and forwarded events honor downstream consent policy.
- **Content fallback behavior** - Entries are fetched with one CDA locale and enough include depth;
  unresolved links, all-locale payloads, missing selected optimizations, and out-of-range variants
  render baseline content instead of crashing.
- **Duplicate tracking prevention** - The app mounts one `OptimizationRoot` for the active SDK tree,
  calls screen tracking at route roots, avoids nesting multiple SDK tap wrappers around the same
  surface, and uses a scroll-aware helper for list entry view tracking.
- **Privacy and governance** - Preview tooling and preview credentials are gated to debug or
  internal builds, SDK consent is not used as the consent record, and profile reset or consent
  withdrawal clears the app-owned identifiers that policy requires.
- **Local validation path** - Run Android SDK unit tests with `./gradlew testDebugUnitTest` from
  `packages/android/ContentfulOptimization` for changed SDK behavior. Run targeted Compose Maestro
  suites with `pnpm implementation:run -- android-sdk test:e2e:compose -- --flow <suite>` from the
  repository root for user-visible tracking, preview, navigation, or live-update behavior.

## Troubleshooting

| Symptom                                | Likely cause                                                                                                            | Check                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `No OptimizationClient provided`       | A composable called SDK helpers outside `OptimizationRoot`.                                                             | Move the composable under the root that owns the SDK client.                                          |
| Entries always render baseline content | The entry is not optimized, selected optimizations are missing, links are unresolved, or the CDA payload is all-locale. | Verify consent, screen or identify events, `include`, concrete `locale`, and `fields.nt_experiences`. |
| Tap handler does not run               | `trackTaps = false` disabled the SDK tap wrapper, including the supplied `onTap`.                                       | Remove the explicit `trackTaps = false` or handle the click outside `OptimizedEntry`.                 |
| View tracking is inconsistent in lists | The entry cannot read the active list viewport.                                                                         | Use `OptimizationLazyColumn` for `LazyColumn` content or provide an app-owned tracking path.          |
| Screen events are duplicated           | `ScreenTrackingEffect` is mounted in repeated child composables.                                                        | Move the effect to the route or destination root and keep screen names stable.                        |
| Preview panel is missing               | `PreviewPanelConfig` is not passed, `enabled` is `false`, or the build gate excludes it.                                | Verify the debug or internal-build condition and the `OptimizationRoot` preview config.               |

## Reference implementations to compare against

- [Android reference implementation](../../implementations/android-sdk/README.md) - Demonstrates
  Compose and Android Views shells that exercise native Android bridge behavior, single-locale CDA
  fetching, entry resolution, interaction tracking, screen tracking, live updates,
  `getMergeTagValue(...)`, Custom Flags, event diagnostics, and preview-panel overrides against the
  same mock API.
