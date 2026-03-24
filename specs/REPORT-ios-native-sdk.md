# iOS Native SDK Report: Thin Wrapper over JavaScript Core

## Executive Summary

This report evaluates the feasibility of creating a native iOS SDK (Swift) for the Contentful
Optimization suite that acts as a thin wrapper around the existing JavaScript SDK
(`@contentful/optimization-core`). The approach embeds a JavaScript runtime within the iOS SDK to
execute the shared business logic, exposing a native Swift API that bridges to the JS layer.

**Verdict:** This approach is feasible and can significantly reduce code duplication. JavaScriptCore
(JSC) — Apple's built-in JS engine — is the recommended runtime. The main risks are around polyfill
requirements, bridge serialization overhead, and increased complexity in debugging.

**Important industry context:** No major analytics/personalization SDK currently embeds a JS engine
in native mobile SDKs. Segment, LaunchDarkly, Amplitude, and Mixpanel all use native-per-platform
implementations or share code only within the same language family. However, companies like Social
Tables (Cvent), Lucid (Lucidchart), and Skyscanner have successfully used JSC for shared business
logic in production iOS apps. This is a less-traveled path with real precedents but no dominant
pattern in the analytics SDK space.

---

## 1. General Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Swift Public API                  │
│  OptimizationiOS                                     │
│  ├── identify(payload:) async -> OptimizationData?   │
│  ├── page(payload:) async -> OptimizationData?       │
│  ├── screen(payload:) async -> OptimizationData?     │
│  ├── track(payload:) async -> OptimizationData?      │
│  ├── trackComponentView(payload:) async              │
│  ├── trackComponentClick(payload:) async             │
│  ├── personalizeEntry(entry:personalizations:)       │
│  ├── getCustomFlag(name:changes:) -> JSON?           │
│  ├── consent(accept:)                                │
│  ├── reset()                                         │
│  ├── flush() async                                   │
│  ├── destroy()                                       │
│  └── states: ObservableStates                        │
├─────────────────────────────────────────────────────┤
│                   Bridge Layer                       │
│  ├── JSBridge (JSON serialization / deserialization)  │
│  ├── JSPolyfills (fetch, setTimeout, console, etc.)  │
│  ├── NativeCallbacks (observable → Combine)          │
│  └── LifecycleManager (UIApplication state)          │
├─────────────────────────────────────────────────────┤
│              JavaScriptCore (JSC)                    │
│  ├── Bundled JS: optimization-core.bundle.js         │
│  ├── Polyfill layer                                  │
│  └── CoreStateful instance running in JSContext      │
├─────────────────────────────────────────────────────┤
│            Native Platform Services                  │
│  ├── Keychain / UserDefaults (persistence)           │
│  ├── URLSession (networking via polyfill bridge)     │
│  ├── UIApplication (lifecycle events)                │
│  ├── NWPathMonitor (connectivity)                    │
│  └── os.log (logging)                                │
└─────────────────────────────────────────────────────┘
```

### How It Works

1. **Initialization**: The Swift SDK creates a `JSContext` (JavaScriptCore), loads the bundled JS
   code (a single-file build of `optimization-core`), and instantiates `CoreStateful` within the JS
   context.
2. **Method Calls**: When Swift calls a method like `identify(payload:)`, the bridge serializes the
   Swift payload to JSON, invokes the corresponding JS method, and deserializes the JS response back
   to Swift types.
3. **State Observation**: JS signals/observables are bridged to Swift's Combine framework. The JS
   side registers callbacks that invoke native Swift functions when state changes, which then emit
   through Combine publishers.
4. **Networking**: The JS `fetch` API is polyfilled — when JS code calls `fetch()`, the polyfill
   routes it to native `URLSession`, which is more performant and supports iOS certificate pinning,
   proxy settings, etc.
5. **Persistence**: Storage operations are bridged to native Keychain or UserDefaults, replacing the
   browser's localStorage / React Native's AsyncStorage.

---

## 2. JavaScript Runtime Options

### JavaScriptCore (JSC) — Recommended

**Pros:**

- Built into iOS since iOS 7 — zero additional binary size
- Maintained by Apple as part of WebKit — always up to date
- Full ES2023+ support (since it tracks Safari's JS engine)
- Stable, well-documented `JSContext` / `JSValue` / `JSExport` API
- Runs on a dedicated thread — does not block the main thread
- No App Store review concerns (it's Apple's own framework)
- Supports calling Swift functions from JS and vice versa

**Cons:**

- No built-in Web APIs (fetch, setTimeout, console, URL, TextEncoder, crypto) — all must be
  polyfilled
- No native ES module loading (must pre-bundle JS into a single file)
- Debugging JS inside JSC is harder than in a browser (no built-in devtools)
- Performance: **interpreter-only mode in embedded use** — Apple restricts JIT compilation to
  WKWebView's separate process for security reasons. In-process JSC (via `JSContext`) runs without
  JIT, making it ~7-15x slower than WKWebView/Safari. For our SDK's workload (mostly JSON
  processing, HTTP calls, and simple logic) this is acceptable — but it's an important distinction.
  WKWebView could be used as an alternative to get JIT performance, but at the cost of process
  isolation overhead and headless WebView management complexity.

### Hermes

**Pros:**

- Bytecode precompilation → faster startup than JSC interpreter
- Runs on both iOS and Android — shared runtime across platforms
- ~4.5 MB binary size (or ~3 MB in "lean" config)
- Good ES2020+ support, actively maintained by Meta

**Cons:**

- Must be bundled as a static/dynamic framework — adds binary size
- Still requires polyfills for Web APIs
- Smaller community for standalone (non-React-Native) use
- Potentially harder to justify to stakeholders vs Apple's built-in JSC
- Less proven for standalone embedding outside React Native

### QuickJS

**Pros:**

- Extremely small (~350 KB compiled)
- Full ES2023 support including modules
- Single C file — easy to compile and embed
- Fastest startup time

**Cons:**

- Interpreter-only (no JIT) — slower execution than JSC with JIT
- No corporate backing for long-term maintenance
- Would need custom Swift/ObjC bridge wrappers
- Less ecosystem tooling

### Recommendation

**Use JavaScriptCore.** It's built into iOS (zero binary overhead), Apple-maintained,
well-documented, and avoids any App Store concerns. The lack of JIT in embedded mode is acceptable
for our workload — the SDK primarily does JSON processing, HTTP calls, and simple business logic,
not compute-heavy operations.

---

## 3. What Is Possible vs. What Is Not

### Fully Possible (Run in JS)

| Capability                     | Notes                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Personalization resolution** | `personalizeEntry()`, `getCustomFlag()`, `getMergeTagValue()` — pure logic, no platform dependencies |
| **Event building**             | EventBuilder constructs event payloads — pure logic                                                  |
| **State management**           | Preact signals work fine in JSC                                                                      |
| **Zod validation**             | Schema validation runs in pure JS                                                                    |
| **API client logic**           | Request construction, batching, queue policy, retry logic — all run in JS                            |
| **Interceptors**               | Event and state interceptors are pure JS callbacks                                                   |
| **Consent management**         | Signal-based, no platform dependencies                                                               |

### Requires Polyfill/Bridge (Logic in JS, Plumbing in Native)

| Capability                            | Bridge Strategy                                                      |
| ------------------------------------- | -------------------------------------------------------------------- |
| **HTTP networking (fetch)**           | Polyfill `fetch` → delegate to native `URLSession`                   |
| **Timers (setTimeout/setInterval)**   | Polyfill → use `DispatchQueue` or `Timer`                            |
| **Console logging**                   | Polyfill `console` → route to `os.log`                               |
| **Persistence (anonymous ID, state)** | Bridge to Keychain/UserDefaults (replaces AsyncStorage/localStorage) |
| **Crypto (randomUUID)**               | Polyfill `crypto.randomUUID` → `UUID().uuidString`                   |
| **TextEncoder/TextDecoder**           | Polyfill or provide via native bridge                                |
| **URL/URLSearchParams**               | Polyfill (core-js or custom)                                         |

### Must Be Native (Cannot Run in JS)

| Capability               | Reason                                                                        |
| ------------------------ | ----------------------------------------------------------------------------- |
| **App lifecycle events** | `UIApplication` state changes (background/foreground) for flush-on-background |
| **Network reachability** | `NWPathMonitor` for online/offline detection                                  |
| **Secure storage**       | Keychain access for sensitive data                                            |
| **UI components**        | Any preview panel or debug UI must be native SwiftUI/UIKit                    |
| **View tracking**        | `IntersectionObserver`-equivalent requires UIKit view hierarchy access        |
| **Tap/gesture tracking** | UIKit gesture recognizers, hit testing                                        |
| **Screen tracking**      | UIViewController lifecycle or navigation events                               |
| **Deep linking**         | URL scheme / Universal Links handling                                         |

---

## 4. Boundary Definition: JS vs. Native

```
┌──────────────────────────────────────┐
│          NATIVE (Swift) LAYER        │
│                                      │
│  Platform Services:                  │
│  • UIApplication lifecycle           │
│  • NWPathMonitor (connectivity)      │
│  • Keychain / UserDefaults           │
│  • URLSession (via fetch polyfill)   │
│  • os.log (via console polyfill)     │
│  • UIKit view hierarchy access       │
│  • SwiftUI/UIKit preview panel       │
│                                      │
│  SDK API Surface:                    │
│  • Public Swift types & protocols    │
│  • Combine publishers for state      │
│  • async/await method signatures     │
│  • Swift-idiomatic error handling    │
│                                      │
│  View Tracking (native):             │
│  • Visibility detection              │
│  • Scroll observation                │
│  • Tap gesture recognition           │
│  • Dwell time accumulation           │
│  → Calls JS core for event emission  │
│                                      │
├──────────────────────────────────────┤
│         JAVASCRIPT (JSC) LAYER       │
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

**Rule of thumb:** If the React Native SDK does it in JS (via hooks or core calls), the iOS SDK
should also do it in JS. Only UI rendering, platform API access, and gesture/visibility detection
should be native.

### Existing Polyfill Libraries

Several open-source libraries already provide JSC polyfills for iOS:

- **[ECMASwift](https://github.com/theolampert/ECMASwift)** — Most comprehensive: Blob, Console,
  Crypto, Fetch, FormData, Headers, Request, TextEncoder, Timers, URL, URLSearchParams
- **[javascript-core-extras](https://swiftpackageindex.com/mhayes853/javascript-core-extras)** —
  console.log, fetch, and other common APIs
- **[OasisJSBridge](https://cocoapods.org/pods/OasisJSBridge)** — setTimeout, XMLHttpRequest,
  console, localStorage with two-way JS Promise support

These could significantly accelerate the polyfill layer, though a production SDK would likely want
to own its polyfill implementations for quality control and to avoid unnecessary dependencies.

---

## 5. How the Bridge Works

### 5.1 Swift → JS Calls

```
Swift method call
  → Serialize arguments to JSON string
  → Call JSContext.evaluateScript() or JSValue.call()
  → Receive JSValue result
  → Deserialize JSON to Swift types
```

**Key API:** `JSContext` provides `evaluateScript(_:)` for executing JS code. `JSValue` represents a
JS value and supports `.call(withArguments:)` for function invocation. The `@objc` protocol
`JSExport` allows exposing Swift objects to JS.

**Performance:** Each bridge call involves JSON serialization/deserialization. For our SDK, method
calls happen at low frequency (user interactions, page navigations) so this overhead is negligible.
The main concern is batched event flushing, which is already handled asynchronously in the JS layer.

### 5.2 JS → Swift Callbacks (State Observation)

```
JS signal change
  → Signal callback fires
  → Callback invokes native function registered via JSContext
  → Native function serializes JSValue to Swift type
  → Emits through Combine PassthroughSubject
  → Swift subscribers receive the update
```

**Implementation:** During initialization, the Swift bridge registers callback functions in the
JSContext. When JS state changes (profile, consent, personalizations, etc.), the signal effect
invokes these registered callbacks, passing the new value as a serialized JSON object. The Swift
side deserializes and publishes through Combine.

### 5.3 Fetch Polyfill Bridge

```
JS fetch() call
  → Polyfill intercepts
  → Calls native Swift function with (url, method, headers, body)
  → Swift creates URLRequest, executes via URLSession
  → Response flows back: (status, headers, body) → JS
  → Polyfill constructs Response object, resolves Promise
```

This is the most critical bridge component. The JS SDK's API client uses `fetch` for all HTTP
communication. The polyfill must:

- Support request/response headers
- Handle body serialization (JSON)
- Support the Beacon API pattern (fire-and-forget for analytics flush)
- Respect iOS proxy and certificate pinning settings

### 5.4 Timer Polyfill Bridge

```
JS setTimeout(fn, ms)
  → Polyfill calls native registerTimer(id, ms)
  → Swift creates DispatchWorkItem
  → On fire: invokes JS callback by timer ID
  → Returns timer ID for clearTimeout
```

---

## 6. Risks

### 6.1 High Risks

| Risk                            | Impact                                                                                                        | Mitigation                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JSC interpreter performance** | JSC runs without JIT in embedded mode. Complex operations could be slow.                                      | Profile actual SDK workload. Our JS is lightweight (JSON, HTTP, simple logic). Benchmark early.                                                                     |
| **Polyfill correctness**        | Incomplete or buggy polyfills (especially fetch) could cause subtle runtime errors                            | Comprehensive integration tests. Test the same API scenarios against both the JS SDK directly and the bridged iOS SDK.                                              |
| **Debugging difficulty**        | Cannot easily attach browser devtools to JSC. JS errors may be opaque.                                        | Implement robust error bridging. Use `JSContext.exceptionHandler` to catch and log all JS errors with stack traces. Consider Safari Web Inspector for debug builds. |
| **Bridge type safety**          | JSON serialization loses type information. Mismatches between Swift and JS types could cause runtime crashes. | Generate Swift types from the same Zod schemas. Use Codable for serialization. Extensive contract tests.                                                            |

### 6.2 Medium Risks

| Risk                       | Impact                                                                                              | Mitigation                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Bundle size of JS code** | The bundled JS (core + api-client + api-schemas + Zod + Preact signals + es-toolkit) could be large | Tree-shake aggressively. Minify with esbuild/terser. Estimated: 100-300KB minified+gzipped, which is acceptable. |
| **Memory pressure**        | JSContext consumes memory. Combined with the app's own memory, could cause issues on older devices. | Lazy initialization. Destroy context when not needed. Monitor memory in testing.                                 |
| **Threading complexity**   | JSC's `JSContext` is not thread-safe. All JS calls must happen on a dedicated serial queue.         | Create a dedicated `DispatchQueue` for all JS operations. Route all bridge calls through it.                     |
| **Version drift**          | JS bundle version could diverge from native wrapper version                                         | Embed JS bundle in the SDK package. Version them together. CI validates compatibility.                           |

### 6.3 Low Risks

| Risk                             | Impact                                                         | Mitigation                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **App Store rejection**          | Apple could reject apps using JSC for "dynamic code execution" | Extremely unlikely — JSC is Apple's own framework, widely used. React Native apps pass review. Our JS is bundled, not downloaded. |
| **iOS version compatibility**    | JSC API availability                                           | JSC has been available since iOS 7. The modern `JavaScriptCore` framework API is stable. Target iOS 15+ for other reasons.        |
| **Preact signals compatibility** | Signals library might use unsupported JS features              | Preact signals-core is small and uses basic JS. Should work in any ES2020+ runtime. Verify in CI.                                 |

---

## 7. Bundle Size Estimate

| Component                                       | Estimated Size (minified) | Gzipped        |
| ----------------------------------------------- | ------------------------- | -------------- |
| optimization-core                               | ~40-60 KB                 | ~15-25 KB      |
| optimization-api-client                         | ~20-30 KB                 | ~8-12 KB       |
| optimization-api-schemas (Zod schemas)          | ~30-50 KB                 | ~10-18 KB      |
| Zod runtime                                     | ~50-80 KB                 | ~15-25 KB      |
| Preact signals-core                             | ~3-5 KB                   | ~1-2 KB        |
| es-toolkit (used functions)                     | ~10-20 KB                 | ~4-8 KB        |
| Polyfills (fetch, timers, console, crypto, URL) | ~15-25 KB                 | ~5-10 KB       |
| **Total JS bundle**                             | **~170-270 KB**           | **~60-100 KB** |
| JSC runtime                                     | **0 KB** (built into iOS) | 0 KB           |
| Swift bridge layer                              | ~20-40 KB                 | —              |
| **Total SDK overhead**                          | **~190-310 KB**           | —              |

This is well within acceptable bounds for a mobile SDK. For comparison, the Contentful CDA SDK alone
is ~200 KB.

---

## 8. App Store Considerations

- **JavaScriptCore is explicitly allowed.** It's Apple's own framework, part of the iOS SDK.
- **No dynamic code download.** The JS bundle is compiled into the app binary. Apple's rule against
  "downloading executable code" applies to native code, not interpreted JS.
- **React Native precedent.** Thousands of React Native apps (which embed JS runtimes) pass App
  Store review.
- **No WebView required.** Using JSC directly without a WKWebView is standard practice and does not
  trigger WebView-related review flags.

---

## 9. Threading Model

- **JSContext is NOT thread-safe.** All interactions with a JSContext must occur on the same thread
  (or serial queue).
- **Recommended pattern:** Create a dedicated serial `DispatchQueue` (e.g.,
  `DispatchQueue(label: "com.contentful.optimization.js")`). All bridge calls are dispatched to this
  queue.
- **Public API uses async/await.** Swift consumers call `await sdk.identify(...)`, which internally
  dispatches to the JS queue, executes, and returns the result.
- **State observation is thread-safe.** Combine publishers emit on the JS queue but can be received
  on any queue via `.receive(on: DispatchQueue.main)`.

```swift
// Example threading pattern
class OptimizationiOS {
    private let jsQueue = DispatchQueue(label: "com.contentful.optimization.js")
    private let context: JSContext

    func identify(payload: IdentifyPayload) async -> OptimizationData? {
        await withCheckedContinuation { continuation in
            jsQueue.async {
                let result = self.bridge.callJS("identify", args: payload.toJSON())
                continuation.resume(returning: result.toSwift())
            }
        }
    }
}
```

---

## 10. Debugging

- **Safari Web Inspector (iOS 16.4+):** Set `context.isInspectable = true` on your JSContext. Then
  open Safari on macOS → Develop menu → select your device/simulator → select the JSContext. This
  provides **full debugging**: breakpoints, console, network inspection, JS profiling via Timeline.
  Safari also has "Automatically Show Web Inspectors for JSContexts" to avoid manual selection after
  each reload.
- **JSContext.exceptionHandler:** Set this to capture all JS exceptions with full stack traces. Log
  them via os.log.
- **Structured error bridging:** Wrap JS errors in Swift Error types with the JS stack trace, error
  message, and context about which bridge call failed.
- **Logging bridge:** The polyfilled `console.log/warn/error` routes to os.log with appropriate log
  levels, making JS logs visible in Xcode's console.
- **Pre-iOS 16.4:** Before the `isInspectable` API, debugging JSC was much harder — essentially
  logging-only. Target iOS 16.4+ for debug builds if possible.

---

## 11. Alternative Approaches Considered

### 11a. Full Native Rewrite (Swift)

| Aspect          | Assessment                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Effort**      | Very high — must reimplement all business logic, resolvers, event building, batching, queue policy, Zod validation |
| **Maintenance** | Must keep two implementations in sync — any core logic change requires updating Swift AND JS                       |
| **Correctness** | Risk of behavioral divergence between platforms                                                                    |
| **Performance** | Best possible native performance                                                                                   |
| **Bundle size** | Smallest possible                                                                                                  |

**Verdict:** Too expensive to maintain. Business logic changes would require coordinated updates
across 3+ codebases.

### 11b. Kotlin Multiplatform (KMP)

| Aspect          | Assessment                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Effort**      | High — must port core logic from TypeScript to Kotlin, then share via KMP                                                                                                                                    |
| **Maintenance** | Still a separate codebase from the JS SDK. Two sources of truth.                                                                                                                                             |
| **Correctness** | Good for iOS+Android parity, but diverges from web/node/RN                                                                                                                                                   |
| **Ecosystem**   | KMP is now stable and production-ready (Google-backed as of I/O 2024). Used by Shopify, Netflix, Forbes, McDonald's, H&M, Philips. Swift Export feature (2024-2025) enables direct Kotlin→Swift translation. |

**Verdict:** KMP is the strongest alternative to the embedded JS approach. It solves iOS+Android
sharing with native performance and idiomatic APIs. The key tradeoff: it does NOT solve the
fundamental problem of keeping parity with the JS SDK — you'd maintain two sources of truth
(TypeScript for web/node/RN, Kotlin for iOS/Android). For a team with strong Kotlin expertise
willing to accept that trade-off, KMP is a serious contender. For a team that prioritizes a single
source of truth above all else, the JS wrapper approach wins.

### 11c. C/C++ Shared Core

| Aspect          | Assessment                                                         |
| --------------- | ------------------------------------------------------------------ |
| **Effort**      | Very high — must rewrite in C/C++                                  |
| **Maintenance** | Single source of truth for native, but completely separate from JS |
| **Correctness** | Guaranteed native parity, but diverges from JS SDK                 |
| **Ecosystem**   | Complex build systems, no Zod equivalent                           |

**Verdict:** Overkill for our use case. The JS SDK is the canonical implementation.

### 11d. JS Core Wrapper (Recommended)

| Aspect          | Assessment                                                                   |
| --------------- | ---------------------------------------------------------------------------- |
| **Effort**      | Medium — build bridge layer and polyfills, but no business logic to port     |
| **Maintenance** | Single source of truth (JS SDK). Native SDKs automatically get core updates. |
| **Correctness** | Guaranteed parity — same code runs everywhere                                |
| **Performance** | Acceptable for our workload (not compute-intensive)                          |
| **Bundle size** | Moderate (~200-300 KB for JS bundle, 0 KB for JSC runtime)                   |

**Verdict:** Best balance of effort, maintainability, and correctness.

---

## 12. Implementation Phases (Suggested)

### Phase 1: Foundation (2-3 weeks)

- Set up Swift Package Manager project structure
- Implement JSC bridge layer (JSContext management, JSON serialization)
- Implement critical polyfills: `fetch` (via URLSession), `setTimeout/setInterval`, `console`,
  `crypto.randomUUID`
- Create JS bundler pipeline (esbuild to produce `optimization-core.bundle.js`)
- Verify CoreStateful can be instantiated and basic methods work

### Phase 2: Core API (2-3 weeks)

- Expose full public API: identify, page, screen, track, trackComponentView, trackComponentClick,
  personalizeEntry, getCustomFlag, getMergeTagValue
- Implement state observation bridge (JS signals → Combine publishers)
- Implement consent, reset, flush, destroy
- Implement persistence bridge (Keychain/UserDefaults)
- Implement connectivity monitoring (NWPathMonitor)
- Implement app lifecycle integration (background flush)

### Phase 3: Polish & Testing (2-3 weeks)

- Comprehensive unit tests for bridge layer
- Integration tests comparing bridged SDK behavior vs direct JS SDK
- Contract tests from Zod schemas → Swift Codable types
- Performance benchmarking
- Memory profiling
- Documentation and API reference

### Phase 4: View Tracking & Advanced Features (2-4 weeks, if needed)

- Native view visibility tracking (equivalent to useViewportTracking)
- Tap tracking
- Screen tracking
- Preview panel (debug UI in SwiftUI)

**Total estimate: 8-13 weeks** for a production-ready SDK (without view tracking UI, which is
optional for V1).

---

## 13. Key Dependencies

| Dependency               | Purpose           | Version            |
| ------------------------ | ----------------- | ------------------ |
| JavaScriptCore.framework | JS runtime        | Built into iOS     |
| Combine.framework        | State observation | Built into iOS 13+ |
| Swift Package Manager    | Distribution      | Standard           |
| esbuild                  | JS bundling       | Build-time only    |

**Zero third-party runtime dependencies** for the core SDK — a significant advantage for SDK
adoption.

---

## 14. Conclusion

The JS-core-wrapper approach is the recommended strategy for the iOS SDK. It provides:

1. **Single source of truth** — business logic lives in one place (the JS SDK)
2. **Automatic feature parity** — updating the JS bundle brings all core improvements to iOS
3. **Minimal native code** — the Swift layer is ~1,000-2,000 lines of bridge + polyfill code
4. **Zero runtime dependencies** — JSC is built into iOS
5. **Acceptable performance** — our workload is not compute-intensive
6. **Proven pattern** — React Native and other frameworks validate this approach at massive scale

The main investments are in building robust polyfills (especially `fetch`) and a type-safe bridge
layer. Once established, the ongoing maintenance cost is very low — core logic changes only need to
happen in the JS SDK.
