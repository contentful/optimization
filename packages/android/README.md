<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Optimization & Analytics</h1>

<h3 align="center">Optimization Android SDK</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

The Optimization Android SDK is a pre-release Kotlin Android library for native Android
applications. It is part of the [Contentful Optimization SDK Suite](../../README.md) and runs shared
optimization behavior through a local QuickJS bridge while Kotlin code owns native app concerns such
as persistence, networking, lifecycle handling, Jetpack Compose UI, XML Views UI, and preview-panel
UI.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting started](#getting-started)
  - [Requirements](#requirements)
  - [Add the dependency](#add-the-dependency)
  - [Compose quick start](#compose-quick-start)
  - [XML Views quick start](#xml-views-quick-start)
- [When to use this package](#when-to-use-this-package)
- [Reference implementation](#reference-implementation)
- [Configuration](#configuration)
  - [Common options](#common-options)
  - [Locale handling](#locale-handling)
  - [Consent and persistence](#consent-and-persistence)
- [Runtime notes](#runtime-notes)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

### Requirements

- Android `minSdk` 24 or later.
- Java 11 bytecode support in the consuming Android project.
- A Kotlin Android application built with Jetpack Compose or XML Views.
- Maven Central configured in the consuming build.

### Add the dependency

Add the SDK to your Android application module:

```kotlin
repositories {
    mavenCentral()
}

dependencies {
    implementation("com.contentful.java:optimization-android:<version>")
}
```

Use the version that matches the Optimization SDK Suite release you are adopting. The package is
published to Maven Central as `com.contentful.java:optimization-android`.

### Compose quick start

Compose apps usually initialize the SDK with `OptimizationRoot`, render Contentful entries with
`OptimizedEntry`, and emit screen events with `ScreenTrackingEffect`.

```kotlin
val appLocale = "en-US"

val optimizationConfig = OptimizationConfig(
    clientId = "your-client-id",
    environment = "main",
    locale = appLocale,
    logLevel = if (BuildConfig.DEBUG) OptimizationLogLevel.debug else OptimizationLogLevel.error,
)

@Composable
fun AppRoot(heroEntry: Map<String, Any>) {
    OptimizationRoot(
        config = optimizationConfig,
        trackViews = true,
        trackTaps = false,
        previewPanel = if (BuildConfig.DEBUG) PreviewPanelConfig() else null,
    ) {
        HomeScreen(heroEntry = heroEntry)
    }
}

@Composable
fun HomeScreen(heroEntry: Map<String, Any>) {
    ScreenTrackingEffect(screenName = "Home")

    OptimizedEntry(
        entry = heroEntry,
        trackTaps = true,
    ) { resolvedEntry ->
        HeroCard(entry = resolvedEntry)
    }
}
```

For the full Compose flow, see
[Integrating the Optimization Android SDK in a Jetpack Compose app](../../documentation/guides/integrating-the-optimization-android-sdk-in-a-compose-app.md).

### XML Views quick start

XML Views apps usually initialize the SDK once from `Application.onCreate`, render Contentful
entries with `OptimizedEntryView`, and emit screen events with `ScreenTracker`.

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        OptimizationManager.initialize(
            context = this,
            config = optimizationConfig,
            trackViews = true,
            trackTaps = false,
            previewPanel = PreviewPanelConfig(),
        )
    }
}

class HomeActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (BuildConfig.DEBUG) {
            OptimizationManager.attachPreviewPanel(this)
        }
    }

    override fun onResume() {
        super.onResume()
        ScreenTracker.trackScreen("Home")
    }

    fun renderHero(entry: Map<String, Any>): View {
        return OptimizedEntryView(this).apply {
            trackTaps = true
            setContentRenderer { resolvedEntry ->
                HeroBinder.create(context, resolvedEntry)
            }
            setEntry(entry)
        }
    }
}
```

For the full XML Views flow, see
[Integrating the Optimization Android SDK in an XML Views app](../../documentation/guides/integrating-the-optimization-android-sdk-in-a-views-app.md).

## When to use this package

Use this package when building a native Android application that needs Contentful Optimization and
Analytics through Kotlin APIs. The same AAR includes:

- `com.contentful.optimization.core` for the stateful `OptimizationClient`, configuration, entry
  optimization, event tracking, and preview controls.
- `com.contentful.optimization.compose` for Jetpack Compose apps.
- `com.contentful.optimization.views` for XML Views apps.

For React Native applications, use
[`@contentful/optimization-react-native`](../react-native-sdk/README.md) instead.

## Reference implementation

The [Android reference implementation](../../implementations/android-sdk/README.md) demonstrates the
same SDK behavior in Compose and XML Views shells. It exercises entry resolution, interaction
tracking, screen tracking, live updates, preview-panel overrides, and shared mock API flows.

## Configuration

### Common options

| Option              | Required? | Default                      | Description                                                                                        |
| ------------------- | --------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `clientId`          | Yes       | None                         | Optimization client identifier used for Experience API and Insights API calls.                     |
| `environment`       | No        | `main`                       | Contentful environment name used by the Optimization APIs.                                         |
| `api`               | No        | `null`                       | `OptimizationApiConfig` for endpoint overrides, enabled Experience features, and preflight.        |
| `locale`            | No        | `null`                       | SDK Experience API and default event locale.                                                       |
| `defaults`          | No        | `null`                       | Initial persisted-state seeds such as consent, persistence consent, profile, or selected variants. |
| `allowedEventTypes` | No        | Bridge default               | Event types allowed before consent is explicitly set.                                              |
| `logLevel`          | No        | `OptimizationLogLevel.error` | Minimum native and bridge log level.                                                               |
| `queuePolicy`       | No        | SDK defaults                 | Queue flush retry behavior, offline bounds, and queue observability callbacks.                     |
| `onEventBlocked`    | No        | `null`                       | Callback invoked with `reason`, `method`, and `args` when consent or guard logic blocks an event.  |

`OptimizationRoot` and `OptimizationManager.initialize(...)` also accept global `trackViews`,
`trackTaps`, and `liveUpdates` defaults. `OptimizedEntry` and `OptimizedEntryView` can override
those defaults per entry.

### Locale handling

For a single-locale app, choose the application Contentful locale and pass the same value to SDK
`locale` when Experience API responses and events should use that language:

```kotlin
val appLocale = "en-US"

val config = OptimizationConfig(
    clientId = "your-client-id",
    environment = "main",
    locale = appLocale,
)
```

For localized apps, derive `appLocale` from your navigation, i18n, or app configuration layer:

```kotlin
val appLocale = getAppLocale()

val config = OptimizationConfig(
    clientId = "your-client-id",
    environment = "main",
    locale = appLocale,
)
```

Use the same `appLocale` when your app-owned Contentful Delivery API client fetches entries that
will be passed to `OptimizedEntry`, `OptimizedEntryView`, or `client.resolveOptimizedEntry(...)`.
The native SDK does not fetch Contentful entries for your app layer, so the CDA locale belongs in
your CDA request code.

For the full locale model, see
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md).
For the single-locale CDA entry contract, see
[Entry optimization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

### Consent and persistence

SDK state is persisted with `SharedPreferences`. For default-on application policies that do not
render an end-user consent UI, set `defaults = StorageDefaults(consent = true)` on
`OptimizationConfig`:

```kotlin
val config = OptimizationConfig(
    clientId = "your-client-id",
    defaults = StorageDefaults(consent = true),
)
```

When application policy depends on user choice, leave consent unset and call `client.consent(true)`
or `client.consent(false)` from the application-owned control. Boolean consent calls control both
event emission and durable profile-continuity persistence by default. Use
`client.consent(events = true, persistence = false)` when events are allowed but continuity should
stay session-only. For cross-SDK consent guidance, see
[Consent management in the Optimization SDK Suite](../../documentation/concepts/consent-management-in-the-optimization-sdk-suite.md).

When durable profile-continuity persistence is allowed, the Android SDK settles the
`SharedPreferences` write for profile, changes, selected optimizations, and anonymous ID before
publishing the corresponding client state. Application code and E2E tests can wait for SDK-derived
state rather than adding storage-timing delays before relaunching.

## Runtime notes

- The SDK library manifest declares the required network permissions and the non-exported preview
  panel Activity.
- No JavaScript bridge setup is required in consuming applications. The generated QuickJS bundle is
  packaged inside the AAR.
- Use `client.track("Purchase Completed", mapOf("sku" to "sku-1"))` for custom business events;
  `identify(...)`, `screen(...)`, and sticky `trackView(...)` return `EventEmissionResult` values
  with `accepted` and optional `data`. `trackClick(...)` remains available for entry-interaction
  flows.
- For typed event calls, pass `IdentifyPayload`, `PageEventPayload`, `ScreenEventPayload`, or
  `TrackEventPayload`. Map-based overloads remain available for dynamic JSON payloads.
- Use `client.getFlag(name)` for a one-off Custom Flag read and `client.observeFlag(name)` for a
  `StateFlow<JSONValue?>` that updates as flag values change.
- Use `client.eventStream` and `client.blockedEventStream` for analytics debugging, tests, and
  consent-gating diagnostics.
- Analytics events queue while the device is offline and flush when connectivity returns or the app
  moves toward the background.
- For bridge architecture and maintainer build details, see
  [Native bridge architecture](../universal/optimization-js-bridge/BRIDGE_ARCHITECTURE.md).

## Related

- [Compose integration guide](../../documentation/guides/integrating-the-optimization-android-sdk-in-a-compose-app.md) -
  step-by-step setup for `OptimizationRoot`, `OptimizedEntry`, screen tracking, and preview panel
  mounting.
- [XML Views integration guide](../../documentation/guides/integrating-the-optimization-android-sdk-in-a-views-app.md) -
  step-by-step setup for `OptimizationManager`, `OptimizedEntryView`, screen tracking, and preview
  panel mounting.
- [Android SDK runtime and interaction mechanics](../../documentation/concepts/android-sdk-runtime-and-interaction-mechanics.md) -
  explains runtime state, consent, tracking, live updates, preview overrides, and offline delivery.
- [Android reference implementation](../../implementations/android-sdk/README.md) - Compose and XML
  Views apps that validate the SDK against the shared mock API.
- [React Native SDK](../react-native-sdk/README.md) - Mobile integration for React Native
  applications.
- [Core SDK](../universal/core-sdk/README.md) - Shared optimization foundation used through the
  native bridge.
