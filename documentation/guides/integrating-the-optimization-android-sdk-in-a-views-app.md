# Integrating the Optimization Android SDK in an XML Views app

Use this guide when you want to add Personalization, Analytics, screen tracking, and preview
overrides to a native Android application built with XML layouts or Android Views.

For shared runtime behavior, consent gates, tracking thresholds, live-update precedence, and offline
delivery, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md).
Use the Compose guide instead if your app is Compose-based:
[Integrating the Optimization Android SDK in a Jetpack Compose app](./integrating-the-optimization-android-sdk-in-a-compose-app.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and capabilities](#scope-and-capabilities)
- [The integration flow](#the-integration-flow)
- [1. Add the package and create the config](#1-add-the-package-and-create-the-config)
- [2. Initialize with OptimizationManager](#2-initialize-with-optimizationmanager)
- [3. Handle consent](#3-handle-consent)
- [4. Personalize entries with OptimizedEntryView](#4-personalize-entries-with-optimizedentryview)
  - [Fetch entries in the expected shape](#fetch-entries-in-the-expected-shape)
  - [Render resolved entries](#render-resolved-entries)
  - [Use TrackingRecyclerView for scrollable content](#use-trackingrecyclerview-for-scrollable-content)
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

The XML Views integration uses the SDK's View-based adapter surface:

- `OptimizationManager` initializes one process-wide `OptimizationClient` and stores global tracking
  and live-update defaults.
- `OptimizedEntryView` resolves a personalized Contentful entry and can attach view and tap
  tracking.
- `TrackingRecyclerView` nudges descendant `OptimizedEntryView` instances to re-check visibility
  while lists scroll.
- `ScreenTracker` emits screen events from Activity or Fragment lifecycle methods.
- `OptimizationManager.attachPreviewPanel(...)` mounts the developer-only preview panel entry point.

The SDK does not replace your Contentful delivery client. Your application still owns Contentful
fetching, consent UX, identity policy, navigation, and rendering.

## The integration flow

Most XML Views integrations follow this sequence:

1. Add the Maven dependency and create an `OptimizationConfig`.
2. Initialize `OptimizationManager` from `Application.onCreate`.
3. Apply the application's consent policy: seed consent when default-on SDK activity is permitted,
   or collect consent in app UI.
4. Read `OptimizationManager.client` from activities or fragments that render Contentful content.
5. Fetch Contentful entries with linked optimization references.
6. Render each Contentful entry through `OptimizedEntryView`.
7. Enable view and tap tracking where they fit the screen.
8. Emit screen events from Activity or Fragment lifecycle methods.

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
val appLocale = "en-US"

val optimizationConfig = OptimizationConfig(
    clientId = "your-client-id",
    environment = "master",
    locale = appLocale,
    debug = BuildConfig.DEBUG,
)
```

Only `clientId` is required. If application policy permits Optimization by default and no end-user
consent UI is rendered, set `defaults = StorageDefaults(consent = true)`. Otherwise, leave defaults
unset and connect `client.consent(true)` and `client.consent(false)` to the app's consent UI.

Use the same `appLocale` in app-owned Contentful Delivery API requests when the same screen renders
localized Contentful entries. For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

## 2. Initialize with OptimizationManager

Initialize the SDK once from `Application.onCreate`. `OptimizationManager` owns the process-wide
client used by View-based activities and fragments.

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        OptimizationManager.initialize(
            context = this,
            config = optimizationConfig,
            trackViews = true,
            trackTaps = false,
            liveUpdates = false,
            previewPanel = PreviewPanelConfig(
                contentfulClient = previewContentfulClient,
            ),
        )
    }
}
```

Read the client from any Activity or Fragment after initialization:

```kotlin
class HomeActivity : AppCompatActivity() {
    private val client: OptimizationClient
        get() = OptimizationManager.client
}
```

`OptimizationManager.initialize(...)` starts SDK initialization asynchronously. Observe
`client.isInitialized` before running work that depends on the bridge being ready. For lifecycle
details, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-coroutines).

## 3. Handle consent

If your application policy permits Optimization by default, seed accepted consent in
`OptimizationConfig` and omit consent controls:

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
class ConsentActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        acceptButton.setOnClickListener {
            OptimizationManager.client.consent(true)
        }

        rejectButton.setOnClickListener {
            OptimizationManager.client.consent(false)
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                OptimizationManager.client.state.collect { state ->
                    consentBanner.isVisible = state.consent == null
                }
            }
        }
    }
}
```

`identify` and `screen` remain allowed before consent so a mobile journey can establish profile
context and anonymous screen analytics. For cross-SDK consent policy guidance, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

The consent value is persisted and restored on later launches. Profile-continuity state persists
only when persistence consent allows it. Use the app's consent policy to decide whether a stored
value remains valid.

Use `OptimizationManager.client.consent(events = true, persistence = false)` when events are allowed
but durable profile continuity must stay session-only.

## 4. Personalize entries with OptimizedEntryView

`OptimizedEntryView` is the View-based component for rendering Contentful entries through the
Optimization resolver. It passes non-personalized entries through unchanged, resolves personalized
entries against the selected variants for the visitor, and can attach view and tap tracking.

### Fetch entries in the expected shape

Fetch entries from Contentful as single-locale JSON-shaped maps and include linked optimization
references in the payload. Pass those maps to `OptimizedEntryView`.

Use the application Contentful locale for app-owned Contentful Delivery API requests that feed SDK
entry resolution:

```kotlin
lifecycleScope.launch {
    val appLocale = getAppLocale()

    repeatOnLifecycle(Lifecycle.State.STARTED) {
        OptimizationManager.client.isInitialized.collect { isInitialized ->
            if (isInitialized) {
                val entries = contentfulClient.fetchHomeEntries(locale = appLocale)
                renderEntries(entries)
            }
        }
    }
}
```

The resolver expects the same single-locale CDA entry contract used by the other SDK runtimes. For
details, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Render resolved entries

```kotlin
fun createHeroView(entry: Map<String, Any>): View {
    return OptimizedEntryView(this).apply {
        trackTaps = true
        accessibilityIdentifier = "home-hero-personalization"
        setContentRenderer { resolvedEntry ->
            HeroBinder.create(context, resolvedEntry)
        }
        setEntry(entry)
    }
}
```

The renderer receives the resolved entry map. The application owns converting fields from that map
into the view model or View hierarchy it wants to render.

### Use TrackingRecyclerView for scrollable content

`OptimizedEntryView` checks visibility from its own layout callbacks. Use `TrackingRecyclerView`
when a scrolling list needs an additional signal on every scroll frame.

```kotlin
val recyclerView = TrackingRecyclerView(this).apply {
    layoutManager = LinearLayoutManager(this@HomeActivity)
    adapter = ContentEntryAdapter(entries)
}
```

In each item view, wrap the rendered Contentful entry with `OptimizedEntryView`.

## 5. Track entry interactions

### Set global tracking defaults

`OptimizationManager.initialize(...)` defines defaults for every `OptimizedEntryView`:

```kotlin
OptimizationManager.initialize(
    context = this,
    config = optimizationConfig,
    trackViews = true,
    trackTaps = false,
)
```

View tracking defaults to on. Tap tracking defaults to off because taps are usually tied to
application-specific navigation or business actions.

### Override tracking per entry

```kotlin
OptimizedEntryView(context).apply {
    trackViews = false
    setContentRenderer { resolvedEntry -> HeroBinder.create(context, resolvedEntry) }
    setEntry(hero)
}

OptimizedEntryView(context).apply {
    trackTaps = true
    setContentRenderer { resolvedEntry -> CtaBinder.create(context, resolvedEntry) }
    setEntry(cta)
}

OptimizedEntryView(context).apply {
    onTap = { resolvedEntry -> navigateToEntry(resolvedEntry) }
    setContentRenderer { resolvedEntry -> CtaBinder.create(context, resolvedEntry) }
    setEntry(cta)
}
```

Setting `trackTaps = false` disables tap tracking even when `onTap` is present. For timing
thresholds and event delivery behavior, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

## 6. Track screen views

Call `ScreenTracker.trackScreen(...)` from `Activity.onResume` or `Fragment.onResume`:

```kotlin
override fun onResume() {
    super.onResume()
    ScreenTracker.trackScreen("Home")
}
```

For dynamic names or tracking after data loads, call the client directly:

```kotlin
lifecycleScope.launch {
    OptimizationManager.client.screen(
        name = "BlogPostDetail",
        properties = mapOf("postId" to postId),
    )
}
```

## Live updates

By default, `OptimizedEntryView` locks to the first variant it resolves so content does not change
while a visitor is reading it. Enable live updates when a screen needs to react to profile or
preview changes without a reload:

```kotlin
OptimizationManager.initialize(
    context = this,
    config = optimizationConfig,
    liveUpdates = true,
)

OptimizedEntryView(context).apply {
    liveUpdates = true
    setContentRenderer { resolvedEntry -> DashboardBinder.create(context, resolvedEntry) }
    setEntry(dashboard)
}
```

The preview panel forces live updates while it is open. For precedence rules, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

## Preview panel

Gate the preview panel behind a debug or internal-build flag. In XML Views apps, call
`OptimizationManager.attachPreviewPanel(...)` from each Activity that displays the floating entry
point.

```kotlin
class HomeActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.home)

        if (BuildConfig.DEBUG) {
            OptimizationManager.attachPreviewPanel(this)
        }
    }
}
```

Pass `PreviewPanelConfig(contentfulClient = previewContentfulClient)` to
`OptimizationManager.initialize(...)` when the panel needs to display audience and experience names.
Without a `PreviewContentfulClient`, the panel displays identifiers.

## Complete example

This example combines application-level initialization, preview-panel gating, screen tracking, entry
rendering, and tap tracking:

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        OptimizationManager.initialize(
            context = this,
            config = optimizationConfig,
            trackViews = true,
            trackTaps = false,
            previewPanel = PreviewPanelConfig(
                contentfulClient = previewContentfulClient,
            ),
        )
    }
}

class HomeActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val list = TrackingRecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@HomeActivity)
        }
        setContentView(list)

        if (BuildConfig.DEBUG) {
            OptimizationManager.attachPreviewPanel(this)
        }

        lifecycleScope.launch {
            val appLocale = getAppLocale()

            repeatOnLifecycle(Lifecycle.State.STARTED) {
                OptimizationManager.client.isInitialized.collect { isInitialized ->
                    if (isInitialized) {
                        val entries = fetchHomeEntries(locale = appLocale)
                        list.adapter = ContentEntryAdapter(entries)
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        ScreenTracker.trackScreen("Home")
    }
}

fun bindEntry(parent: ViewGroup, entry: Map<String, Any>) {
    parent.addView(
        OptimizedEntryView(parent.context).apply {
            trackTaps = true
            setContentRenderer { resolvedEntry ->
                ContentEntryBinder.create(context, resolvedEntry)
            }
            setEntry(entry)
        },
    )
}
```

## Reference implementations to compare against

- [Android reference implementation](../../implementations/android-sdk/README.md) - Demonstrates
  Compose and XML Views shells that exercise native Android bridge behavior, entry resolution,
  interaction tracking, screen tracking, live updates, and preview-panel overrides against the same
  mock API.
