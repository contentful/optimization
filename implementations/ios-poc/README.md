# iOS JSC PoC — Technical Write-Up

## Overview

This proof-of-concept demonstrates running the Contentful Optimization SDK inside a native iOS app
without React Native. It embeds the existing JavaScript SDK in Apple's JavaScriptCore (JSC) engine,
bridges the missing browser APIs to native Swift, and exposes reactive state observation to SwiftUI.

The goal is to validate that a single JS codebase can power both web and native mobile SDKs,
avoiding the cost of maintaining a parallel native implementation.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  SwiftUI                                        │
│  @Published state ← reactive updates            │
├─────────────────────────────────────────────────┤
│  JSContextManager                               │
│  Registers native functions, loads bundle,      │
│  calls __bridge methods, receives callbacks     │
├─────────────────────────────────────────────────┤
│  Polyfills (Swift ↔ JS)                         │
│  fetch → URLSession, setTimeout → GCD,          │
│  console → print, crypto → UUID                 │
├─────────────────────────────────────────────────┤
│  Polyfills (Pure JS)                            │
│  URL, URLSearchParams, AbortController,         │
│  TextEncoder, Promise.withResolvers, etc.       │
├─────────────────────────────────────────────────┤
│  optimization-ios-bridge.umd.js                 │
│  CoreStateful + all dependencies bundled as UMD │
│  Exposes globalThis.__bridge                    │
├─────────────────────────────────────────────────┤
│  JavaScriptCore                                 │
│  Apple's built-in JS engine (no browser APIs)   │
└─────────────────────────────────────────────────┘
```

### Components

**JS bridge package** (`packages/ios/ios-jsc-bridge/`): A thin TypeScript wrapper around
`CoreStateful` that assigns a `globalThis.__bridge` object with `initialize`, `identify`, `page`,
`getProfile`, `getState`, and `destroy`. Built as a single UMD file with all dependencies inlined
(84 kB, 24 kB gzipped).

**Swift PoC app** (`implementations/ios-poc/`): A SwiftUI app that creates a `JSContext`, injects
polyfills, evaluates the UMD bundle, and calls bridge methods. No third-party dependencies — uses
only `JavaScriptCore.framework` and Foundation.

## Reactive State: JS Signals to SwiftUI

The SDK uses [Preact Signals](https://github.com/nicmord/nicmord) internally for reactive state
management. Signals like `profile`, `consent`, `canPersonalize`, and `changes` update automatically
when API calls complete or the user interacts with the SDK.

The PoC bridges this reactivity to SwiftUI through a push-based callback pattern:

### JS side

During `initialize()`, a Preact Signals `effect()` is registered that observes the relevant signals.
When any signal value changes, the effect serializes the full state snapshot and calls a native
function:

```typescript
disposeEffect = effect(() => {
  const state = {
    profile: signals.profile.value ?? null,
    consent: signals.consent.value,
    canPersonalize: signals.canPersonalize.value,
    changes: signals.changes.value ?? null,
  }

  if (typeof globalThis.__nativeOnStateChange === 'function') {
    globalThis.__nativeOnStateChange(JSON.stringify(state))
  }
})
```

The effect is automatically triggered by Preact's dependency tracking — any signal read inside the
callback body becomes a dependency. No manual subscription management is needed.

### Swift side

Before calling `__bridge.initialize()`, the Swift layer registers a `@convention(block)` closure
into the JSContext:

```swift
let onStateChange: @convention(block) (String) -> Void = { [weak self] json in
    DispatchQueue.main.async {
        self?.handleStateChange(json)
    }
}
ctx.setObject(onStateChange, forKeyedSubscript: "__nativeOnStateChange" as NSString)
```

`handleStateChange` parses the JSON and writes to a `@Published var state` property on the
`ObservableObject`. SwiftUI views that reference `bridge.state` re-render automatically.

### How this would work in a production SDK

In a real iOS SDK, `JSContextManager` would be replaced by a public `OptimizationClient` class that
hides the JS internals. The reactive state would be exposed through idiomatic Swift APIs:

- **SwiftUI**: `@Published` properties on an `ObservableObject`, or an `@Observable` class (iOS 17+)
- **UIKit**: Combine publishers (`client.$profile.sink { ... }`)
- **Kotlin (Android)**: The same pattern maps to `StateFlow` — register a native callback into the
  JS engine, update `MutableStateFlow` values on state changes

The key insight is that the JS `effect()` is the single source of truth for "something changed." The
native layer doesn't need to know about Preact Signals — it just receives JSON snapshots and feeds
them into whatever reactive framework the platform uses.

## Polyfill Architecture

JavaScriptCore provides a standards-compliant JavaScript runtime (ES2023+) but **no browser/Web
APIs**. The SDK assumes several of these exist at runtime. The polyfills split into two categories:

### Native bridge polyfills (Swift → JS)

These polyfills **must** be native because they require platform capabilities that JavaScript alone
cannot provide:

| API                           | Native implementation                                | Why native               |
| ----------------------------- | ---------------------------------------------------- | ------------------------ |
| `fetch()`                     | `URLSession.shared.dataTask`                         | Network I/O              |
| `setTimeout` / `clearTimeout` | `DispatchQueue.main.asyncAfter` + `DispatchWorkItem` | OS timer scheduling      |
| `console`                     | `print()` / OSLog                                    | Native logging           |
| `crypto.randomUUID()`         | `UUID().uuidString`                                  | Cryptographic randomness |

The pattern for each: a Swift closure is registered into the JSContext via
`setObject(_:forKeyedSubscript:)`, and a JS wrapper script makes it callable through the standard
API name. For async operations like `fetch`, a callback-ID scheme bridges native completion handlers
back to JS Promises.

These are thin and unlikely to benefit from a third-party library.

### Pure JS polyfills (loaded from `.js` resource files)

These polyfills reimplement Web APIs that are **possible in pure JavaScript** but that JSC's
standalone framework omits:

| API                               | What the SDK uses it for                                             |
| --------------------------------- | -------------------------------------------------------------------- |
| `URL` / `URLSearchParams`         | `ExperienceApiClient` and `InsightsApiClient` construct request URLs |
| `AbortController` / `AbortSignal` | Request timeout support in the fetch retry layer                     |
| `TextEncoder` / `TextDecoder`     | Referenced by bundled dependencies                                   |
| `Promise.withResolvers`           | Used internally by the SDK's async patterns                          |
| `queueMicrotask`                  | Microtask scheduling for signal batching                             |

These are currently hand-written minimal implementations — just enough to cover the SDK's usage
patterns.

### Future: bundler-injected polyfills

For production, the pure JS polyfills should be handled at **build time** rather than shipped as
separate resource files. The approach:

**Configure rslib/rspack to inject polyfills into the UMD bundle.** The bundler already supports
this via `core-js` and target environment configuration. If we declare that the target environment
lacks `URL`, `AbortController`, `TextEncoder`, etc., rspack will inject spec-compliant polyfills
directly into the bundle output.

Benefits:

- Spec-compliant implementations (e.g., `whatwg-url` for `URL`) instead of hand-written subsets
- No separate resource files to manage — everything ships in one `.js` file
- The polyfill set is automatically determined by what the bundled code actually uses

The challenge is that JSC's feature set doesn't map to any standard `browserslist` target. JSC
supports modern JS syntax (arrow functions, async/await, classes, etc.) but not Web APIs that Safari
provides via WebKit. A custom configuration would be needed — either a manual `core-js` entry list
or a custom browserslist query.

The native bridge polyfills (`fetch`, `setTimeout`, `console`, `crypto`) would remain as
Swift-registered functions regardless, since they require platform capabilities that no JS polyfill
can provide.

### Summary

| Polyfill type                                              | Current approach                       | Production recommendation                    |
| ---------------------------------------------------------- | -------------------------------------- | -------------------------------------------- |
| Native bridge (`fetch`, `setTimeout`, `console`, `crypto`) | Swift closures registered in JSContext | Keep as-is — these are irreducible           |
| Pure JS (`URL`, `AbortController`, `TextEncoder`, etc.)    | Hand-written `.js` resource files      | Move to bundler-injected `core-js` polyfills |

## Android

The same architecture applies. The UMD bundle and all pure-JS polyfills are platform-agnostic. The
native bridge polyfills would map to:

- `fetch` → `OkHttp` / `HttpURLConnection`
- `setTimeout` → `Handler.postDelayed`
- `crypto.randomUUID()` → `java.util.UUID.randomUUID()`
- `console` → `android.util.Log`

The JS engine choice is the main decision: V8 (via Javet), QuickJS, or Hermes. All have the same "no
browser APIs" gap as JSC.

## Running the PoC

```bash
# 1. Start the mock server
pnpm --dir lib/mocks serve

# 2. Build the JS bundle
pnpm install && pnpm --filter @contentful/optimization-ios-bridge build

# 3. Copy bundle into Xcode project resources
cp packages/ios/ios-jsc-bridge/dist/optimization-ios-bridge.umd.js \
   implementations/ios-poc/OptimizationPoC/OptimizationPoC/Resources/

# 4. Open and run
open implementations/ios-poc/OptimizationPoC/OptimizationPoC.xcodeproj
# Select an iPhone simulator, press Run
```

### Verification

1. App launches, tap "Initialize SDK" — no JS exceptions in the console
2. Tap "Identify" — sends HTTP to `localhost:8000/experience/`, profile JSON appears in the result
   area, reactive state updates to show "Profile: Present"
3. Tap "Page" — sends another request, returns optimization data
4. The "Reactive State" indicators update automatically as signals change in the JS layer
