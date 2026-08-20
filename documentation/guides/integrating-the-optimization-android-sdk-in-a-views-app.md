# Integrating the Optimization Android SDK in an Android Views app

Use this guide to add Contentful personalization to a native Android app built with XML layouts and
Android Views. By the end of the quick start, the SDK is running from your application and one screen
event has passed the SDK's consent gate, with a visible label confirming it.

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

The Android SDK persists the profile in `SharedPreferences` across app launches when persistence
consent allows it.

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.

You will get there in two milestones:

- **Milestone 1 — the SDK initialized from your application and one accepted screen event (the quick
  start below).** Once your app also hands the SDK a fetched Contentful entry, that entry resolves to
  a variant or the baseline through `OptimizedEntryView` and `resolveOptimizedEntry` (the
  [Contentful fetching and entry resolution](#contentful-fetching-and-entry-resolution) section).
  This is complete and shippable on its own.
- **Milestone 2 — the opt-in layers (later).** Consent handoff, interaction tracking, identity,
  Custom Flags, live updates, the preview panel, and offline delivery, each introduced by the section
  that needs it. Start with [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff).

This guide uses `com.contentful.java:optimization-android`. Android Views apps drive the SDK through
an application-scoped `OptimizationManager` singleton: you initialize it once from your `Application`,
then read `OptimizationManager.client` from the activities and fragments that track events or resolve
entries. The SDK does not replace your Contentful client — your app still owns Contentful fetching,
link resolution, consent UX, identity policy, navigation, caching, and rendering. If your screens are
built with Jetpack Compose instead, use the
[Integrating the Optimization Android SDK in a Jetpack Compose app](./integrating-the-optimization-android-sdk-in-a-compose-app.md)
guide.

## Quick start

Most Android Views apps share one shape: an `Application` subclass runs process-wide setup, and an
`Activity` presents content. This quick start assumes that shape and proves the smallest result: **the
SDK initializes from your application and one screen event is accepted, and a visible label flips to
confirm it.** It initializes one manager in `Application.onCreate`, registers the subclass in the
manifest, and tracks the current screen from an activity's `onResume`.

> [!WARNING]
>
> This quick start assumes your application policy permits Optimization to start with accepted
> consent and renders no end-user consent UI, so it seeds `StorageDefaults(consent = true)` — the
> shorthand that accepts both consent axes at once. If personalization must wait for a consent
> decision, keep this structure and add the
> [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff) step before you ship; it
> explains the two axes and the split form that sets them separately.

1. Add the SDK dependency to your application module from Maven Central.

   **Copy this:**

   ```kotlin
   repositories {
       mavenCentral()
   }

   dependencies {
       implementation("com.contentful.java:optimization-android:<version>")
   }
   ```

   The SDK declares `com.squareup.okhttp3:okhttp-android:5.x` as a runtime dependency directly,
   because `contentful.java` 5.x pulls in okhttp 5.x's KMP metadata parent (`com.squareup.okhttp3:okhttp`
   — a placeholder artifact Gradle resolves instead of a real implementation) whose `okhttp-jvm`
   variant is excluded on Android; without an Android runtime variant, the app throws
   `ClassNotFoundException: okhttp3.OkHttpClient` at launch. If your app declares
   `com.contentful.java:java-sdk` directly (or any other dependency that pulls the same KMP parent),
   exclude `com.squareup.okhttp3:okhttp-jvm` from it and align all okhttp declarations on 5.x so the
   two variants do not coexist and cause duplicate-class packaging failures. See
   [Troubleshooting](#troubleshooting) if you still see `ClassNotFoundException: okhttp3.OkHttpClient`
   after adding the dependency.

   **Adapt this to your use case:**

   ```kotlin
   dependencies {
       implementation("com.contentful.java:optimization-android:<version>")
       implementation("com.contentful.java:java-sdk:<version>") {
           exclude(group = "com.squareup.okhttp3", module = "okhttp-jvm")
       }
   }
   ```

2. Initialize the SDK from your `Application` subclass. `OptimizationManager.initialize(...)` is a
   normal (non-suspend) call that constructs the process-wide client and starts it in the background;
   activities read `OptimizationManager.client` afterward.

   The unchanged lines in the diff below are illustrative context to match against your own
   `Application` subclass, not a block to paste over it. If your app has no `Application` subclass
   yet, the whole file is new. `StorageDefaults` is an SDK config type that carries the SDK's startup
   state, including the two consent axes; `StorageDefaults(consent = true)` grants both at launch.
   `OptimizationLogLevel.debug` is verbose and not the SDK default (`error`); it is used here so you
   can see the SDK's activity in logcat while verifying the quick start, but dial it back for
   production (see step 4 below and
   [Production checks](#production-checks)).

   **Adapt this to your use case:**

   ```diff
   +import com.contentful.optimization.core.OptimizationConfig
   +import com.contentful.optimization.core.OptimizationLogLevel
   +import com.contentful.optimization.core.StorageDefaults
   +import com.contentful.optimization.views.OptimizationManager
    import android.app.Application

    class MyApplication : Application() {
        override fun onCreate() {
            super.onCreate()

   +        // Initialize once for the process, before any activity reads OptimizationManager.client.
   +        // StorageDefaults carries startup state; consent = true accepts both consent axes now.
   +        OptimizationManager.initialize(
   +            context = this,
   +            config = OptimizationConfig(
   +                clientId = "your-optimization-client-id",
   +                // environment defaults to "main"; pass it only when your setup differs.
   +                locale = "en-US",
   +                defaults = StorageDefaults(consent = true),
   +                // debug is verbose and non-default; useful here to see activity in logcat.
   +                logLevel = OptimizationLogLevel.debug,
   +            ),
   +        )
        }
    }
   ```

   Then register the subclass in `AndroidManifest.xml` with `android:name`. Without it,
   `Application.onCreate` never runs and the SDK never initializes.

   **Adapt this to your use case:**

   ```diff
    <application
   +    android:name=".MyApplication"
        android:label="@string/app_name"
        android:theme="@style/Theme.MyApp">
   ```

3. Track the current screen from an activity and reflect the outcome in a label. `HomeActivity` below
   is illustrative app shape — adapt it to a screen you already render, keeping the two stream
   subscriptions and the `ScreenTracker.trackScreen` call in `onResume`.

   Add a `TextView` with the id `optimization_status` to that screen's layout (for example
   `activity_home.xml`) before wiring the code below — the `findViewById<TextView>(R.id.optimization_status)`
   call requires it to already exist in the layout.

   **Copy this:**

   ```xml
   <TextView
       android:id="@+id/optimization_status"
       android:layout_width="wrap_content"
       android:layout_height="wrap_content"
       android:text="Waiting for Optimization" />
   ```

   **Adapt this to your use case:**

   ```diff
   +import androidx.lifecycle.Lifecycle
   +import androidx.lifecycle.lifecycleScope
   +import androidx.lifecycle.repeatOnLifecycle
   +import com.contentful.optimization.views.OptimizationManager
   +import com.contentful.optimization.views.ScreenTracker
   +import kotlinx.coroutines.launch
    import android.os.Bundle
    import android.widget.TextView
    import androidx.appcompat.app.AppCompatActivity

    class HomeActivity : AppCompatActivity() {
   +    private val statusLabel by lazy { findViewById<TextView>(R.id.optimization_status) }

        override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)
            setContentView(R.layout.activity_home)
   +        statusLabel.text = "Waiting for Optimization"
   +
   +        // eventStream carries accepted events. It is a replay-buffered SharedFlow, so this
   +        // collector still receives the screen event even if it subscribes just after it fired.
   +        lifecycleScope.launch {
   +            repeatOnLifecycle(Lifecycle.State.STARTED) {
   +                OptimizationManager.client.eventStream.collect { event ->
   +                    // Screen events carry type == "screen" (the value the SDK emits).
   +                    if (event["type"] as? String == "screen") {
   +                        statusLabel.text = "Optimization screen event accepted"
   +                    }
   +                }
   +            }
   +        }
   +        // blockedEventStream carries events the consent or allow-list gate stopped.
   +        lifecycleScope.launch {
   +            repeatOnLifecycle(Lifecycle.State.STARTED) {
   +                OptimizationManager.client.blockedEventStream.collect { blocked ->
   +                    statusLabel.text = "Optimization screen event blocked: ${blocked.reason}"
   +                }
   +            }
   +        }
        }

   +    override fun onResume() {
   +        super.onResume()
   +        // ScreenTracker tracks the current screen and retries once the SDK is ready and consent
   +        // allows, so it is safe to call here without awaiting initialization yourself.
   +        ScreenTracker.trackScreen("Home")
   +    }
    }
   ```

   The surrounding activity code is illustrative context to match against your own screen, not a block
   to paste over it. `statusLabel` is a reader-owned `TextView`; give it an id in the layout you
   already use for this screen.

4. Verify the first run. Build and run the application module on a device or emulator. The status
   label reads `Optimization screen event accepted`. It flips when the `screen` event reaches
   `eventStream`, which carries events that passed the SDK's local consent and allow-list gate. Here,
   "accepted" means the SDK let the event through and queued it for delivery — it does not confirm
   that Contentful received the event, only that the local gate let it through. Because
   `StorageDefaults(consent = true)` grants consent and `screen` is on the SDK's default pre-consent
   allow-list, the event is accepted.

   If the label reads `Optimization screen event blocked: <reason>`, the consent or allow-list gate
   rejected the event and the reason names why. If the label stays on `Waiting for Optimization`, no
   event reached either stream, which means the SDK never initialized. Filter logcat by the tag
   `ContentfulOptimization`: a successful start logs `[init] SDK initialized successfully` (visible
   because `logLevel = OptimizationLogLevel.debug`). If that line never appears, the most common
   Android cause is the missing manifest registration — without `android:name=".MyApplication"` on
   `<application>`, `Application.onCreate` never runs and `OptimizationManager.initialize(...)` is
   never called.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [SDK installation and process-wide client](#sdk-installation-and-process-wide-client)
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

- **An Android Views app and its Gradle build**, able to add a Maven Central dependency and run a
  build. The SDK requires `minSdk` 24 or later and Java 11 bytecode, and it publishes to Maven
  Central. Package requirements and the published coordinate are in the
  [Optimization Android SDK README](../../packages/android/README.md).
- **A working app-owned Contentful Delivery API (CDA) client or fetch layer**, configured with your
  space ID, delivery token, and environment. It must already be able to fetch one entry with a
  concrete locale and enough link depth for referenced entries. The native SDK does not provide this
  fetch layer.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. In the Contentful web app, the path depends on which navigation your organization uses;
  check your left-hand sidebar to tell which one applies: if it shows a top-level **Apps** entry, you
  are on classic navigation; if it shows a top-level **Platform** entry above **Apps**, you are on new
  navigation (the Contentful app with ExO navigation enabled). In **classic navigation**, go to
  **Apps → Installed apps → Contentful Personalization → SDK keys**; in **new navigation**, go to
  **Platform/Apps → Installed apps → Contentful Personalization → SDK keys**. The Client ID and
  environment are listed there.

  The `environment` defaults to `main`, so pass it only when your setup differs. The Experience API
  (which picks variants) and the Insights API (which receives event and interaction delivery) each
  have a base URL that defaults correctly; you only set them for mocks or non-default hosts (see
  [SDK installation and process-wide client](#sdk-installation-and-process-wide-client)).

You do not need a setup inventory up front. Everything else — consent, entry resolution, screen
tracking, interaction tracking, identity, live updates, preview, and offline delivery — is introduced
by the section that needs it.

> [!NOTE]
>
> Read the SDK client ID, Contentful credentials, and any base-URL overrides from your app's own
> configuration layer — `BuildConfig` fields, a Gradle build value, or a generated config type. This
> guide's examples use inline placeholder strings for clarity; the Android reference app centralizes
> these in a shared `AppConfig` because it runs against shared mock defaults. Use whatever
> configuration convention your app already uses and keep it consistent.

## Core integration

### SDK installation and process-wide client

**Integration category:** Required for first integration

The Android SDK ships as one AAR on Maven Central and runs its shared optimization logic in a small
runtime embedded in the AAR (referred to as the bridge below). That runtime starts asynchronously, so
callers wait for readiness before making direct calls that depend on it.

1. Confirm the consuming app supports `minSdk` 24 or later, Java 11 bytecode, Kotlin, and Maven
   Central, then add the dependency to the application module.

   **Copy this:**

   ```kotlin
   repositories {
       mavenCentral()
   }

   dependencies {
       implementation("com.contentful.java:optimization-android:<version>")
   }
   ```

   The SDK declares `com.squareup.okhttp3:okhttp-android:5.x` as a runtime dependency directly,
   because `contentful.java` 5.x pulls in okhttp 5.x's KMP metadata parent (`com.squareup.okhttp3:okhttp`)
   whose `okhttp-jvm` variant is excluded on Android; without an Android runtime variant, the app
   throws `ClassNotFoundException: okhttp3.OkHttpClient` at launch. If your app declares
   `com.contentful.java:java-sdk` directly (or any other dependency that pulls the same KMP parent),
   exclude `com.squareup.okhttp3:okhttp-jvm` from it and align all okhttp declarations on 5.x so the
   two variants do not coexist and cause duplicate-class packaging failures.

   **Adapt this to your use case:**

   ```kotlin
   dependencies {
       implementation("com.contentful.java:optimization-android:<version>")
       implementation("com.contentful.java:java-sdk:<version>") {
           exclude(group = "com.squareup.okhttp3", module = "okhttp-jvm")
       }
   }
   ```

2. Build one `OptimizationConfig`. Only `clientId` is required; the rest have working defaults.
   1. Pass `clientId` from your configuration layer.
   2. Pass `environment` only when it is not the Kotlin-side default `"main"`.
   3. Pass `locale` when Experience API requests and event context must use the same language as the
      Contentful entries you render.
   4. Set `api = OptimizationApiConfig(...)` (`experienceBaseUrl`/`insightsBaseUrl`) only for mock,
      staging, or other non-default endpoints — both default correctly otherwise.
   5. Keep `logLevel` at its default `OptimizationLogLevel.error` in production unless your
      operational policy allows more verbose logging.

   **Adapt this to your use case:**

   ```kotlin
   val optimizationConfig = OptimizationConfig(
       clientId = "your-optimization-client-id",
       // environment defaults to "main"; pass it only when your setup differs.
       // Keep the SDK event and Experience locale aligned with the CDA entries you render.
       locale = "en-US",
       logLevel = if (BuildConfig.DEBUG) {
           OptimizationLogLevel.debug
       } else {
           OptimizationLogLevel.error
       },
   )
   ```

3. Initialize `OptimizationManager` once for the process, from `Application.onCreate`, and register
   the `Application` subclass in the manifest (see the quick start). `initialize` is idempotent — the
   first call constructs and starts the client; later calls only update the global tracking defaults
   and preview client and do not recreate it. Reading `OptimizationManager.client` before `initialize`
   throws.

   **Adapt this to your use case:**

   ```kotlin
   class MyApplication : Application() {
       override fun onCreate() {
           super.onCreate()
           // Initialize once before any activity or fragment reads OptimizationManager.client.
           OptimizationManager.initialize(context = this, config = optimizationConfig)
       }
   }
   ```

4. Await readiness for direct suspend calls. `OptimizationManager.client` is available immediately,
   but the underlying `OptimizationClient.initialize(config)` is a `suspend` function that
   `OptimizationManager` launches in the background, so suspend APIs that touch the bridge require
   `client.isInitialized` to become `true` first. (Screen tracking through `ScreenTracker` and entry
   rendering through `OptimizedEntryView` handle this readiness for you; the await matters when you
   call the client directly.)

   **Copy this:**

   ```kotlin
   lifecycleScope.launch {
       // Direct suspend APIs require the background initialization to finish first.
       OptimizationManager.client.isInitialized.first { it }
       OptimizationManager.client.track(event = "App Ready", properties = mapOf("surface" to "views"))
   }
   ```

For lifecycle and coroutine behavior, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-coroutines).

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

Consent policy belongs to your application. The SDK provides the runtime gate; your app or CMP owns
notice text, user choices, consent records, jurisdiction logic, and withdrawal behavior. Consent has
two independent axes: event consent (may the SDK personalize and emit events) and persistence consent
(may the SDK store profile continuity in `SharedPreferences`).

1. Use `StorageDefaults(consent = true)` at startup only when application policy permits SDK activity
   at launch. `StorageDefaults` values take precedence over persisted `SharedPreferences` values on
   every launch, so a seeded value can replace a stored choice — apps that persist a user's decision
   leave `defaults` unset and call `consent(...)` from resolved policy instead.

   **Copy this:**

   ```kotlin
   val optimizationConfig = OptimizationConfig(
       clientId = "your-optimization-client-id",
       // Seed accepted consent only when your app policy permits event emission at startup.
       defaults = StorageDefaults(consent = true),
   )
   ```

2. Leave `defaults` unset when the app must collect a choice before gated events can emit, and call
   `consent(...)` from an app-owned banner, CMP callback, or settings flow. `consent(...)` no-ops
   before initialization, so wait for readiness before applying a choice. `client.state` exposes the
   current decision as a tri-state `consent: Boolean?` — `true`, `false`, or `null` when the visitor
   has not decided yet — so you can observe `state.consent == null` to know when to show the banner.

   **Adapt this to your use case:**

   ```kotlin
   class ConsentActivity : AppCompatActivity() {
       private val client get() = OptimizationManager.client

       override fun onCreate(savedInstanceState: Bundle?) {
           super.onCreate(savedInstanceState)
           setContentView(R.layout.activity_consent)

           // acceptButton, rejectButton, and consentBanner are reader-owned views from your layout.
           acceptButton.setOnClickListener { applyConsent(true) }
           rejectButton.setOnClickListener { applyConsent(false) }

           // Show the banner only while consent is undecided (null); hide it once the visitor chooses.
           lifecycleScope.launch {
               repeatOnLifecycle(Lifecycle.State.STARTED) {
                   client.state.collect { state ->
                       consentBanner.isVisible = state.consent == null
                   }
               }
           }
       }

       private fun applyConsent(accepted: Boolean) {
           lifecycleScope.launch {
               // consent(...) no-ops before initialization, so wait before applying the choice.
               client.isInitialized.first { it }
               // Boolean consent sets both event emission and durable profile continuity.
               client.consent(accepted)
           }
       }
   }
   ```

3. Use the split form when event emission is allowed but durable profile continuity must stay
   session-only.

   | Axis                | Call form                                                | Effect                                                                           |
   | ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
   | Event consent       | `consent(true)` or `consent(events = true)`              | Allows event emission.                                                           |
   | Event consent       | `consent(false)` or `consent(events = false)`            | Withdraws event consent and purges queued events.                                |
   | Persistence consent | `consent(true)` (boolean form)                           | Allows durable profile continuity in `SharedPreferences`.                        |
   | Persistence consent | `consent(events = false)` (persistence omitted)          | Leaves persistence consent unchanged — only the event axis is withdrawn.         |
   | Persistence consent | `consent(false)` (boolean form) or `persistence = false` | Clears durable continuity; in-memory state stays usable until reset or teardown. |

   The boolean form `consent(accepted)` sets both axes at once; the split form
   `consent(events = ..., persistence = ...)` sets them independently, and any axis you omit from the
   split form is left unchanged.

   **Adapt this to your use case:**

   ```kotlin
   lifecycleScope.launch {
       OptimizationManager.client.isInitialized.first { it }
       // Emit events but keep profile continuity session-only.
       OptimizationManager.client.consent(events = true, persistence = false)
   }
   ```

Before event consent is accepted, `allowedEventTypes` is the whole admission rule: any event type in
the list emits with no consent decision at all. When `allowedEventTypes` is unset, the SDK's default
pre-consent allow-list lets `identify` and `screen` emit before event consent, so a mobile journey
can establish profile context and anonymous screen analytics. Entry views, entry taps, and custom
`track` events are blocked until consent is accepted or you allow-list them. To require strict
opt-in before any Optimization event, replace the default allow-list during initialization.

**Copy this:**

```kotlin
val strictConfig = OptimizationConfig(
    clientId = "your-optimization-client-id",
    // Empty means no SDK event emits before explicit consent.
    allowedEventTypes = emptyList(),
)
```

Setting `allowedEventTypes = emptyList()` disables the default pre-consent allow-list the Quick
Start relies on: the `ScreenTracker.trackScreen("Home")` call blocks until the visitor accepts
consent, and the label stays on `"Waiting for Optimization"` until then. Use this config only after
the app has wired the consent flow from step 2 above — otherwise the Quick Start looks broken with
no signal in logcat beyond a `blockedEventStream` emission.

For the consent responsibility model and blocked-event behavior, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md#event-allow-lists-and-blocked-events).

### Contentful fetching and entry resolution

**Integration category:** Required for first integration

The Android SDK has no native managed fetch path. Fetching remains in your app regardless of how
navigation identifies an entry. If the app already has a Contentful entry ID, keep its existing
single-entry ID request. If a route carries a public slug, the app can query CDA by content type and
slug. In both cases, pass the fetched single-locale entry to the SDK; do not pass the ID or slug to
native resolution. The SDK resolves the entry locally against the current visitor's selected
optimizations, the SDK's current set of picked variants, one per experience the profile matched.

`OptimizedEntryView` is the Views renderer: it detects an optimized entry by the SDK-fixed
`fields.nt_experiences` link field, observes the client's `selectedOptimizations` (plural — the
current set), resolves the entry, and renders the result through a renderer you supply.
The SDK result type is `ResolvedOptimizedEntry`; when `isEmptyVariant` is `true`, the SDK renderer
uses its no-content state. That differs from fallback resolution, which renders the baseline entry
normally. In the no-content state, `OptimizedEntryView` removes any previously rendered child views
without calling your renderer, while retaining the latest resolved entry and selection metadata used
for tracking. A later non-empty result calls your renderer with the current entry. An absent or
invalid empty-variant field renders normally.
`nt_experiences` links each experience's `nt_variants` and audience entries; these are SDK-owned
Optimization content-model names, not names you choose, so your fetch must `include` deeply enough to
pull them back in one payload. Each resolved result carries a single `selectedOptimization`
(singular) — the one selection applied to that entry. Note the one-letter difference:
`selectedOptimizations` is the set the view observes, while `selectedOptimization` is the one applied
to a given entry. A selected variant can use any Contentful content type. The raw-map renderer must
convert the resolved map to the SDK-owned `CTEntry` wrapper with `CTEntry.from(...)` from
`com.contentful.optimization.contentful.CTEntry`, branch on `contentTypeId`, and check `hasField(...)`
before reading a field with `getField<T>(...)`. A different content type is a valid resolution, not a
fallback condition. The IDs, fields, and `ContentEntryBinder` methods below belong to your app's
content model.

1. Keep Contentful fetching in the application layer. Fetch by entry ID, or adapt the app's existing
   Contentful query with the slug filters below when navigation supplies a slug. Pass the one fetched entry to native
   resolution. Do not pass all-locale CDA responses or `locale=*` payloads to
   `OptimizedEntryView` — they fall back to baseline.

   > [!WARNING]
   >
   > Every entry passed as a raw `Map<String, Any>` must include a top-level `metadata` block (tags
   > and concepts). Kotlin does not validate or reject a missing `metadata` key — the raw map is
   > forwarded unmodified to the shared JS core, where the `isResolvedContentfulEntry` type guard
   > requires a top-level `metadata` key that is present and is an object (its contents are never
   > checked). When that check fails, `OptimizedEntryResolver.resolve` silently returns the baseline
   > with no thrown error, indistinguishable from an entry that has no experience configured. The
   > `setEntry(entry: CDAEntry)` overload below removes this failure class by always building
   > `metadata` for you through the SDK-owned adapter.

   For a slug route, reuse the Contentful client and fetcher your app already owns. Send
   `content_type=page` and `fields.slug=<route slug>` as exact-equality filters, plus one concrete
   `locale`, enough `include` depth, and `limit=2`. Return the entry only for exactly one CDA item;
   surface zero items through the app's not-found path and more than one item as an authoring or
   configuration error. Replace `page` and `slug` with your content type and slug-field IDs. The
   native SDK never reads these lookup values or performs this request.

   If your app does not already have a `contentful.java` client, build one from your space ID,
   delivery token, and environment, then fetch with the same single-locale, `include`-depth contract
   described above. `CDAClient.fetch(...).one(...)` is a blocking call, so run it off the main thread.

   **Adapt this to your use case:**

   ```kotlin
   import com.contentful.java.cda.CDAClient
   import com.contentful.java.cda.CDAEntry
   import kotlinx.coroutines.Dispatchers
   import kotlinx.coroutines.withContext

   val cdaClient: CDAClient = CDAClient.builder()
       .setSpace(spaceId)
       .setToken(deliveryToken)
       .setEnvironment(environment)
       .build()

   suspend fun fetchEntry(entryId: String, locale: String): CDAEntry = withContext(Dispatchers.IO) {
       cdaClient.fetch(CDAEntry::class.java)
           .withLocale(locale) // one concrete locale, never "*"
           .include(10)
           .one(entryId)
   }
   ```

2. Add `OptimizedEntryView` from XML or create it in activity, fragment, or adapter code.

   **Copy this:**

   ```xml
   <com.contentful.optimization.views.OptimizedEntryView
       android:id="@+id/hero_slot"
       android:layout_width="match_parent"
       android:layout_height="wrap_content" />
   ```

3. Set a renderer that turns the resolved entry map into a child `View`, then call `setEntry(...)`
   with the baseline entry returned by your app-owned fetch. The `setContentRenderer`
   lambda always receives a `Map<String, Any>` — even when the entry was set through the `CDAEntry`
   overload, the view converts the resolved `CTEntry` back to a map before invoking the renderer.
   Convert that map back to `CTEntry` when your renderer needs its content-type and field accessors.

   **Adapt this to your use case:**

   ```kotlin
   import com.contentful.java.cda.CDAEntry
   import com.contentful.optimization.contentful.CTEntry

   // Call this from your Activity after your app-owned Contentful fetch returns a CDAEntry.
   fun bindHeroSlot(heroEntry: CDAEntry) {
       val heroSlot = findViewById<OptimizedEntryView>(R.id.hero_slot)
       heroSlot.accessibilityIdentifier = "content-entry-home-hero"
       heroSlot.setContentRenderer { resolvedEntryMap ->
           val resolvedEntry = CTEntry.from(resolvedEntryMap)

           when {
               resolvedEntry.contentTypeId == "hero" && resolvedEntry.hasField("headline") ->
                   ContentEntryBinder.createHero(
                       context = heroSlot.context,
                       headline = resolvedEntry.getField<String>("headline"),
                   )
               resolvedEntry.contentTypeId == "cta" && resolvedEntry.hasField("label") ->
                   ContentEntryBinder.createCta(
                       context = heroSlot.context,
                       label = resolvedEntry.getField<String>("label"),
                   )
               resolvedEntry.contentTypeId == "page" && resolvedEntry.hasField("title") ->
                   ContentEntryBinder.createPage(
                       context = heroSlot.context,
                       title = resolvedEntry.getField<String>("title"),
                   )
               else -> ContentEntryBinder.createUnsupported(
                   context = heroSlot.context,
                   contentTypeId = resolvedEntry.contentTypeId,
               )
           }
       }
       heroSlot.setEntry(heroEntry)
   }
   ```

4. Treat baseline fallback as expected behavior. `resolveOptimizedEntry` (which `OptimizedEntryView`
   calls for you) is a `suspend`, fail-soft resolver. Its SDK-owned `ResolvedOptimizedEntry` result
   contains the resolved `CTEntry`, the applied `selectedOptimization`, an optional
   `optimizationContextId`, and `isEmptyVariant`. Only a boolean `true` marks an empty
   variant. When resolution cannot select a usable variant, it returns the baseline instead of
   breaking the UI. If you fetch with `contentful.java`, pass the `CDAEntry` to the typed
   `setEntry(entry: CDAEntry)` overload; the SDK-owned adapter builds the `{sys, fields, metadata}`
   shape the resolver requires.

For custom rendering surfaces that already hold the standard raw entry map described in step 1, call
`resolveOptimizedEntry(baseline, selectedOptimizations)` directly instead of through the view, then
check the full result before calling your existing renderer. `renderEntryView()` below is your
app-owned function that creates a child view from the resolved entry.

**Follow this pattern:**

```kotlin
import android.view.ViewGroup

suspend fun renderResolvedEntry(baselineEntry: Map<String, Any>, container: ViewGroup) {
    // Omitting selectedOptimizations uses current SDK state.
    val result = OptimizationManager.client.resolveOptimizedEntry(baseline = baselineEntry)
    container.removeAllViews()
    if (!result.isEmptyVariant) {
        container.addView(renderEntryView(result.entry.toMap()))
    }
}
```

If the app locale changes at runtime, call `client.setLocale(locale)` to update the SDK Experience
and event locale, then refetch Contentful entries in the new locale and re-render — `setLocale`
updates the SDK locale only and does not refetch entries; it throws before initialization or on an
invalid locale. For the entry contract and fallback rules, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md),
and for the locale boundary see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Screen and navigation tracking

**Integration category:** Required for first integration

The quick start tracked one screen from `onResume`. Real Android navigation repeats lifecycle
callbacks across activity, fragment, and in-activity transitions, so choose the call that matches the
event you want.

`ScreenTracker.trackScreen(name)` is the idiomatic Views API. It sets the current screen name,
observes the client's state, and calls `trackCurrentScreen` on each state emission — so it retries
once the SDK is ready and consent allows, and it swallows early-lifecycle failures. `trackCurrentScreen`
deduplicates the current route in the bridge by `routeKey` (which defaults to `name`), so a repeat of
the same current screen is skipped. Use plain `client.screen(name, properties)` only for intentional
one-off raw screen events, which carry no dedupe, or when a screen event needs properties. The suspend
emitters `screen` and `trackCurrentScreen` return an `EventEmissionResult` — an SDK result type with
an `accepted` flag (and optional `data`) that is `true` when the event passed the local consent and
allow-list gate.

1. Call `ScreenTracker.trackScreen(name)` from `Activity.onResume` (or `Fragment.onResume`) so it
   fires once per visible screen lifecycle.

   **Copy this:**

   ```kotlin
   override fun onResume() {
       super.onResume()
       // Track once per visible screen lifecycle, not from repeated child-view binding.
       ScreenTracker.trackScreen("Home")
   }
   ```

2. Emit a new screen event after an in-activity navigation state change when several logical screens
   share one activity.

   **Adapt this to your use case:**

   ```kotlin
   private fun transitionTo(destination: Destination) {
       // renderDestination is reader-owned: your own view-state swap.
       renderDestination(destination)
       // Emit the screen event after the app has committed its navigation state.
       when (destination) {
           Destination.HOME -> ScreenTracker.trackScreen("NavigationHome")
           Destination.DETAIL -> ScreenTracker.trackScreen("NavigationDetail")
       }
   }
   ```

3. Use a direct client call when a screen event needs properties.

   **Adapt this to your use case:**

   ```kotlin
   lifecycleScope.launch {
       // Wait for initialization before calling suspend client APIs directly.
       OptimizationManager.client.isInitialized.first { it }
       // postId is reader-owned: the value that identifies this destination.
       OptimizationManager.client.screen(name = "BlogPostDetail", properties = mapOf("postId" to postId))
   }
   ```

For shared tracking mechanics and event delivery, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

### Entry interaction tracking

**Integration category:** Common but policy-dependent

`OptimizedEntryView` wires entry view tracking and tap tracking for you: it installs a view-timing
controller for visibility-based view events and a click listener for taps, so you own only the
enablement policy, not the geometry or the payloads. Entry views deliver on the wire as `component`
events; entry taps as `component_click`. Both still respect the SDK consent gate. Your app decides
whether these events are allowed by its Analytics and privacy policy.

1. Leave the global `trackViews` and `trackTaps` defaults enabled when your policy permits them. Pass
   `trackViews = false` or `trackTaps = false` to `initialize` when a surface must opt out by default.

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
   `onTap` and `trackTaps` run through the same tap path, so their combination determines the
   resulting behavior:

   | `trackTaps` (per entry) | `onTap`            | Resulting behavior                                                                                                                                 |
   | ----------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `true` (default)        | `null`             | SDK emits `component_click`; no app-owned tap handler.                                                                                             |
   | `true` (default)        | non-null           | SDK emits `component_click`, then calls `onTap` — the entry stays tappable even when global `trackTaps` is on.                                     |
   | `false`                 | `null` or non-null | Neither `component_click` nor `onTap` fires — `trackTaps = false` disables both, since `onTap` runs through the same tap path as SDK tap tracking. |

   Setting per-entry `trackViews = false` opts that one entry out of view tracking independently.
   When a component needs an app-owned tap handler without SDK tap analytics, set `trackTaps = false`
   and attach a normal Android click listener inside the child view your renderer returns instead of
   using `onTap`.

   **Adapt this to your use case:**

   ```kotlin
   OptimizedEntryView(context).apply {
       // Disable SDK view tracking for entries tracked by a different application surface.
       trackViews = false
       setContentRenderer { resolvedEntry -> ContentEntryBinder.create(context, resolvedEntry) }
       setEntry(hero)
   }

   OptimizedEntryView(context).apply {
       // onTap is a per-entry override; navigateToEntry is reader-owned navigation.
       onTap = { baselineEntry -> navigateToEntry(baselineEntry) }
       setContentRenderer { resolvedEntry -> ContentEntryBinder.create(context, resolvedEntry) }
       setEntry(cta)
   }
   ```

3. Account for the fixed view timing in analytics expectations. A view session begins when the entry
   reaches 10% visibility and qualifies after a continuous 1000 ms dwell. A qualified view session
   produces two normal event records whose `type` field is `component`: the first when it qualifies
   and the second, final record when visibility falls below 10% or another ending occurs. Both records carry
   the same SDK-owned `viewId`. The `viewDurationMs` value is milliseconds measured from the moment
   the entry began that view session at 10% visibility, so it includes the qualifying dwell. A view
   session that ends before qualification emits no record, and active view sessions emit no periodic
   duration records.

4. When an entry is detached, its tracking controller is replaced, or the app moves to the
   background, the SDK ends and resets the current view session. On foreground, it checks the last
   measured entry and viewport positions. If the entry is still visible, it starts a fresh view
   session that must satisfy the continuous 1000 ms dwell again.

5. For a `RecyclerView` screen, use the SDK's `TrackingRecyclerView` (a `RecyclerView` subclass) so
   descendant `OptimizedEntryView` instances re-check visibility on each scroll frame. It is an
   optional, redundant signal — each `OptimizedEntryView` also re-checks from its own layout callbacks
   — so plain scroll containers work without it. Keep item views stable across rebinding so dwell
   timers are not reset mid-view.

   **Adapt this to your use case:**

   ```kotlin
   val recyclerView = TrackingRecyclerView(this).apply {
       layoutManager = LinearLayoutManager(this@HomeActivity)
       // ContentEntryAdapter is reader-owned; each item view holder wraps its entry in an
       // OptimizedEntryView and calls setContentRenderer + setEntry on a stable instance.
       adapter = ContentEntryAdapter(entries)
   }
   ```

For interaction timing, component event metadata, and duplicate prevention, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

### Identity, profile continuity, and reset

**Integration category:** Common but policy-dependent

Identity policy belongs to the application. The SDK can identify a visitor, update selected
optimizations and `changes` (the inline field and flag values the Experience API returned for the
visitor) from Experience API responses, persist profile-continuity state when allowed, and reset
SDK-managed profile state — but it does not decide when a user becomes known or how account data is
governed.

1. Call `identify(userId, traits)` after sign-in or when the app has a stable application user ID.
   Gate traits before sending sensitive or restricted data.

   **Adapt this to your use case:**

   ```kotlin
   lifecycleScope.launch {
       // Identify after the app has made its own login or account-selection decision.
       OptimizationManager.client.isInitialized.first { it }
       OptimizationManager.client.identify(userId = "user-123", traits = mapOf("plan" to "pro"))
   }
   ```

2. Call `reset()` on logout, account switch, or a privacy flow that must clear SDK-managed profile
   state, then emit a fresh profile-producing event before expecting new selections.

   **Adapt this to your use case:**

   ```kotlin
   lifecycleScope.launch {
       OptimizationManager.client.isInitialized.first { it }
       OptimizationManager.client.reset()
       // Emit fresh profile-producing context after reset before expecting new variants.
       ScreenTracker.trackScreen("Home")
   }
   ```

`reset()` clears profile continuity (profile, changes, selected optimizations, the anonymous ID, the
current-screen dedupe tracker, and sticky-view keys) but **preserves consent state**, and it no-ops
before initialization. When persistence consent is allowed, the SDK writes continuity to
`SharedPreferences` under the `com.contentful.optimization.` key prefix and publishes state from an
Experience response after that write settles; in tests and relaunch flows, wait for SDK-derived state
instead of adding storage delays. The SDK provides no built-in cross-platform identity handoff — store
account IDs, consent records, and cross-device identity state in application code. For the identifier
model, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md#revocation-and-profile-cleanup).

## Optional integrations

### Custom events and analytics diagnostics

**Integration category:** Optional

Use custom events for business actions that are not tied to a Contentful entry swap, and the event
streams for local diagnostics or app-owned analytics forwarding.

1. Call `track(event, properties)` for a business event. It is a suspend emitter that returns an
   `EventEmissionResult`.

   **Copy this:**

   ```kotlin
   lifecycleScope.launch {
       OptimizationManager.client.isInitialized.first { it }
       // A custom business event, not tied to a Contentful entry swap.
       OptimizationManager.client.track(event = "Purchase Completed", properties = mapOf("sku" to "ABC-123"))
   }
   ```

2. Collect `eventStream` for accepted events and `blockedEventStream` for events stopped by consent or
   the allow-list. Both are `SharedFlow`s with a replay buffer of 64, so a late subscriber still
   receives up to the last 64 events — unlike the iOS passthrough streams, you do not have to subscribe
   before the events fire. Deduplicate forwarded events by event semantics, not UI lifecycle, because
   Android views can be recreated on configuration or navigation changes.

   **Adapt this to your use case:**

   ```kotlin
   lifecycleScope.launch {
       repeatOnLifecycle(Lifecycle.State.STARTED) {
           // analyticsDebugger is reader-owned: your debug display or forwarding sink.
           OptimizationManager.client.eventStream.collect { event -> analyticsDebugger.render(event) }
       }
   }

   lifecycleScope.launch {
       repeatOnLifecycle(Lifecycle.State.STARTED) {
           // blockedEventStream (or the onEventBlocked config callback) is the diagnostic for a
           // missing event during integration.
           OptimizationManager.client.blockedEventStream.collect { blocked ->
               Log.w("Optimization", "blocked ${blocked.method}: ${blocked.reason}")
           }
       }
   }
   ```

When forwarding SDK events to third-party destinations, apply the same app-owned consent policy,
deduplication, and data-minimization rules that govern the destination. For destination mapping,
consent, identity, dedupe, and governance guidance, see
[Forwarding Optimization SDK context to analytics and tag management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

### Custom Flags and MergeTag rendering

**Integration category:** Optional

Use Custom Flags when your Optimization data includes profile-backed feature values, and merge tags
when it includes profile-driven text substitutions in Rich Text. Both read from SDK state separately
from entry-variant resolution, and they wait for initialization before returning real values.

1. Read a flag once with `getFlag(name)` when a synchronous value is enough (returns `null` before
   init or when unresolved).

   > [!WARNING]
   >
   > Each `getFlag` call emits a `component` flag-view event when consent and profile allow, so every
   > flag read is a tracked analytics exposure — not only observed subscriptions. Apply the same
   > governance you use for other SDK events.

   **Adapt this to your use case:**

   ```kotlin
   lifecycleScope.launch {
       OptimizationManager.client.isInitialized.first { it }
       // headlineBadge is reader-owned UI; getFlag returns a JSONValue? read from SDK state.
       val headlineFlag = OptimizationManager.client.getFlag("homepage-headline")
       headlineBadge.text = headlineFlag?.stringValue ?: "default"
   }
   ```

2. Observe with `observeFlag(name)` when a view must update as flag values change. It returns a
   `StateFlow<JSONValue?>` (the Android reactive idiom, where iOS uses a Combine publisher).

   > [!WARNING]
   >
   > Subscribing to a flag observable emits a `component` flag-view event when consent and profile
   > allow, so treat a flag subscription as a tracked analytics exposure, not a free read, and govern
   > it like any other event.

   **Adapt this to your use case:**

   ```kotlin
   lifecycleScope.launch {
       OptimizationManager.client.isInitialized.first { it }
       val ctaFlag = OptimizationManager.client.observeFlag("homepage-cta")
       repeatOnLifecycle(Lifecycle.State.STARTED) {
           ctaFlag.collect { flagValue -> ctaButton.text = flagValue?.stringValue ?: "Continue" }
       }
   }
   ```

3. Resolve merge tags with `getMergeTagValue(mergeTagEntry)` while rendering Rich Text. `nt_mergetag`
   is the SDK-fixed Optimization content type for a merge tag — a profile-driven text substitution
   embedded inline in Rich Text; it is not a name you choose. Your app owns extracting the embedded
   `nt_mergetag` entry from the Rich Text node before calling the SDK, which resolves the selector
   against the current profile and returns the resolved string or `null`.

   **Follow this pattern:**

   ```kotlin
   suspend fun resolveMergeTagText(mergeTagEntry: Map<String, Any>): String {
       OptimizationManager.client.isInitialized.first { it }
       // Keep fallback copy in the app so an unresolved merge tag does not break Rich Text rendering.
       return OptimizationManager.client.getMergeTagValue(mergeTagEntry)
           ?: readFallbackValue(mergeTagEntry)
           ?: "[Merge Tag]"
   }
   ```

For the merge-tag data model, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#merge-tags-and-localized-profile-values).

### Live updates and locked variants

**Integration category:** Optional

Views apps choose whether optimized content updates live or locks to the first selected variant for
the screen. The global default is locked: with `liveUpdates = false` (the default),
`OptimizedEntryView` snapshots the first non-null selection it sees and resolves against that locked
value thereafter, so content does not change while the visitor is looking at it.

1. Keep the default for reading surfaces where content must not shift mid-view.
2. Enable live updates globally when most rendered entries must react to profile or preview changes
   without remounting.

   **Adapt this to your use case:**

   ```kotlin
   OptimizationManager.initialize(
       context = this,
       config = optimizationConfig,
       // Live updates let mounted OptimizedEntryView instances re-resolve as selections change.
       liveUpdates = true,
   )
   ```

3. Override live updates per entry when only one component needs live behavior.

   **Adapt this to your use case:**

   ```kotlin
   OptimizedEntryView(context).apply {
       liveUpdates = true
       // ContentEntryBinder and dashboardEntry are reader-owned, as elsewhere in this guide.
       setContentRenderer { resolvedEntry -> ContentEntryBinder.create(context, resolvedEntry) }
       setEntry(dashboardEntry)
   }
   ```

To drive your own optimization state, pass an explicit selections snapshot to
`setEntry(entry, selectedOptimizations)`: a non-null list resolves against exactly that snapshot,
while the default `null` observes the SDK's current selection state. An open preview panel forces live
updates in every `OptimizedEntryView` (overriding an explicit `liveUpdates = false`) so applied
overrides appear immediately; when the panel closes, non-live entries without a caller-supplied
selections override lock to the previewed selection. For the precedence rules, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#live-updates-and-preview-behavior).

### Preview panel

**Integration category:** Optional

The preview panel is a debug and authoring surface that lets an internal user force audience
qualification and variant selection on the local device. An audience is the rule an experience uses to
target a set of visitors. Gate the panel behind a debug or internal-build condition so production users
cannot open local overrides.

1. Pass a `PreviewPanelConfig` to `initialize` under a debug gate. Supply a `PreviewContentfulClient`
   (the built-in `ContentfulHTTPPreviewClient` fetches `nt_audience` and `nt_experience` definitions)
   so the panel shows audience and experience names; without it the panel still opens but falls back
   to raw identifiers.

   **Adapt this to your use case:**

   ```kotlin
   OptimizationManager.initialize(
       context = this,
       config = optimizationConfig,
       // Keep preview definitions behind a debug or internal-build gate.
       previewPanel = if (BuildConfig.DEBUG) {
           PreviewPanelConfig(
               contentfulClient = ContentfulHTTPPreviewClient(
                   spaceId = "your-space-id",
                   accessToken = "your-cda-token",
                   environment = "main",
               ),
           )
       } else {
           null
       },
   )
   ```

2. Attach the floating entry point after `setContentView(...)` in each activity that should show it.
   `attachPreviewPanel` uses the same initialized client the rest of the app uses, so overrides affect
   the same resolver and event state.

   **Adapt this to your use case:**

   ```kotlin
   override fun onCreate(savedInstanceState: Bundle?) {
       super.onCreate(savedInstanceState)
       setContentView(R.layout.home)
       if (BuildConfig.DEBUG) {
           // Attach after setContentView so the floating entry point mounts into this activity.
           OptimizationManager.attachPreviewPanel(this)
       }
   }
   ```

Do not expose preview controls in production traffic unless your organization has an explicit
internal-access policy.

## Advanced integrations

### Offline delivery, queue observability, and app-owned caching

**Integration category:** Advanced or production-only

The Android SDK monitors network reachability, queues events while offline, flushes when connectivity
returns, and flushes as the app moves to the background. No setup is required for the default offline
path.

1. Add a `QueuePolicy` only when production telemetry needs queue bounds or delivery callbacks. The
   offline Experience queue holds up to 100 events by default (tunable via
   `QueuePolicy.offlineMaxEvents`); queues are in-memory only, with no durable outbox, and do not
   survive process death.

   **Adapt this to your use case:**

   ```kotlin
   val optimizationConfig = OptimizationConfig(
       clientId = "your-optimization-client-id",
       queuePolicy = QueuePolicy(
           // Cap offline storage to the app's production delivery budget.
           offlineMaxEvents = 100,
           onOfflineDrop = { event -> Log.w("Optimization", "Dropped offline event: ${event.context}") },
       ),
   )
   ```

2. Use queue callbacks for operational diagnostics, not for resending blocked or dropped events.
3. Keep Contentful entry caching in the application layer — the SDK does not cache CDA responses for
   Views rendering; you own content caching with locale-aware keys.
4. Call `flush()` only for deliberate release, test, or lifecycle flows; the SDK already flushes on
   background and reconnect.

For the runtime delivery model, see
[Android SDK runtime and interaction mechanics](../concepts/android-sdk-runtime-and-interaction-mechanics.md#offline-and-app-lifecycle-delivery).

## Production checks

Before releasing an Android Views integration, verify these checks:

- **Credentials and runtime configuration** — The app uses the intended Maven coordinate, client ID,
  Contentful environment, SDK `locale`, and CDA locale. Non-default Experience or Insights API base
  URLs and `OptimizationLogLevel.debug` logging are absent from production builds unless explicitly
  approved.
- **Consent behavior** — Startup consent is seeded only when policy permits it, consent UI calls
  `consent(...)` for every choice, withdrawal blocks later gated events, split event and persistence
  consent behaves as intended, and `reset()` behavior matches legal and privacy requirements.
- **Event delivery** — Screen, custom, tap, view, identify, and flag-view events appear when allowed
  and are blocked or omitted when policy denies them; offline delivery flushes after reconnect.
- **Content fallback behavior** — Baseline entries render when selected optimizations are missing,
  Contentful links are unresolved, variants are out of range, all-locale payloads are fetched, or the
  visitor does not qualify.
- **Duplicate tracking prevention** — Activity and fragment lifecycle hooks, RecyclerView adapters,
  and state collectors do not recreate `OptimizedEntryView` instances or re-emit screen, tap, or view
  events for one intended interaction or visibility cycle.
- **Privacy and governance** — Identity traits, custom event properties, forwarded analytics events,
  preview-panel access, and persisted profile continuity follow the app's data-minimization and
  retention policy.
- **Local validation path** — Compare your integration against the Android reference implementation.
  The repository's maintainers validate Views behavior with Maestro flows driven from
  `implementations/android-sdk/`; those runners are maintainer commands, not app commands.
- **Confirm in Live Events** — In addition to local log and status checks, open the target Contentful
  space and environment's Live Events view in the Contentful web app — check your left-hand sidebar to
  tell which navigation applies (a top-level **Apps** entry means classic navigation; a top-level
  **Platform** entry above **Apps** means new navigation): in **classic navigation**, go to
  **Apps → Installed apps → Contentful Personalization → Live Events**; in **new navigation**, go to
  **Platform/Apps → Installed apps → Contentful Personalization → Live Events**. Trigger a real flow
  from the app (a screen view, an entry view or tap, an `identify()` call, or a custom `track()` call),
  and confirm the corresponding event arrives with the expected wire type (`identify`, `screen`,
  `component`, `component_click`, or `track`) and payload fields (for example `userId`/`traits` for
  `identify`, `name`/`routeKey` for `screen`, `event`/`properties` for `track`).

  **Reference excerpt:**

  ```sh
  # From the optimization monorepo root — a maintainer command that runs the Views Maestro suite.
  pnpm implementation:run -- android-sdk test:e2e:views -- --flow screen-tracking
  ```

## Troubleshooting

- **`ClassNotFoundException: okhttp3.OkHttpClient` at launch** — `contentful.java` 5.x pulls in
  okhttp 5.x's KMP metadata parent (`com.squareup.okhttp3:okhttp`), a placeholder artifact with no
  `okhttp-jvm` variant on Android. Exclude `com.squareup.okhttp3:okhttp-jvm` from any dependency that
  pulls that parent (`com.contentful.java:java-sdk` and similar) and align all okhttp declarations on
  5.x so the excluded `okhttp-jvm` variant and the SDK's direct `okhttp-android:5.x` implementation do
  not coexist.
- **SDK never initializes or events never emit** — Confirm the `Application` subclass is registered
  with `android:name` in `AndroidManifest.xml` (without it `onCreate` never runs), and that direct
  suspend calls await `client.isInitialized.first { it }` before running.
- **Optimized entries always render the baseline** — Confirm the app fetched a single-locale entry
  with enough `include` depth for `nt_experiences` and `nt_variants`, that consent or the allow-list
  is not blocking profile-producing events, and that `client.selectedOptimizations` is non-empty for
  the visitor.
- **Tap or view events do not appear** — Check consent, `allowedEventTypes`, per-entry `trackViews`
  and `trackTaps`, whether the view reached the configured visibility threshold long enough to emit,
  and whether views are recreated mid-dwell.
- **Screen events appear more than once** — Review `onResume` calls across activity, fragment, and
  in-activity transitions, and prefer `ScreenTracker.trackScreen` (which dedupes the current route by
  `routeKey`) over raw `screen` for lifecycle tracking.
- **Preview panel opens but shows identifiers** — Pass a `PreviewContentfulClient` that can fetch
  `nt_audience` and `nt_experience` entries from the correct space and environment.

## Reference implementations to compare against

- [Android reference implementation](../../implementations/android-sdk/README.md) — Maintained Compose
  and Android Views shells that exercise the native Android bridge against the shared mock API:
  accepted-consent startup, single-locale CDA fetching, entry resolution, screen and navigation
  tracking, interaction tracking, Custom Flags and merge tags, live updates, offline queueing, and
  preview-panel overrides. Use it as the comparison and validation target for Views integration
  behavior.
