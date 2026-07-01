# Integrating the Optimization Android SDK in an Android Views app

Use this guide when you want to add Optimization, Analytics, screen tracking, Custom Flags, MergeTag
rendering, and preview overrides to a native Android application built with XML layouts or Android
Views. Use the Compose guide when the screen is built with Jetpack Compose:
[Integrating the Optimization Android SDK in a Jetpack Compose app](./integrating-the-optimization-android-sdk-in-a-compose-app.md).

## Quick start

This path uses the Android/native default pre-consent allow-list, where `screen` can emit before an
explicit consent decision. If your policy requires strict opt-in before any Optimization event, set
`allowedEventTypes = emptyList()` and complete the consent handoff section before sending events or
expecting selected variants.

This path initializes the SDK, emits one screen event for selection context, fetches one
single-locale Contentful entry, and renders the resolved entry in an Android View.

1. Add the Android SDK dependency to the application module.

   **Copy this:**

   ```kotlin
   repositories {
       mavenCentral()
   }

   dependencies {
       implementation("com.contentful.java:optimization-android:<version>")
   }
   ```

2. Initialize the process-wide Views client.

   **Adapt this to your use case:**

   ```kotlin
   class MyApplication : Application() {
       override fun onCreate() {
           super.onCreate()

           val appLocale = "en-US"

           OptimizationManager.initialize(
               context = this,
               config = OptimizationConfig(
                   clientId = "your-client-id",
                   environment = "main",
                   locale = appLocale,
                   logLevel = if (BuildConfig.DEBUG) {
                       OptimizationLogLevel.debug
                   } else {
                       OptimizationLogLevel.error
                   },
               ),
           )
       }
   }
   ```

3. Emit one screen event, fetch a single-locale Contentful entry with linked optimization data, and
   render it through `OptimizedEntryView`.

   **Adapt this to your use case:**

   ```kotlin
   class HomeActivity : AppCompatActivity() {
       override fun onCreate(savedInstanceState: Bundle?) {
           super.onCreate(savedInstanceState)

           val heroSlot = OptimizedEntryView(this).apply {
               accessibilityIdentifier = "content-entry-home-hero"
               setContentRenderer { resolvedEntry ->
                   // Render the resolver output; it falls back to baseline content.
                   HeroBinder.create(context, resolvedEntry)
               }
           }
           setContentView(heroSlot)

           lifecycleScope.launch {
               // Wait until the bridge can accept events and resolve optimized entries.
               OptimizationManager.client.isInitialized.first { it }

               // Emit screen context once before fetching content that can use selected variants.
               OptimizationManager.client.screen("Home")

               // Your app owns Contentful fetching; request one concrete locale with resolved links.
               val heroEntry = contentfulClient.fetchEntry(
                   id = "home-hero",
                   include = 10,
                   locale = "en-US",
               )

               heroSlot.setEntry(heroEntry)
           }
       }
   }
   ```

4. Verify that the entry renders either its baseline content or selected variant content in the
   Android View.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
- [Core integration](#core-integration)
  - [SDK installation and process-wide client](#sdk-installation-and-process-wide-client)
  - [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff)
  - [Contentful fetching and entry shape](#contentful-fetching-and-entry-shape)
  - [Entry rendering and fallback behavior](#entry-rendering-and-fallback-behavior)
  - [Screen and custom event tracking](#screen-and-custom-event-tracking)
  - [Entry interaction tracking](#entry-interaction-tracking)
- [Optional integrations](#optional-integrations)
  - [Scrollable entry lists](#scrollable-entry-lists)
  - [Identity and reset controls](#identity-and-reset-controls)
  - [Runtime locale changes](#runtime-locale-changes)
  - [Analytics diagnostics and forwarding](#analytics-diagnostics-and-forwarding)
  - [Custom Flags and MergeTag rendering](#custom-flags-and-mergetag-rendering)
  - [Live updates and variant locking](#live-updates-and-variant-locking)
- [Advanced integrations](#advanced-integrations)
  - [Preview panel](#preview-panel)
  - [Offline delivery and queue observability](#offline-delivery-and-queue-observability)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Required setup

Use this setup inventory for the full guide:

| Setup item                                                           | Category                       | Required for quick start | Where to configure                                                                                   |
| -------------------------------------------------------------------- | ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Android SDK dependency                                               | Required for first integration | Yes                      | Application module Gradle dependency                                                                 |
| Optimization client ID and environment                               | Required for first integration | Yes                      | `OptimizationConfig(clientId = ..., environment = ...)`                                              |
| Experience API and Insights API endpoint overrides                   | Common but policy-dependent    | No                       | `OptimizationApiConfig` for staging, mock, or non-default hosts                                      |
| SDK Experience and event locale                                      | Common but policy-dependent    | Conditional              | `OptimizationConfig(locale = appLocale)`                                                             |
| Consent and profile-continuity policy                                | Common but policy-dependent    | Conditional              | `StorageDefaults`, `allowedEventTypes`, `client.consent(...)`, and consent UI                        |
| Contentful Delivery or Preview API client, credentials, and API host | Required for first integration | Yes                      | Application-owned Contentful client configuration                                                    |
| Single-locale Contentful entries with linked optimization data       | Required for first integration | Yes                      | Application-owned Contentful Delivery API or Content Preview API fetch code                          |
| Android process entry point                                          | Required for first integration | Yes                      | `Application.onCreate` with `OptimizationManager.initialize(...)`                                    |
| Activity, Fragment, or navigation lifecycle hooks                    | Required for first integration | Yes                      | `ScreenTracker.trackScreen(...)` or direct `client.screen(...)` calls                                |
| Android Views entry-rendering adapter                                | Required for first integration | Yes                      | `OptimizedEntryView` in XML layouts, Activity code, Fragment code, or adapters                       |
| Entry view and tap tracking defaults                                 | Common but policy-dependent    | No                       | `OptimizationManager.initialize(...)` and per-view `OptimizedEntryView` properties                   |
| Scrollable entry-list helper                                         | Optional                       | No                       | `TrackingRecyclerView` for RecyclerView-based screens                                                |
| Identity, profile, and reset controls                                | Optional                       | No                       | Login, account, logout, or reset handlers calling `client.identify(...)` or reset                    |
| Runtime locale changes                                               | Optional                       | No                       | App locale state, `client.setLocale(...)`, and Contentful refetch logic                              |
| Analytics diagnostics or forwarding                                  | Optional                       | No                       | `client.eventStream`, `client.blockedEventStream`, and app-owned destinations                        |
| Custom Flags and MergeTag rendering                                  | Optional                       | No                       | Views, adapters, or binders that call `getFlag(...)`, `observeFlag(...)`, or `getMergeTagValue(...)` |
| Preview-panel UI and preview Contentful definitions                  | Advanced or production-only    | No                       | Debug or internal Activity code with `PreviewPanelConfig` and `attachPreviewPanel`                   |
| Strict pre-consent event policy                                      | Advanced or production-only    | Conditional              | `OptimizationConfig.allowedEventTypes`, usually `emptyList()` for strict opt-in                      |
| Offline queue bounds, retry policy, and delivery callbacks           | Advanced or production-only    | No                       | `QueuePolicy` in `OptimizationConfig`                                                                |

The SDK does not replace your Contentful delivery client. Your application still owns Contentful
fetching, consent UX, identity policy, routing, caching, and rendering.

## Core integration

### SDK installation and process-wide client

**Integration category:** Required for first integration

1. Confirm that the consuming Android app supports Android `minSdk` 24 or later, Java 11 bytecode,
   Kotlin, and Maven Central. The package requirements and published coordinate are documented in
   the [Optimization Android SDK README](../../packages/android/README.md).
2. Add the SDK dependency to the app module.

   **Copy this:**

   ```kotlin
   repositories {
       mavenCentral()
   }

   dependencies {
       implementation("com.contentful.java:optimization-android:<version>")
   }
   ```

3. Create one `OptimizationConfig` with the Optimization client ID, Contentful environment, and SDK
   Experience or event locale.

   **Adapt this to your use case:**

   ```kotlin
   val appLocale = "en-US"

   val optimizationConfig = OptimizationConfig(
       clientId = "your-client-id",
       environment = "main",
       // Match this to the locale used by the app-owned Contentful fetch.
       locale = appLocale,
       logLevel = if (BuildConfig.DEBUG) {
           OptimizationLogLevel.debug
       } else {
           OptimizationLogLevel.error
       },
   )
   ```

   Pass `api = OptimizationApiConfig(...)` only when the app uses staging, mock, or non-default
   Experience API or Insights API hosts. Omit it for the default Contentful Optimization endpoints.

4. Initialize `OptimizationManager` once for the app process. Production apps usually do this from
   `Application.onCreate` before any Activity or Fragment reads `OptimizationManager.client`.

   **Adapt this to your use case:**

   ```kotlin
   class MyApplication : Application() {
       override fun onCreate() {
           super.onCreate()

           // Initialize once before Activities or Fragments read OptimizationManager.client.
           OptimizationManager.initialize(
               context = this,
               config = optimizationConfig,
           )
       }
   }
   ```

5. Treat `OptimizationManager.initialize(...)` as asynchronous. `OptimizationManager.client` is
   available immediately after initialization is requested, but suspend APIs that depend on the
   bridge require `client.isInitialized` to become `true`.

   **Copy this:**

   ```kotlin
   lifecycleScope.launch {
       // Direct suspend APIs require the async bridge initialization to finish first.
       OptimizationManager.client.isInitialized.first { it }
       OptimizationManager.client.track(
           event = "App Ready",
           properties = mapOf("surface" to "views"),
       )
   }
   ```

For lifecycle and coroutine behavior, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-coroutines).

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

1. Decide whether the application can start SDK event emission and durable profile continuity before
   rendering a consent UI. The SDK stores and applies consent state, but the application or CMP owns
   notice text, jurisdiction logic, consent records, and withdrawal policy.
2. For a default-on accepted policy, seed accepted consent during initialization.

   **Copy this:**

   ```kotlin
   val optimizationConfig = OptimizationConfig(
       clientId = "your-client-id",
       // Seed accepted consent only when your app policy permits event emission at startup.
       defaults = StorageDefaults(consent = true),
   )
   ```

3. For a user-choice policy, leave consent unset and call `client.consent(true)` or
   `client.consent(false)` from application-owned UI after initialization completes.

   **Adapt this to your use case:**

   ```kotlin
   class ConsentActivity : AppCompatActivity() {
       override fun onCreate(savedInstanceState: Bundle?) {
           super.onCreate(savedInstanceState)

           acceptButton.isEnabled = false
           rejectButton.isEnabled = false

           lifecycleScope.launch {
               OptimizationManager.client.isInitialized.first { it }
               acceptButton.isEnabled = true
               rejectButton.isEnabled = true
           }

           acceptButton.setOnClickListener {
               // Boolean consent applies to events and durable profile-continuity persistence.
               applyConsent(true)
           }

           rejectButton.setOnClickListener {
               // Rejection blocks gated SDK events such as view, tap, and custom track calls.
               applyConsent(false)
           }

           lifecycleScope.launch {
               repeatOnLifecycle(Lifecycle.State.STARTED) {
                   OptimizationManager.client.state.collect { state ->
                       consentBanner.isVisible = state.consent == null
                   }
               }
           }
       }

       private fun applyConsent(accepted: Boolean) {
           lifecycleScope.launch {
               // consent(...) no-ops before initialization, so wait before applying the choice.
               OptimizationManager.client.isInitialized.first { it }
               OptimizationManager.client.consent(accepted)
           }
       }
   }
   ```

4. Use object-form consent when event emission is allowed but durable profile-continuity storage
   must stay session-only.

   **Adapt this to your use case:**

   ```kotlin
   lifecycleScope.launch {
       OptimizationManager.client.isInitialized.first { it }
       OptimizationManager.client.consent(events = true, persistence = false)
   }
   ```

By default, Android/native `identify` and `screen` are allowed before consent so a mobile journey
can establish profile context and anonymous screen analytics. View, tap, custom `track(...)`, and
most other events are blocked until event consent is accepted. For strict opt-in before any
Optimization event, replace the default allow-list during initialization:

**Copy this:**

```kotlin
val strictConfig = OptimizationConfig(
    clientId = "your-client-id",
    // Empty means no SDK events are allowed before explicit consent.
    allowedEventTypes = emptyList(),
)
```

For cross-SDK policy guidance, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful fetching and entry shape

**Integration category:** Required for first integration

1. Keep Contentful entry fetching in the application layer. The Android SDK resolves entries that
   the app provides; it does not fetch Contentful entries for your UI.
2. Fetch entries with one Contentful locale and enough include depth for linked optimization data.
   Do not pass all-locale CDA responses or `locale=*` payloads into `OptimizedEntryView`.
3. Use the same application Contentful locale for the SDK `locale` when Experience API responses and
   event context must match the rendered content language.

**Follow this pattern:**

```kotlin
suspend fun fetchHomeEntries(
    contentfulClient: ContentfulDeliveryClient,
    appLocale: String,
): List<Map<String, Any>> {
    return contentfulClient.getEntries(
        contentType = "homePage",
        // Resolve linked optimization entries before handing the payload to OptimizedEntryView.
        include = 10,
        // Use one concrete Contentful locale; do not pass locale=* responses to the SDK.
        locale = appLocale,
    )
}
```

4. Pass direct single-locale entry maps to the Views adapter after the SDK is initialized or after
   the app has enough profile state for its rendering policy.

**Adapt this to your use case:**

```kotlin
lifecycleScope.launch {
    val appLocale = getAppLocale()

    // Wait until the SDK can resolve optimized entries against profile state.
    OptimizationManager.client.isInitialized.first { it }

    val entries = contentfulClient.fetchHomeEntries(locale = appLocale)
    renderEntries(entries)
}
```

The resolver expects direct field values such as `fields.nt_experiences` and linked variant entries
such as `optimizationEntry.fields.nt_variants`. For the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).
For the Contentful entry contract and fallback rules, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Entry rendering and fallback behavior

**Integration category:** Required for first integration

1. Add `OptimizedEntryView` from XML or create it from Activity, Fragment, or adapter code.

**Copy this:**

```xml
<com.contentful.optimization.views.OptimizedEntryView
    android:id="@+id/hero_slot"
    android:layout_width="match_parent"
    android:layout_height="wrap_content" />
```

2. Set `accessibilityIdentifier`, set a renderer that turns the resolved entry map into a child
   `View`, then call `setEntry(...)` with the baseline Contentful entry.

**Adapt this to your use case:**

```kotlin
val heroSlot = findViewById<OptimizedEntryView>(R.id.hero_slot)

heroSlot.accessibilityIdentifier = "content-entry-home-hero"
heroSlot.setContentRenderer { resolvedEntry ->
    // Render the resolver output; it is the baseline fallback when no variant resolves.
    HeroBinder.create(context = heroSlot.context, entry = resolvedEntry)
}
heroSlot.setEntry(heroEntry)
```

3. Render the map passed to the renderer. It can be the baseline entry, the selected variant entry,
   or the baseline fallback when no variant resolves.
4. Treat baseline fallback as expected behavior. Missing optimization data, unresolved Contentful
   links, all-locale payloads, absent selected optimizations, and out-of-range variants all render
   the baseline entry instead of throwing.

`OptimizedEntryView` mirrors the Compose `OptimizedEntry` behavior for non-optimized entries,
variant resolution, variant locking, live updates, view tracking, tap tracking, and
`accessibilityIdentifier` as `contentDescription`. For deeper resolution mechanics, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#fallback-behavior).

### Screen and custom event tracking

**Integration category:** Required for first integration

1. Emit screen events when an Activity or Fragment becomes the active application screen. For simple
   Activity screens, call `ScreenTracker.trackScreen(...)` from `onResume`.

**Copy this:**

```kotlin
override fun onResume() {
    super.onResume()
    // Track once per visible screen lifecycle instead of from repeated child view binding.
    ScreenTracker.trackScreen("Home")
}
```

2. Emit a new screen event after an in-Activity navigation state change when multiple logical
   screens share one Activity.

**Adapt this to your use case:**

```kotlin
private fun transitionTo(destination: Destination) {
    renderDestination(destination)

    // Emit the screen event after the app has committed its navigation state.
    when (destination) {
        Destination.HOME -> ScreenTracker.trackScreen("NavigationHome")
        Destination.DETAIL -> ScreenTracker.trackScreen("NavigationDetail")
    }
}
```

3. Use direct client calls when a screen event needs properties or when a business interaction needs
   a custom event.

**Adapt this to your use case:**

```kotlin
lifecycleScope.launch {
    // Wait for bridge initialization before calling suspend client APIs directly.
    OptimizationManager.client.isInitialized.first { it }

    OptimizationManager.client.screen(
        name = "BlogPostDetail",
        properties = mapOf("postId" to postId),
    )

    OptimizationManager.client.track(
        event = "Purchase Completed",
        properties = mapOf("sku" to "sku-1"),
    )
}
```

`ScreenTracker` uses the same client as `OptimizationManager.client` and swallows initialization
failures so early lifecycle calls do not crash the host Activity. Wait for `isInitialized` before
calling suspend APIs directly.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

1. Leave global view and tap tracking defaults enabled when your Analytics and privacy policy
   permits them. Pass `trackViews = false` or `trackTaps = false` globally when a surface must opt
   out by default.

**Copy this:**

```kotlin
OptimizationManager.initialize(
    context = this,
    config = optimizationConfig,
    // Opt out globally only when this app must not emit tap analytics by default.
    trackTaps = false,
)
```

2. Override tracking per entry when a component needs different behavior from the global default.

**Adapt this to your use case:**

```kotlin
OptimizedEntryView(context).apply {
    // Disable SDK view tracking for entries tracked by a different application surface.
    trackViews = false
    setContentRenderer { resolvedEntry ->
        HeroBinder.create(context, resolvedEntry)
    }
    setEntry(hero)
}

OptimizedEntryView(context).apply {
    setContentRenderer { resolvedEntry ->
        CtaBinder.create(context, resolvedEntry)
    }
    setEntry(cta)
}

OptimizedEntryView(context).apply {
    onTap = { baselineEntry ->
        navigateToEntry(baselineEntry)
    }
    // Direct onTap is a per-entry override; it keeps this entry tappable even
    // when global trackTaps is false.
    setContentRenderer { resolvedEntry ->
        CtaBinder.create(context, resolvedEntry)
    }
    setEntry(cta)
}
```

3. Set per-entry `trackTaps = false` only when that entry must opt out of the SDK tap handling path.
   Do not combine it with `onTap`; if a component needs an app-owned tap handler without SDK tap
   tracking, attach a normal Android click listener inside the rendered child view instead.
4. Tune view-tracking timing only when the default 2 second dwell time, 80% visible ratio, or 5
   second update interval does not match the component.

**Adapt this to your use case:**

```kotlin
OptimizedEntryView(context).apply {
    // Changing timing changes when verification-visible view events are emitted.
    minVisibleRatio = 0.75
    dwellTimeMs = 1500
    viewDurationUpdateIntervalMs = 5000
    setContentRenderer { resolvedEntry ->
        PromoBinder.create(context, resolvedEntry)
    }
    setEntry(promo)
}
```

SDK view and tap event emission still respects the SDK consent gate. For interaction timing,
component event metadata, and offline delivery behavior, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

## Optional integrations

### Scrollable entry lists

**Integration category:** Optional

1. Use `TrackingRecyclerView` when a `RecyclerView` screen needs an extra scroll-frame signal for
   descendant `OptimizedEntryView` visibility checks.

**Adapt this to your use case:**

```kotlin
val recyclerView = TrackingRecyclerView(this).apply {
    // RecyclerView scrolls can need an extra visibility signal for descendant entry views.
    layoutManager = LinearLayoutManager(this@HomeActivity)
    adapter = ContentEntryAdapter(entries)
}
```

2. In each adapter item, wrap the rendered Contentful entry with `OptimizedEntryView`.

**Adapt this to your use case:**

```kotlin
class ContentEntryViewHolder(
    private val parent: ViewGroup,
) : RecyclerView.ViewHolder(
        OptimizedEntryView(parent.context),
    ) {
    private val optimizedEntryView = itemView as OptimizedEntryView

    fun bind(entry: Map<String, Any>) {
        // Keep item views stable so dwell timers are not reset by repeated rebinding.
        optimizedEntryView.setContentRenderer { resolvedEntry ->
            ContentEntryBinder.create(parent.context, resolvedEntry)
        }
        optimizedEntryView.setEntry(entry)
    }
}
```

`OptimizedEntryView` also rechecks visibility from layout callbacks, so plain `ScrollView` screens
can use normal child views unless a RecyclerView adapter needs the additional helper.

### Identity and reset controls

**Integration category:** Optional

1. Call `identify(...)` after login, account selection, or another application-owned identity
   decision. Gate traits before sending sensitive or restricted data.

**Adapt this to your use case:**

```kotlin
lifecycleScope.launch {
    // Identify after the app has made its own login or account-selection decision.
    OptimizationManager.client.isInitialized.first { it }
    OptimizationManager.client.identify(
        userId = "user-123",
        traits = mapOf("plan" to "pro"),
    )
}
```

2. Call `reset()` when the app must clear SDK-managed profile continuity, such as during logout or a
   local test reset.

**Adapt this to your use case:**

```kotlin
lifecycleScope.launch {
    OptimizationManager.client.isInitialized.first { it }
    OptimizationManager.client.reset()
    // Emit fresh profile-producing context after reset before expecting new variants.
    ScreenTracker.trackScreen("Home")
}
```

After reset, emit a fresh screen, identify, page, or other approved profile-producing event before
expecting new selected optimizations. Store account IDs, consent records, and cross-device identity
state outside the SDK.

### Runtime locale changes

**Integration category:** Optional

1. When the app locale changes, update the SDK Experience and event locale.
2. Refetch Contentful entries with the same app Contentful locale before rendering localized content
   through `OptimizedEntryView`.
3. Invalidate application caches that were keyed by the previous locale.

**Adapt this to your use case:**

```kotlin
lifecycleScope.launch {
    OptimizationManager.client.isInitialized.first { it }

    val nextLocale = getAppLocale()
    // setLocale updates SDK Experience/event locale; the app still refetches Contentful entries.
    OptimizationManager.client.setLocale(nextLocale)

    val entries = contentfulClient.fetchHomeEntries(locale = nextLocale)
    renderEntries(entries)
}
```

`setLocale(...)` changes the SDK Experience/event locale. It does not refetch Contentful entries,
infer device language, or validate that the locale is enabled in the Contentful environment. For the
locale boundary, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Analytics diagnostics and forwarding

**Integration category:** Optional

1. Use `eventStream` for debug surfaces, local tests, or application-owned analytics forwarding.
2. Use `blockedEventStream` and `onEventBlocked` to verify consent and `allowedEventTypes` blocks
   for SDK calls that reach Core.
3. Deduplicate forwarded events by event semantics, not by UI lifecycle, because Android views can
   be recreated during configuration or navigation changes.
4. Use `eventStream`, `EventEmissionResult`, queue callbacks, tracking timing checks, adapter state,
   debug logs, or app-owned diagnostics for other suppressed behavior.

**Adapt this to your use case:**

```kotlin
lifecycleScope.launch {
    repeatOnLifecycle(Lifecycle.State.STARTED) {
        OptimizationManager.client.eventStream.collect { event ->
            // Deduplicate before forwarding outside debug displays or test assertions.
            analyticsDebugger.render(event)
        }
    }
}
```

For forwarding SDK context to other destinations, see
[Forwarding Optimization SDK context to analytics and tag management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Custom Flags and MergeTag rendering

**Integration category:** Optional

Custom Flags and MergeTag helpers read profile-backed values from the initialized
`OptimizationClient`. Use them from Views, adapters, or binders that already wait for SDK
initialization.

1. Use `client.getFlag(name)` for a one-time Custom Flag read.
2. Use `client.observeFlag(name)` when a View needs a `StateFlow` that updates with flag value
   changes.
3. Use `client.getMergeTagValue(mergeTagEntry)` while rendering Contentful Rich Text that includes
   resolved `nt_mergetag` entries.
4. Provide fallback text when a merge tag is unresolved, missing, or unavailable for the active
   profile.

**Adapt this to your use case:**

```kotlin
lifecycleScope.launch {
    OptimizationManager.client.isInitialized.first { it }

    val headlineFlag = OptimizationManager.client.getFlag("homepage-headline")
    headlineBadge.text = headlineFlag?.toString() ?: "default"
}
```

**Adapt this to your use case:**

```kotlin
lifecycleScope.launch {
    OptimizationManager.client.isInitialized.first { it }
    val ctaFlag = OptimizationManager.client.observeFlag("homepage-cta")

    repeatOnLifecycle(Lifecycle.State.STARTED) {
        ctaFlag.collect { flagValue ->
            ctaButton.text = flagValue?.toString() ?: "Continue"
        }
    }
}
```

**Follow this pattern:**

```kotlin
suspend fun resolveMergeTagText(
    mergeTagEntry: Map<String, Any>,
): String {
    OptimizationManager.client.isInitialized.first { it }

    // Keep fallback copy in the app so unresolved merge tags do not break Rich Text rendering.
    return OptimizationManager.client.getMergeTagValue(mergeTagEntry)
        ?: readFallbackValue(mergeTagEntry)
        ?: "[Merge Tag]"
}
```

### Live updates and variant locking

**Integration category:** Optional

1. Keep live updates disabled for reading surfaces where content must not change while the visitor
   is looking at it. This is the default global Views behavior.
2. Enable live updates globally when most rendered entries must react to profile or preview changes
   without remounting.

**Adapt this to your use case:**

```kotlin
OptimizationManager.initialize(
    context = this,
    config = optimizationConfig,
    // Live updates let mounted OptimizedEntryView instances react to profile changes.
    liveUpdates = true,
)
```

3. Override live updates per entry when only one component needs live behavior.

**Adapt this to your use case:**

```kotlin
OptimizedEntryView(context).apply {
    // Override the global locking behavior only for entries that must update while mounted.
    liveUpdates = true
    setContentRenderer { resolvedEntry ->
        DashboardBinder.create(context, resolvedEntry)
    }
    setEntry(dashboardEntry)
}
```

When the preview panel is open, `OptimizedEntryView` instances re-resolve live so audience and
variant overrides apply immediately. When the panel closes, only non-live optimized entries without
a caller-supplied `selectedOptimizations` override lock to the previewed selection. Live entries
continue following `client.selectedOptimizations`, and explicit overrides keep resolving from their
explicit value. For precedence rules, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

## Advanced integrations

### Preview panel

**Integration category:** Advanced or production-only

1. Gate the preview panel behind a debug, internal-build, or staff-only condition. In Android Views
   integrations, the Activity controls visibility by deciding whether to call
   `OptimizationManager.attachPreviewPanel(...)`.
2. Pass `PreviewPanelConfig(contentfulClient = previewContentfulClient)` during initialization when
   the panel must display audience and experience names. Without a `PreviewContentfulClient`, the
   panel falls back to identifiers.

**Adapt this to your use case:**

```kotlin
OptimizationManager.initialize(
    context = this,
    config = optimizationConfig,
    // Keep preview definitions behind a debug or internal-build gate.
    previewPanel = if (BuildConfig.DEBUG) {
        PreviewPanelConfig(contentfulClient = previewContentfulClient)
    } else {
        null
    },
)
```

3. Call `attachPreviewPanel(...)` after `setContentView(...)` in each Activity that displays the
   floating entry point.

**Adapt this to your use case:**

```kotlin
class HomeActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.home)

        if (BuildConfig.DEBUG) {
            // Attach after setContentView so the floating entry point mounts into this Activity.
            OptimizationManager.attachPreviewPanel(this)
        }
    }
}
```

4. Do not expose preview controls in production traffic unless your organization has an explicit
   internal-access policy. Preview overrides can force audience qualification and variant selection
   for the local device.

### Offline delivery and queue observability

**Integration category:** Advanced or production-only

1. Use the default queue behavior unless the app has production delivery budgets or observability
   requirements that need custom bounds.
2. Configure `QueuePolicy` for offline event caps, retry behavior, and delivery callbacks.

**Adapt this to your use case:**

```kotlin
val optimizationConfig = OptimizationConfig(
    clientId = "your-client-id",
    queuePolicy = QueuePolicy(
        // Cap offline storage according to the app's production delivery budget.
        offlineMaxEvents = 100,
        onOfflineDrop = { event ->
            Log.w("Optimization", "Dropped offline event: ${event.context}")
        },
    ),
)
```

The Android SDK monitors network reachability, queues events while offline, flushes when
connectivity returns, and flushes when the app moves toward the background. For the runtime model,
see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#offline-and-app-lifecycle-delivery).

## Production checks

Before releasing an Android Views integration, verify these points:

- **Credentials and runtime configuration** - The app uses the correct Maven coordinate, client ID,
  Contentful environment, SDK locale, and any non-default Experience API or Insights API endpoints.
- **Consent behavior** - Default-on consent is seeded only when policy permits it, consent UI calls
  `client.consent(...)` for every choice, withdrawal blocks later gated events, and suppressed
  interactions are not replayed later.
- **Event delivery** - Screen, custom, view, and tap events are accepted in the expected consent
  states, offline delivery flushes after reconnect, and debug event displays or forwarding code are
  not exposed to unintended audiences.
- **Content fallback behavior** - Optimized entries are fetched with one Contentful locale and
  resolved optimization links. Baseline fallback is accepted for missing selections, unresolved
  links, out-of-range variants, blocked or non-allow-listed profile-producing events, and users who
  do not qualify for a variant.
- **Duplicate tracking prevention** - RecyclerView adapters and state collectors do not recreate
  `OptimizedEntryView` instances on every SDK state emission. Stable item rendering prevents dwell
  timers and component event metadata from resetting mid-view.
- **Privacy and governance** - Identity traits, custom event properties, forwarded analytics events,
  preview overrides, and persisted profile continuity follow the app's privacy policy and consent
  record.
- **Local validation path** - For the reference implementation, run targeted Views Maestro flows
  such as `pnpm implementation:run -- android-sdk test:e2e:views -- --flow tap-tracking`,
  `pnpm implementation:run -- android-sdk test:e2e:views -- --flow screen-tracking`, and
  `pnpm implementation:run -- android-sdk test:e2e:views -- --flow live-updates` when those
  behaviors are relevant.

## Troubleshooting

| Symptom                                  | Likely cause                                                                                                                                                           | Action                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `OptimizationManager.client` throws      | The app read the client before calling `OptimizationManager.initialize(...)`.                                                                                          | Initialize once before Activity or Fragment code reads the client.                                                   |
| Suspend API calls fail or no-op          | The bridge has not finished initializing.                                                                                                                              | Wait for `client.isInitialized.first { it }` before direct suspend calls.                                            |
| Entries always render baseline content   | Blocked or non-allow-listed profile-producing events, strict opt-in without accepted consent, missing selections, unresolved links, or all-locale Contentful payloads. | Accept consent or allow the needed screen or identity event, verify selections, fetch one locale, and include links. |
| View or tap events do not appear         | Consent blocks tracking, tracking is opted out, dwell timing is not met, or views are recreated mid-dwell.                                                             | Check consent state, `trackViews`, `trackTaps`, visibility timing, and adapter stability.                            |
| Preview panel shows identifiers only     | No preview `PreviewContentfulClient` was passed during initialization.                                                                                                 | Pass `PreviewPanelConfig(contentfulClient = previewContentfulClient)` for rich definitions.                          |
| Preview panel appears in the wrong build | The Activity calls `attachPreviewPanel(...)` without an app-owned gate.                                                                                                | Wrap the attach call in a debug, internal-build, or staff-only condition.                                            |

## Reference implementations to compare against

- [Android reference implementation](../../implementations/android-sdk/README.md) - Demonstrates the
  same native SDK behavior in Compose and Android Views shells, including entry resolution,
  interaction tracking, screen tracking, live updates, Custom Flags, `getMergeTagValue(...)`,
  preview-panel overrides, and mock API flows.
