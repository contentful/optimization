# Native SDK Strategy: Approach Decision

## Context

We need iOS and Android native SDKs for the Optimization SDK. We evaluated three approaches:

1. **Native from scratch** — rewrite the SDK in Swift and Kotlin independently
2. **Cross-platform compilation** — WASM or Kotlin Multiplatform to share code across platforms
3. **JS bridge** — embed our existing JavaScript SDK in a native JS engine with a thin native
   wrapper

We decided to investigate option 3 and built a working iOS proof-of-concept to validate it.

## Why not build from scratch?

The Optimization SDK core is non-trivial. It includes signal-based reactive state management, event
queuing with flush policies, consent guards with decorator-based interception, API client retry
logic, personalization resolution, and analytics batching. Reimplementing all of this in Swift _and_
Kotlin means:

- **Two new codebases** that must stay feature-equivalent with the JS SDK and with each other
- **Three places to ship every feature and fix** — JS, Swift, Kotlin
- **Three sets of tests** to maintain in parallel
- **Behavioral divergence risk** — subtle differences in queue timing, retry logic, or
  personalization resolution that are hard to catch in testing but surface as inconsistent behavior
  for customers

The SDK's complexity is concentrated in business logic, not platform-specific code. Rewriting it in
native languages buys us nothing that the JS version doesn't already provide — we'd be paying for
the rewrite purely to avoid running JS on mobile.

## Why not WASM or Kotlin Multiplatform?

**WASM** can run on the web, but the integration story on mobile is poor. iOS has no built-in WASM
runtime — you'd need to embed one (e.g., Wasmer, Wasmtime), which adds binary size and a new
dependency. Android support is similarly immature for non-browser contexts. WASM also can't do
networking or timers on its own, so you'd still need the same native bridge layer for `fetch`,
`setTimeout`, etc. And WASM is not in our current tech stack — it would be a new toolchain, a new
build pipeline, and a new set of expertise to maintain.

**Kotlin Multiplatform (KMP)** shares code between Android and iOS but not the web. We'd still need
to maintain the JS SDK separately, so we'd go from one codebase to two rather than one to three —
better, but still a parallel implementation that can diverge. KMP also requires the team to learn
Kotlin, its multiplatform tooling, and the KMP-specific patterns for platform-expect/actual
declarations. It's another technology to own indefinitely.

Both options introduce a new language and toolchain into the team's stack without eliminating the
core problem: keeping behavior identical across platforms. The JS bridge approach is the only option
that uses the _same code_ on web and mobile.

## The JS bridge approach

React Native proves this pattern at scale — it runs a full JavaScript application inside a native JS
engine and bridges platform APIs. We're doing a much simpler version: run our SDK's business logic
in JavaScript, bridge only the handful of platform APIs it needs (`fetch`, `setTimeout`, `console`,
`crypto`), and expose a clean native API surface on top.

### What the PoC validated

- CoreStateful initializes and runs correctly inside JavaScriptCore
- API calls work end-to-end through the `fetch` → `URLSession` bridge
- Reactive state from Preact Signals can be pushed to SwiftUI's `@Published` properties via a native
  callback — no polling required
- The entire SDK bundles to 85 kB (25 kB gzipped) as a single file with zero runtime dependencies
- The Xcode project has no third-party dependencies — only `JavaScriptCore.framework` and Foundation
- The same UMD bundle and JS polyfills would work on Android with a different JS engine

### What's actually platform-specific

Very little. The native wrapper for each platform consists of:

- ~100 lines of bridge code (register `fetch`, `setTimeout`, `console`, `crypto` into the JS engine)
- ~150 lines of lifecycle management (create engine, load bundle, expose public API)
- A `@Published`/`StateFlow` reactive layer that receives JSON state snapshots from JS

Everything else — personalization, analytics, event building, consent, queue management — runs
unmodified from the same JS source as the web SDK.

## Risks and what needs field validation

### Performance

The PoC works but hasn't been stress-tested. Things to validate:

- **Cold start time** — how long does JSContext creation + bundle evaluation take on low-end
  devices? The bundle is 85 kB, which should evaluate quickly, but this needs measurement on real
  hardware
- **Memory overhead** — a JSContext is a full JS runtime. We need to measure its baseline footprint
  and whether it grows over time with repeated API calls
- **Bridge crossing cost** — every `fetch` call crosses the JS↔native boundary twice (request out,
  response back). For the SDK's usage pattern (a few API calls per session) this should be
  negligible, but it needs profiling

### JS engine differences across platforms

iOS uses JavaScriptCore. Android requires choosing an engine — V8, QuickJS, or Hermes. Each has
slightly different performance characteristics and compliance levels. The risk is that code that
works in JSC behaves differently in another engine. This is low-risk since we're using standard
ES2023 features, but it needs integration testing on Android once we pick an engine.

### Polyfill completeness

The SDK relies on several Web APIs that JS engines don't provide (`URL`, `AbortController`,
`TextEncoder`, etc.). The PoC uses hand-written minimal polyfills. For production, these should be
replaced with bundler-injected spec-compliant polyfills. The risk is that our minimal versions miss
edge cases — for example, the `URL` polyfill doesn't handle all relative path resolution rules. The
mitigation is straightforward: configure the build to inject `core-js` polyfills at bundle time.

### App Store review

Apple allows JavaScriptCore for executing JavaScript — this is documented and explicitly permitted.
The key constraint is that the JS cannot be downloaded remotely to change app behavior (which we
don't do — the bundle is compiled into the app). This is the same pattern used by React Native apps
that ship in the App Store. Low risk, but worth confirming with Apple's current guidelines before
shipping.

### Long-term maintenance

The bridge layer is simple, but it's still code we own. If the core SDK starts using a new Web API
we haven't polyfilled, the native SDKs will break until we add it. The mitigation is the
bundler-injected polyfill approach — the build tool detects what's needed automatically. The native
bridges (`fetch`, `setTimeout`) are stable and unlikely to change.

## Recommendation

Proceed with the JS bridge approach. The PoC demonstrates that the architecture works, the risk
profile is manageable, and it's the only option that gives us a single source of truth for SDK
behavior across web, iOS, and Android. The next steps are:

1. Run performance benchmarks on real devices (cold start, memory, bridge overhead)
2. Build an Android PoC with a chosen JS engine to validate cross-platform parity
3. Replace hand-written JS polyfills with bundler-injected `core-js`
4. Design the public Swift/Kotlin API surface that hides the JS internals
