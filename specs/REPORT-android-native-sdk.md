# Android Native SDK Report: Thin Wrapper over JavaScript Core

## Executive Summary

This report evaluates the feasibility of creating a native Android SDK (Kotlin) for the Contentful
Optimization suite that acts as a thin wrapper around the existing JavaScript SDK
(`@contentful/optimization-core`). Unlike iOS where JavaScriptCore is built-in, Android requires
bundling a JavaScript runtime, making the runtime choice a critical architectural decision.

**Verdict:** This approach is feasible but has higher complexity than iOS due to the need to bundle
a JS runtime. **QuickJS** is the recommended runtime for its minimal size (~350 KB), full ES2023
support, and excellent Android bindings via `quickjs-kt`. The main risks are around runtime binary
size, polyfill correctness, and the added complexity of embedding a C-based engine via JNI/NDK.

**Important industry context:** No major analytics/personalization SDK currently embeds a JS engine
in native mobile SDKs. Segment, LaunchDarkly, Amplitude, and Mixpanel all use native-per-platform
implementations or share code only within the same language family. Skyscanner explored this
approach and found significant trade-offs in binary size and "glue code" complexity. Kotlin
Multiplatform (KMP) is the industry trend for sharing logic between iOS and Android — it's
production-proven by Shopify, Netflix, Forbes, and McDonald's, but doesn't solve parity with a JS
SDK. This is a less-traveled path chosen specifically because our canonical business logic lives in
TypeScript.

---

## 1. General Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Kotlin Public API                   │
│  OptimizationAndroid                                 │
│  ├── identify(payload): OptimizationData?   (suspend)│
│  ├── page(payload): OptimizationData?       (suspend)│
│  ├── screen(payload): OptimizationData?     (suspend)│
│  ├── track(payload): OptimizationData?      (suspend)│
│  ├── trackComponentView(payload)            (suspend)│
│  ├── trackComponentClick(payload)           (suspend)│
│  ├── personalizeEntry(entry, personalizations)       │
│  ├── getCustomFlag(name, changes): Json?             │
│  ├── consent(accept: Boolean)                        │
│  ├── reset()                                         │
│  ├── flush()                                (suspend)│
│  ├── destroy()                                       │
│  └── states: StateFlows                              │
├─────────────────────────────────────────────────────┤
│                   Bridge Layer                       │
│  ├── JSBridge (JSON serialization / deserialization)  │
│  ├── JSPolyfills (fetch, setTimeout, console, etc.)  │
│  ├── NativeCallbacks (observable → StateFlow/Flow)   │
│  └── LifecycleManager (Activity/Process lifecycle)   │
├─────────────────────────────────────────────────────┤
│          JavaScript Runtime (QuickJS)                │
│  ├── Native library: libquickjs.so (per ABI)         │
│  ├── Kotlin bindings: quickjs-kt                     │
│  ├── Bundled JS: optimization-core.bundle.js         │
│  ├── Polyfill layer                                  │
│  └── CoreStateful instance running in JS context     │
├─────────────────────────────────────────────────────┤
│            Native Platform Services                  │
│  ├── SharedPreferences / EncryptedSharedPreferences  │
│  ├── OkHttp / HttpURLConnection (via fetch polyfill) │
│  ├── ProcessLifecycleOwner (app lifecycle)            │
│  ├── ConnectivityManager (network state)             │
│  └── Android Logging (android.util.Log)              │
└─────────────────────────────────────────────────────┘
```

### How It Works

1. **Initialization**: The Kotlin SDK loads the QuickJS native library, creates a JS runtime and
   context, loads the bundled JS code, and instantiates `CoreStateful` within the JS context.
2. **Method Calls**: Kotlin method calls are bridged to JS via JSON serialization. The bridge
   invokes JS functions and deserializes responses back to Kotlin data classes.
3. **State Observation**: JS signals/observables are bridged to Kotlin's `StateFlow`/`Flow`. The JS
   side invokes native callbacks on state changes, which emit through Kotlin Flow.
4. **Networking**: The JS `fetch` API is polyfilled — when JS code calls `fetch()`, the polyfill
   delegates to native OkHttp or HttpURLConnection.
5. **Persistence**: Storage operations bridge to `SharedPreferences` or
   `EncryptedSharedPreferences`, replacing AsyncStorage/localStorage.

---

## 2. JavaScript Runtime Options

### Option A: QuickJS — Recommended

**What it is:** A small, embeddable JavaScript engine by Fabrice Bellard (creator of FFmpeg, QEMU).
Supports ES2023 including modules, async generators, proxies, BigInt. QuickJS-NG is an actively
maintained fork with performance improvements.

**Android Bindings:**

- **[`quickjs-kt`](https://github.com/dokar3/quickjs-kt)** (by dokar3) — Idiomatic Kotlin bindings
  inspired by Cash App's Zipline. Supports async/await, DSL syntax, and ES modules. Well-maintained,
  actively developed. This is the recommended choice.
- **[`quickjs-android`](https://github.com/OpenQuickJS/quickjs-android)** (by OpenQuickJS) —
  Lower-level bindings, also actively maintained.
- **[`quickjs-android`](https://github.com/taoweiji/quickjs-android)** (by taoweiji) — Earlier
  bindings, less active.

**Note on QuickJS-NG:** [QuickJS-NG](https://quickjs-ng.github.io/quickjs/) is an actively
maintained fork of the original QuickJS with performance improvements and ongoing development.
`quickjs-kt` can be configured to use QuickJS-NG.

**Pros:**

- Smallest binary: ~350 KB per ABI (armeabi-v7a). Total for all ABIs: ~1.2-1.5 MB.
- Full ES2023 support including modules — our JS bundle will work without transpilation
- Fast startup time (no JIT warmup)
- Low memory footprint
- No corporate dependency risk — open source, small enough to fork if needed
- `quickjs-kt` provides excellent Kotlin-idiomatic API with coroutine support
- Actively maintained via QuickJS-NG fork

**Cons:**

- Interpreter-only (no JIT) — slower than V8 for compute-heavy work (5-20% slower in benchmarks)
- For our workload (JSON processing, HTTP, simple logic), this performance gap is negligible
- Less debugger tooling than V8-based solutions

### Option B: Hermes

**What it is:** Meta's JavaScript engine optimized for React Native. Features ahead-of-time bytecode
compilation.

**Pros:**

- Bytecode precompilation → very fast startup
- Optimized for mobile (low memory, small binary)
- Runs on both iOS and Android — could be the shared runtime
- ~3-4.5 MB binary size
- Actively maintained by Meta

**Cons:**

- **3-4x larger** than QuickJS
- Primarily designed for React Native — standalone embedding is less documented
- ES module support is partial (improving but not as complete as QuickJS)
- Heavier integration burden outside of React Native
- Corporate dependency on Meta's priorities

### Option C: V8 (via J2V8 or similar)

**What it is:** Google's high-performance JS engine with JIT compilation.

**Pros:**

- Best raw performance (JIT compilation)
- Full ES2023+ support
- Chrome DevTools protocol for debugging

**Cons:**

- **Very large**: 10-20 MB per ABI. Total: 40-80 MB for all ABIs. **Disqualifying for an SDK.**
- J2V8 is **effectively abandoned** — the GitHub repo has open issues about maintenance since 2020+
- Complex build process (V8 is notoriously difficult to build)
- Massive overkill for our simple workload

### Option D: AndroidX JavaScriptEngine

**What it is:** Google's Jetpack library (`androidx.javascriptengine`) providing a sandboxed JS
evaluation API. Reached stable 1.0.0.

**Pros:**

- Official Google library
- Zero bundled runtime — uses the system's WebView JS engine
- Process isolation (runs in separate process)

**Cons:**

- **Requires Android 13+ (API 33)** — excludes ~40% of devices
- Must call `JavaScriptSandbox.isSupported()` — not guaranteed to be available
- Limited API — designed for simple script evaluation, not hosting a full SDK runtime
- No support for registering native callbacks (makes state observation very difficult)
- Process isolation adds latency to every bridge call
- **Not suitable for an SDK that must run on a wide range of devices**

### Recommendation

**Use QuickJS (via `quickjs-kt` bindings).** It offers the best balance of:

- Minimal binary size (~350 KB/ABI)
- Full ES2023 support (our JS bundle works as-is)
- Excellent Kotlin bindings with coroutine integration
- Active maintenance
- Low risk (small, auditable codebase)

---

## 3. What Is Possible vs. What Is Not

### Fully Possible (Run in JS)

| Capability                     | Notes                                                                      |
| ------------------------------ | -------------------------------------------------------------------------- |
| **Personalization resolution** | `personalizeEntry()`, `getCustomFlag()`, `getMergeTagValue()` — pure logic |
| **Event building**             | EventBuilder constructs event payloads — pure logic                        |
| **State management**           | Preact signals work in QuickJS                                             |
| **Zod validation**             | Schema validation runs in pure JS                                          |
| **API client logic**           | Request construction, batching, queue policy, retry logic                  |
| **Interceptors**               | Pure JS callbacks                                                          |
| **Consent management**         | Signal-based, no platform dependencies                                     |

### Requires Polyfill/Bridge (Logic in JS, Plumbing in Native)

| Capability                          | Bridge Strategy                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP networking (fetch)**         | Polyfill `fetch` → delegate to OkHttp                                                                                            |
| **Timers (setTimeout/setInterval)** | Polyfill → use `Handler` / coroutine `delay`                                                                                     |
| **Console logging**                 | Polyfill `console` → route to `android.util.Log`                                                                                 |
| **Persistence**                     | Bridge to SharedPreferences / EncryptedSharedPreferences                                                                         |
| **Crypto (randomUUID)**             | Polyfill → `java.util.UUID.randomUUID()`                                                                                         |
| **TextEncoder/TextDecoder**         | JS polyfill ([FastestSmallestTextEncoderDecoder](https://github.com/anonyco/FastestSmallestTextEncoderDecoder)) or native bridge |
| **URL/URLSearchParams**             | Polyfill (core-js or custom)                                                                                                     |
| **AbortController**                 | JS polyfill (if used by fetch layer)                                                                                             |

**Note on Zod:** [Zod v4 Mini](https://zod.dev/packages/mini) is ~57% smaller and tree-shakable. If
the core SDK can adopt Zod Mini, it would significantly reduce the JS bundle size for embedded use.

### Must Be Native (Cannot Run in JS)

| Capability               | Reason                                                                         |
| ------------------------ | ------------------------------------------------------------------------------ |
| **App lifecycle events** | `ProcessLifecycleOwner` / `ActivityLifecycleCallbacks` for flush-on-background |
| **Network reachability** | `ConnectivityManager` for online/offline detection                             |
| **Secure storage**       | `EncryptedSharedPreferences` / Android Keystore                                |
| **UI components**        | Preview panel or debug UI must be native Compose/Views                         |
| **View tracking**        | Requires access to Android View hierarchy, scroll listeners                    |
| **Tap/gesture tracking** | Touch event interception on Android Views                                      |
| **Screen tracking**      | Activity/Fragment lifecycle or Navigation component                            |
| **Deep linking**         | Intent filters, App Links                                                      |

---

## 4. Boundary Definition: JS vs. Native

```
┌──────────────────────────────────────┐
│         NATIVE (Kotlin) LAYER        │
│                                      │
│  Platform Services:                  │
│  • ProcessLifecycleOwner             │
│  • ConnectivityManager               │
│  • SharedPreferences                 │
│  • OkHttp (via fetch polyfill)       │
│  • android.util.Log (via console)    │
│  • View hierarchy access             │
│  • Jetpack Compose / Views UI        │
│                                      │
│  SDK API Surface:                    │
│  • Public Kotlin data classes        │
│  • StateFlow for state observation   │
│  • suspend functions                 │
│  • Kotlin-idiomatic error handling   │
│                                      │
│  View Tracking (native):             │
│  • ViewTreeObserver for visibility   │
│  • OnScrollChangeListener            │
│  • Touch interception                │
│  • Dwell time accumulation           │
│  → Calls JS core for event emission  │
│                                      │
├──────────────────────────────────────┤
│        JAVASCRIPT (QuickJS) LAYER    │
│                                      │
│  ALL Business Logic:                 │
│  • CoreStateful instance             │
│  • PersonalizedEntryResolver         │
│  • FlagsResolver                     │
│  • MergeTagValueResolver             │
│  • AnalyticsStateful (batching)      │
│  • PersonalizationStateful           │
│  • EventBuilder                      │
│  • API Client (request construction) │
│  • Interceptor chain                 │
│  • Queue policy & retry logic        │
│  • Zod schema validation             │
│  • Signal-based state management     │
│                                      │
└──────────────────────────────────────┘
```

---

## 5. How the Bridge Works

### 5.1 Kotlin → JS Calls (via quickjs-kt)

`quickjs-kt` provides a clean Kotlin DSL for JS interop:

```kotlin
// Conceptual example using quickjs-kt patterns
val runtime = QuickJs.create()

// Load the bundled JS
runtime.evaluate(bundledJsCode)

// Call a JS function
val result = runtime.evaluate("""
    optimization.identify(${payload.toJson()})
""")
```

For async operations, `quickjs-kt` supports bridging JS Promises to Kotlin coroutines:

```kotlin
// Conceptual: Bridge JS Promise to Kotlin suspend function
suspend fun identify(payload: IdentifyPayload): OptimizationData? {
    return withContext(jsDispatcher) {
        val jsonResult = jsRuntime.callAsync("optimization.identify", payload.toJson())
        jsonResult?.let { OptimizationData.fromJson(it) }
    }
}
```

### 5.2 JS → Kotlin Callbacks (State Observation)

```
JS signal change
  → Signal effect callback fires
  → Callback invokes registered native function
  → Native function deserializes value
  → Emits through MutableStateFlow
  → Kotlin collectors receive the update
```

**Implementation:** During initialization, the Kotlin bridge registers callback functions in the JS
context. `quickjs-kt` supports registering Kotlin lambdas as JS functions. When JS state changes,
the signal effect invokes these callbacks.

```kotlin
// Conceptual: Register state observer
jsRuntime.registerFunction("__onProfileChange") { args ->
    val json = args[0] as String
    val profile = Profile.fromJson(json)
    _profileFlow.value = profile
}

// JS side (in polyfill/bridge setup):
// optimization.states.profile.subscribe((p) => __onProfileChange(JSON.stringify(p)))
```

### 5.3 Fetch Polyfill Bridge

```
JS fetch() call
  → Polyfill intercepts
  → Calls native Kotlin function: __nativeFetch(url, method, headers, body)
  → Kotlin creates OkHttp Request, executes
  → Response returns: (status, headers, body) → JS
  → Polyfill constructs Response object, resolves Promise
```

**Critical considerations:**

- OkHttp is the de facto standard for Android HTTP — supports connection pooling, HTTP/2,
  certificate pinning
- If the host app already uses OkHttp, the SDK should allow injecting a shared client
- The Beacon API pattern (fire-and-forget for analytics flush) maps to OkHttp's `enqueue()` with
  no-op callback

### 5.4 Timer Polyfill Bridge

```
JS setTimeout(fn, ms)
  → Polyfill calls native __registerTimer(id, ms)
  → Kotlin posts delayed Runnable to Handler / uses coroutine delay
  → On fire: invokes JS callback by timer ID
  → Returns timer ID for clearTimeout
```

---

## 6. Risks

### 6.1 High Risks

| Risk                             | Impact                                                                                                                 | Mitigation                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Native library compatibility** | QuickJS's `.so` files must support all Android ABIs (armeabi-v7a, arm64-v8a, x86, x86_64). Missing ABIs cause crashes. | `quickjs-kt` already provides multi-ABI builds. Test on all architectures via CI (emulator matrix).          |
| **Polyfill correctness**         | Incomplete fetch polyfill could cause silent data loss (events not sent)                                               | Comprehensive integration tests. Verify event delivery end-to-end. Test timeout, retry, and error scenarios. |
| **JNI/NDK complexity**           | Bridge between Kotlin ↔ C (QuickJS) ↔ JS adds layers where bugs can hide                                               | Use well-maintained bindings (`quickjs-kt`). Avoid custom JNI code. Write extensive bridge tests.            |
| **ProGuard/R8 interference**     | Code shrinking could strip native method references or break reflection                                                | Add ProGuard rules for the SDK. Test with R8 in release builds.                                              |

### 6.2 Medium Risks

| Risk                     | Impact                                                                      | Mitigation                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Bundle size**          | QuickJS adds ~350 KB/ABI + JS bundle. Total: ~2-3 MB across all ABIs.       | Acceptable for most apps. Document size impact. Consider ABI splits.                                                                |
| **Memory pressure**      | JS runtime + context consumes memory. Could be an issue on low-end devices. | Lazy initialization. Benchmark on low-end devices. Implement memory pressure handling.                                              |
| **Thread safety**        | QuickJS context is not thread-safe. All access must be serialized.          | Dedicated coroutine dispatcher (`Dispatchers.Default.limitedParallelism(1)`). Route all bridge calls through it.                    |
| **Version drift**        | JS bundle could diverge from Kotlin wrapper                                 | Bundle JS inside the AAR. Version together. CI validates compatibility.                                                             |
| **Debugging difficulty** | No Chrome DevTools for QuickJS. JS errors may be opaque.                    | Implement robust error bridging. Log JS stack traces via android.util.Log. Consider adding a debug mode that logs all bridge calls. |
| **App size sensitivity** | Some regions/markets are very sensitive to APK size                         | Offer ABI-split builds. Document that QuickJS adds ~350 KB per architecture.                                                        |

### 6.3 Low Risks

| Risk                             | Impact                                              | Mitigation                                                                                                                |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Play Store rejection**         | Google restricting JS execution in apps             | Extremely unlikely. React Native, Flutter (Dart), and game engines all execute non-Java code. No precedent for rejection. |
| **QuickJS maintenance**          | QuickJS-NG fork becomes unmaintained                | QuickJS codebase is small enough (~60K LOC) to fork and maintain. `quickjs-kt` is also independently maintained.          |
| **Kotlin version compatibility** | `quickjs-kt` dependency on specific Kotlin versions | Track Kotlin version requirements. Pin and test.                                                                          |

---

## 7. Bundle Size Estimate

| Component                               | Size per ABI | All ABIs (4)         |
| --------------------------------------- | ------------ | -------------------- |
| QuickJS native library (.so)            | ~350 KB      | ~1.4 MB              |
| JS bundle (optimization-core, minified) | ~200-300 KB  | ~200-300 KB (shared) |
| Kotlin bridge layer                     | ~30-50 KB    | ~30-50 KB            |
| quickjs-kt bindings                     | ~50-80 KB    | ~50-80 KB            |
| **Total SDK**                           | —            | **~1.7-1.8 MB**      |

**With ABI splits** (recommended for Play Store distribution):

- Each APK/AAB only includes the relevant ABI: **~600-750 KB per variant**

**For comparison:**

- Firebase Analytics SDK: ~2-3 MB
- OkHttp: ~800 KB
- Segment Analytics: ~1-2 MB

Our SDK size is competitive with similar analytics/personalization SDKs.

---

## 8. Play Store Considerations

- **No restrictions on embedded JS runtimes.** Google Play does not prohibit executing JavaScript or
  embedding custom runtimes.
- **React Native precedent:** Thousands of RN apps (which embed Hermes or JSC) are on the Play
  Store.
- **Game engine precedent:** Unity, Unreal, and other engines execute non-Java code.
- **Flutter precedent:** Flutter executes Dart via a custom VM.
- **Our JS is bundled, not downloaded.** The JS code is part of the APK/AAB, not fetched from a
  server. This avoids any concerns about dynamic code loading.

---

## 9. Threading Model

- **QuickJS context is NOT thread-safe.** All interactions must occur on a single thread.
- **Recommended pattern:** Use a dedicated Kotlin coroutine dispatcher with parallelism limited
  to 1.

```kotlin
// Conceptual threading pattern
class OptimizationAndroid {
    private val jsDispatcher = Dispatchers.Default.limitedParallelism(1)
    private val quickJs: QuickJs

    suspend fun identify(payload: IdentifyPayload): OptimizationData? {
        return withContext(jsDispatcher) {
            val result = quickJs.evaluate("optimization.identify(${payload.toJson()})")
            result?.let { OptimizationData.fromJson(it) }
        }
    }

    // State observation emits on jsDispatcher, consumers can switch context
    val profile: StateFlow<Profile?> = _profileFlow.asStateFlow()
}
```

- **Public API uses suspend functions.** Kotlin consumers call the SDK with `withContext` or from
  coroutine scopes.
- **StateFlow for state observation.** Thread-safe by design, can be collected from any dispatcher.
- **Timer callbacks** must be routed back to the JS dispatcher thread.

---

## 10. Debugging

- **QuickJS error reporting:** QuickJS provides detailed error messages with line numbers. These
  must be captured and forwarded to `android.util.Log`.
- **Console polyfill:** Route `console.log/warn/error` to Android's logging system with appropriate
  tag and level.
- **Bridge call logging:** In debug mode, log all Kotlin→JS and JS→Kotlin bridge calls with
  arguments and results.
- **No Chrome DevTools.** Unlike V8, QuickJS doesn't support the Chrome DevTools Protocol. This is
  the main debugging trade-off.
- **Source maps:** Include source maps in debug builds so JS stack traces map back to TypeScript
  source.
- **Workaround for complex debugging:** For deep JS debugging during development, run the same JS
  bundle in Node.js with the same inputs and use Node's debugger.

---

## 11. Alternative Approaches Considered

### 11a. Full Native Rewrite (Kotlin)

| Aspect          | Assessment                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Effort**      | Very high — reimplement all business logic, resolvers, event building, batching, queue policy, Zod-equivalent validation |
| **Maintenance** | Must keep Kotlin and JS implementations in sync — double the maintenance burden                                          |
| **Correctness** | High risk of behavioral divergence                                                                                       |
| **Performance** | Best native performance                                                                                                  |
| **Bundle size** | Smallest (no JS runtime overhead)                                                                                        |

**Verdict:** Too expensive. Changes to core logic would require coordinated updates to JS + Kotlin
codebases.

### 11b. Kotlin Multiplatform (KMP)

| Aspect          | Assessment                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Effort**      | High — port TypeScript to Kotlin, share between Android and iOS                                                                                     |
| **Maintenance** | Two sources of truth (KMP for mobile, TypeScript for web)                                                                                           |
| **Correctness** | Good Android+iOS parity, but diverges from web/node/RN                                                                                              |
| **Ecosystem**   | Stable and production-ready. Google-backed (I/O 2024). Used by Shopify, Netflix, Forbes, McDonald's. Swift Export enables direct Kotlin→Swift APIs. |
| **Bundle size** | Small — shared Kotlin compiles natively, no runtime overhead                                                                                        |

**Verdict:** KMP is the strongest alternative. It provides native performance, idiomatic APIs per
platform, and is the industry trend for mobile code sharing. The fundamental trade-off: it creates
two sources of truth (TypeScript for web/node/RN, Kotlin for iOS/Android). Netflix reports 40%
faster feature development with KMP. Forbes shares 80%+ of logic. For a team prioritizing a single
source of truth with the JS SDK, the embedded JS approach wins. For a team willing to accept the
maintenance burden of dual implementations in exchange for native performance and debuggability, KMP
is a serious contender.

### 11c. AndroidX JavaScriptEngine

| Aspect          | Assessment                                                                          |
| --------------- | ----------------------------------------------------------------------------------- |
| **Effort**      | Low-medium — official Google API                                                    |
| **Limitation**  | **Android 13+ only** — excludes ~40% of devices                                     |
| **API**         | Limited — designed for simple evaluation, not hosting a full runtime with callbacks |
| **Performance** | Process isolation adds latency                                                      |

**Verdict:** Not viable for an SDK that must support a wide device range.

### 11d. JS Core Wrapper with QuickJS (Recommended)

| Aspect          | Assessment                                                                   |
| --------------- | ---------------------------------------------------------------------------- |
| **Effort**      | Medium — build bridge + polyfills, no business logic to port                 |
| **Maintenance** | Single source of truth (JS SDK). Update the bundle to get core improvements. |
| **Correctness** | Guaranteed parity with web/node/RN SDKs                                      |
| **Performance** | Acceptable for our workload                                                  |
| **Bundle size** | ~1.7 MB (all ABIs) or ~650 KB (per-ABI split)                                |

**Verdict:** Best balance of effort, maintainability, correctness, and bundle size.

---

## 12. Implementation Phases (Suggested)

### Phase 1: Foundation (2-3 weeks)

- Set up Android library project (Gradle module)
- Integrate `quickjs-kt` dependency
- Implement core bridge layer (JS context lifecycle, JSON serialization)
- Implement critical polyfills: `fetch` (via OkHttp), `setTimeout/setInterval`, `console`,
  `crypto.randomUUID`
- Create JS bundler pipeline (esbuild → `optimization-core.bundle.js`)
- Verify CoreStateful can be instantiated and basic methods work
- Set up multi-ABI CI testing (ARM, x86 emulators)

### Phase 2: Core API (2-3 weeks)

- Expose full public API as suspend functions
- Implement state observation bridge (JS signals → StateFlow)
- Implement consent, reset, flush, destroy
- Implement persistence bridge (SharedPreferences)
- Implement connectivity monitoring (ConnectivityManager)
- Implement app lifecycle integration (ProcessLifecycleOwner → flush on background)
- Add ProGuard/R8 rules

### Phase 3: Polish & Testing (2-3 weeks)

- Comprehensive unit tests for bridge layer
- Integration tests comparing bridged SDK behavior vs direct JS SDK
- Performance benchmarking on low-end, mid-range, and high-end devices
- Memory profiling
- Test with R8/ProGuard in release mode
- Test on Android 8+ (API 26+) minimum
- Documentation and API reference
- Sample app

### Phase 4: View Tracking & Advanced Features (2-4 weeks, if needed)

- Native view visibility tracking
- Tap tracking via touch listeners
- Screen tracking via ActivityLifecycleCallbacks
- Debug/preview panel (Compose UI)

**Total estimate: 8-13 weeks** for a production-ready SDK (without view tracking UI).

---

## 13. Key Dependencies

| Dependency                   | Purpose                 | Notes                              |
| ---------------------------- | ----------------------- | ---------------------------------- |
| `quickjs-kt`                 | QuickJS Kotlin bindings | Well-maintained, coroutine support |
| `kotlinx-coroutines`         | Async operations        | Standard Kotlin async              |
| `kotlinx-serialization-json` | JSON serialization      | Standard Kotlin JSON               |
| `androidx.lifecycle`         | Process lifecycle       | App background detection           |
| `esbuild`                    | JS bundling             | Build-time only                    |

**Runtime dependencies are minimal** — `quickjs-kt` + `kotlinx-coroutines` +
`kotlinx-serialization`. All well-established in the Android ecosystem.

### Notable Prior Art: Cash App's Zipline

[Zipline](https://github.com/cashapp/zipline) by Cash App is the most production-proven example of
this pattern on Android. It embeds QuickJS in Kotlin programs and provides:

- `kotlinx.serialization` for cross-boundary data encoding
- Bridged interfaces extending `ZiplineService` with `close()` for resource management
- Pass-by-value (serialized) and pass-by-reference (live instance) patterns
- Precompiled JS→QuickJS bytecode for better cold-start
- EdDSA Ed25519 signatures for code authentication
- Kotlin source maps integrated into QuickJS bytecode (so crash stack traces show `.kt` file/line
  numbers)
- Memory leak detection

While Zipline is designed around Kotlin→JS compilation (not running an existing JS SDK), its
architecture validates QuickJS as a production-grade engine for Android SDK development. Its bridge
patterns and source map integration approach are directly applicable to our use case.

### Additional Alternative: oasis-jsbridge-android

[oasis-jsbridge-android](https://github.com/p7s1digital/oasis-jsbridge-android) by ProSiebenSat.1
Digital provides full bidirectional JS-Kotlin bridging with QuickJS backend, including
`setTimeout`/`setInterval` via `coroutines.delay`, ES6 module support, and JS proxy to Java APIs.
It's production-tested at a major European media company and could serve as a reference for bridge
implementation patterns.

---

## 14. Android-Specific Considerations

### Minimum SDK Version

- **Recommended: API 26 (Android 8.0)** — covers ~95% of active devices
- QuickJS has no minimum Android version requirement (it's pure C compiled via NDK)
- `quickjs-kt` supports Android API 21+

### AAR Distribution

- Distribute as an AAR via Maven Central
- Include native `.so` files for all ABIs inside the AAR
- JS bundle packaged as a raw resource or asset

### ProGuard/R8 Rules

- Must include consumer ProGuard rules in the AAR to prevent R8 from stripping:
  - JNI method signatures
  - Kotlin reflection used for serialization
  - Data classes used for bridge communication

### Gradle Plugin Considerations

- No custom Gradle plugin needed
- Standard dependency declaration: `implementation("com.contentful:optimization-android:x.y.z")`

---

## 15. iOS vs. Android: Key Differences

| Aspect               | iOS                                 | Android                            |
| -------------------- | ----------------------------------- | ---------------------------------- |
| **JS Runtime**       | JavaScriptCore (built-in, 0 KB)     | QuickJS (bundled, ~350 KB/ABI)     |
| **Binary impact**    | JS bundle only (~200-300 KB)        | Runtime + bundle (~600-750 KB/ABI) |
| **Runtime maturity** | Extremely mature (Apple-maintained) | Mature but community-maintained    |
| **Async pattern**    | async/await + Combine               | suspend + StateFlow                |
| **HTTP client**      | URLSession                          | OkHttp                             |
| **Persistence**      | Keychain / UserDefaults             | SharedPreferences / Keystore       |
| **Debugging**        | Safari Web Inspector                | No built-in JS debugger            |
| **Build complexity** | Lower (no NDK)                      | Higher (NDK for native libs)       |
| **Distribution**     | Swift Package Manager               | Maven Central (AAR)                |

Despite these differences, the **bridge layer design and polyfill strategy are nearly identical**. A
shared architecture document and test suite can validate both platforms.

---

## 16. Conclusion

The JS-core-wrapper approach with QuickJS is the recommended strategy for the Android SDK. It
provides:

1. **Single source of truth** — business logic lives in one place (the JS SDK)
2. **Automatic feature parity** — updating the JS bundle brings all core improvements to Android
3. **Minimal native code** — the Kotlin layer is ~1,500-2,500 lines of bridge + polyfill code
4. **Reasonable binary size** — ~650 KB per ABI split, competitive with similar SDKs
5. **Acceptable performance** — QuickJS is fast enough for our workload (JSON, HTTP, simple logic)
6. **Mature tooling** — `quickjs-kt` provides excellent Kotlin integration

The main investments are:

1. Building robust polyfills (especially `fetch` via OkHttp)
2. A well-tested bridge layer with comprehensive error handling
3. Multi-ABI CI testing

Once established, ongoing maintenance is very low — core logic changes only happen in the JS SDK,
and the Android wrapper picks them up by updating the bundled JS file.

The Android SDK will require slightly more effort than iOS due to the need to bundle a JS runtime
and handle NDK/JNI concerns, but the fundamental architecture and trade-offs are the same.
