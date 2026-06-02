# Integrating the Optimization Android SDK in a Jetpack Compose app

Use this guide when you want to add Personalization, Analytics, screen tracking, and preview
overrides to a native Android application built with Jetpack Compose.

For shared runtime behavior, consent gates, tracking thresholds, live-update precedence, and offline
delivery, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md).
Use the XML Views guide instead if your app is View-based:
[Integrating the Optimization Android SDK in an XML Views app](./integrating-the-optimization-android-sdk-in-a-views-app.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and capabilities](#scope-and-capabilities)
- [The integration flow](#the-integration-flow)
- [1. Add the package and create the config](#1-add-the-package-and-create-the-config)
- [2. Initialize with OptimizationRoot](#2-initialize-with-optimizationroot)
- [3. Handle consent](#3-handle-consent)
- [4. Personalize entries with OptimizedEntry](#4-personalize-entries-with-optimizedentry)
  - [Fetch entries in the expected shape](#fetch-entries-in-the-expected-shape)
  - [Render resolved entries](#render-resolved-entries)
  - [Use OptimizationLazyColumn for scrollable content](#use-optimizationlazycolumn-for-scrollable-content)
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

The Compose integration uses the SDK's Compose-native API surface:

- `OptimizationRoot` initializes `OptimizationClient`, provides it through Compose locals, and
  defines global tracking and live-update defaults.
- `OptimizedEntry` resolves a personalized Contentful entry and can attach view and tap tracking.
- `OptimizationLazyColumn` provides viewport context for view tracking inside lazy lists.
- `ScreenTrackingEffect` emits screen events from a composable screen.
- `PreviewPanelConfig` enables a developer-only preview panel entry point.

The SDK does not replace your Contentful delivery client. Your application still owns Contentful
fetching, consent UX, identity policy, navigation, and rendering.

## The integration flow

Most Compose integrations follow this sequence:

1. Add the Maven dependency and create an `OptimizationConfig`.
2. Wrap the app's root content in `OptimizationRoot`.
3. Apply the application's consent policy: seed consent when default-on SDK activity is permitted,
   or collect consent in app UI.
4. Fetch Contentful entries with linked optimization references.
5. Render each Contentful entry through `OptimizedEntry`.
6. Enable view and tap tracking where they fit the screen.
7. Mark screens with `ScreenTrackingEffect`.

Optional additions include live updates when entries need to react to optimization state changes
after initial render, and the preview panel when authors or engineers need local audience and
variant overrides.

The Android reference implementation in this repository demonstrates the same SDK behavior in
Compose and XML Views shells:

- [Android reference implementation](../../implementations/android-sdk/README.md)

## 1. Add the package and create the config

Add the Android SDK from Maven Central as described in the
[Optimization Android SDK README](../../packages/android/README.md). In an Android application
module, the dependency looks like this:

```kotlin
dependencies {
    implementation("com.contentful.java:optimization-android:<version>")
}
```

Then create an `OptimizationConfig` with the Optimization client ID and the Contentful locale
information your app uses when fetching entries:

```kotlin
val optimizationConfig = OptimizationConfig(
    clientId = "your-client-id",
    environment = "master",
    contentfulLocales = ContentfulLocales(default = "en-US"),
    locale = "en-US",
    debug = BuildConfig.DEBUG,
)
```

Only `clientId` is required. If application policy permits Optimization by default and no end-user
consent UI is rendered, set `defaults = StorageDefaults(consent = true)`. Otherwise, leave defaults
unset and connect `client.consent(true)` and `client.consent(false)` to the app's consent UI.

Use `contentfulLocales` and `locale` when the same screen renders localized Contentful entries. For
the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

## 2. Initialize with OptimizationRoot

Wrap your root Compose content in `OptimizationRoot`. It owns the `OptimizationClient`, initializes
the SDK, and provides the ready client to descendant composables through `LocalOptimizationClient`.

```kotlin
@Composable
fun AppRoot() {
    OptimizationRoot(
        config = optimizationConfig,
        trackViews = true,
        trackTaps = false,
        liveUpdates = false,
    ) {
        AppNavGraph()
    }
}
```

Inside the provider tree, read the client from `LocalOptimizationClient`:

```kotlin
@Composable
fun AccountControls() {
    val client = LocalOptimizationClient.current
    val scope = rememberCoroutineScope()

    Button(
        onClick = {
            scope.launch {
                client.identify(
                    userId = "user-123",
                    traits = mapOf("plan" to "pro"),
                )
            }
        },
    ) {
        Text("Identify")
    }
}
```

`OptimizationClient` exposes async work as `suspend` functions and state as `StateFlow`. Call
suspending methods from Compose effects, event-handler coroutine scopes, or lifecycle-aware
coroutines. For lifecycle details, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-coroutines).

## 3. Handle consent

If your application policy permits Optimization by default, seed accepted consent in
`OptimizationConfig` and omit the consent gate:

```kotlin
val optimizationConfig = OptimizationConfig(
    clientId = "your-client-id",
    defaults = StorageDefaults(consent = true),
)
```

That starts all gated SDK events immediately and permits durable profile-continuity storage for
profile, selected optimizations, changes, and the anonymous ID.

When application policy depends on user choice, leave consent unset and call
`client.consent(true | false)` from an application-owned consent UI.

```kotlin
@Composable
fun ConsentGate(content: @Composable () -> Unit) {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()

    if (state.consent == null) {
        Column {
            Text("We use analytics to personalize content.")
            Row {
                Button(onClick = { client.consent(true) }) {
                    Text("Accept")
                }
                Button(onClick = { client.consent(false) }) {
                    Text("Reject")
                }
            }
        }
    } else {
        content()
    }
}
```

`identify` and `screen` remain allowed before consent so a mobile journey can establish profile
context and anonymous screen analytics. For cross-SDK consent policy guidance, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

The consent value is persisted and restored on later launches. Profile-continuity state persists
only when persistence consent allows it. Use the app's consent policy to decide whether a stored
value remains valid.

When durable profile-continuity persistence is allowed, SDK state from an Experience response is
published only after the corresponding storage write has settled. Wait for SDK-derived state instead
of adding sleeps before relaunching or terminating the app in tests.

Use `client.consent(events = true, persistence = false)` when events are allowed but durable profile
continuity must stay session-only.

## 4. Personalize entries with OptimizedEntry

`OptimizedEntry` is the Compose component for rendering Contentful entries through the Optimization
resolver. It passes non-personalized entries through unchanged, resolves personalized entries
against the selected variants for the visitor, and can attach view and tap tracking.

### Fetch entries in the expected shape

Fetch entries from Contentful as single-locale JSON-shaped maps and include linked optimization
references in the payload. Pass those maps to `OptimizedEntry`.

Use the resolved `client.locale` value for app-owned Contentful Delivery API requests that feed SDK
entry resolution:

```kotlin
@Composable
fun HomeScreen(contentfulClient: ContentfulDeliveryClient) {
    val client = LocalOptimizationClient.current
    var entries by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }

    LaunchedEffect(client.locale) {
        val locale = client.locale ?: "en-US"
        entries = contentfulClient.fetchHomeEntries(locale = locale)
    }

    HomeContent(entries = entries)
}
```

The resolver expects the same single-locale CDA entry contract used by the other SDK runtimes. For
details, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Render resolved entries

```kotlin
@Composable
fun HeroSection(entry: Map<String, Any>) {
    OptimizedEntry(
        entry = entry,
        trackTaps = true,
        accessibilityIdentifier = "home-hero-personalization",
    ) { resolvedEntry ->
        HeroCard(entry = resolvedEntry)
    }
}
```

The render lambda receives the resolved entry map. The application owns converting fields from that
map into the view model or Compose hierarchy it wants to render.

### Use OptimizationLazyColumn for scrollable content

Inside a plain `LazyColumn`, `OptimizedEntry` cannot read the list viewport. Use
`OptimizationLazyColumn` when view tracking needs viewport-aware timing.

```kotlin
OptimizationLazyColumn {
    items(entries) { entry ->
        OptimizedEntry(entry = entry) { resolvedEntry ->
            BlogPostCard(entry = resolvedEntry)
        }
    }
}
```

For full-screen heroes, modal content, or single-screen layouts, a regular container is enough.

## 5. Track entry interactions

### Set global tracking defaults

`OptimizationRoot` defines defaults for every `OptimizedEntry` in its tree:

```kotlin
OptimizationRoot(
    config = optimizationConfig,
    trackViews = true,
    trackTaps = false,
) {
    AppNavGraph()
}
```

View tracking defaults to on. Tap tracking defaults to off because taps are usually tied to
application-specific navigation or business actions.

### Override tracking per entry

```kotlin
OptimizedEntry(entry = hero, trackViews = false) { resolvedEntry ->
    HeroCard(entry = resolvedEntry)
}

OptimizedEntry(entry = cta, trackTaps = true) { resolvedEntry ->
    CtaCard(entry = resolvedEntry)
}

OptimizedEntry(
    entry = cta,
    onTap = { resolvedEntry -> navigateToEntry(resolvedEntry) },
) { resolvedEntry ->
    CtaCard(entry = resolvedEntry)
}
```

Passing `trackTaps = false` disables tap tracking even when `onTap` is present. For timing
thresholds and event delivery behavior, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

## 6. Track screen views

Call `ScreenTrackingEffect` from the root composable for each screen:

```kotlin
@Composable
fun HomeScreen() {
    ScreenTrackingEffect(screenName = "Home")
    HomeContent()
}
```

For dynamic names or tracking after data loads, call the client directly:

```kotlin
@Composable
fun DetailsScreen(postId: String) {
    val client = LocalOptimizationClient.current

    LaunchedEffect(postId) {
        client.screen(
            name = "BlogPostDetail",
            properties = mapOf("postId" to postId),
        )
    }

    DetailsContent(postId = postId)
}
```

## Live updates

By default, `OptimizedEntry` locks to the first variant it resolves so content does not change while
a visitor is reading it. Enable live updates when a screen needs to react to profile or preview
changes without a reload:

```kotlin
OptimizationRoot(config = optimizationConfig, liveUpdates = true) {
    AppNavGraph()
}

OptimizedEntry(entry = dashboard, liveUpdates = true) { resolvedEntry ->
    Dashboard(entry = resolvedEntry)
}
```

The preview panel forces live updates while it is open. For precedence rules, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

## Preview panel

Gate the preview panel behind a debug or internal-build flag. In Compose, pass `PreviewPanelConfig`
to `OptimizationRoot` to render a floating button that opens the panel.

```kotlin
OptimizationRoot(
    config = optimizationConfig,
    previewPanel = if (BuildConfig.DEBUG) {
        PreviewPanelConfig(contentfulClient = previewContentfulClient)
    } else {
        null
    },
) {
    AppNavGraph()
}
```

The `contentfulClient` parameter is optional. Passing a `PreviewContentfulClient` enables audience
and experience names in the panel; without it, the panel displays identifiers.

## Complete example

This example combines initialization, preview-panel gating, screen tracking, viewport-aware entry
tracking, and tap tracking:

```kotlin
@Composable
fun AppRoot(previewContentfulClient: PreviewContentfulClient?) {
    OptimizationRoot(
        config = optimizationConfig,
        trackViews = true,
        trackTaps = false,
        previewPanel = if (BuildConfig.DEBUG) {
            PreviewPanelConfig(contentfulClient = previewContentfulClient)
        } else {
            null
        },
    ) {
        HomeScreen()
    }
}

@Composable
fun HomeScreen() {
    val client = LocalOptimizationClient.current
    var entries by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }

    ScreenTrackingEffect(screenName = "Home")

    LaunchedEffect(client.locale) {
        entries = fetchHomeEntries(locale = client.locale ?: "en-US")
    }

    OptimizationLazyColumn {
        items(entries) { entry ->
            OptimizedEntry(
                entry = entry,
                trackTaps = true,
            ) { resolvedEntry ->
                ContentEntryCard(entry = resolvedEntry)
            }
        }
    }
}
```

## Reference implementations to compare against

- [Android reference implementation](../../implementations/android-sdk/README.md) - Demonstrates
  Compose and XML Views shells that exercise native Android bridge behavior, entry resolution,
  interaction tracking, screen tracking, live updates, and preview-panel overrides against the same
  mock API.
