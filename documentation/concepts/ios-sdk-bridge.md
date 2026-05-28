---
title: iOS SDK bridge
---

# iOS SDK bridge

Use this document when you need the iOS-specific detail behind the JavaScriptCore bridge — context
lifecycle, exception handling, callback closure registration, signpost markers, the Swift Package
resource declaration. For the cross-platform architecture and the identify / screen /
personalizeEntry call flow, read
[Native mobile SDK architecture](./native-mobile-sdk-architecture.md) first.

<details>
  <summary>Table of Contents</summary>

- [1. The JavaScriptCore context](#1-the-javascriptcore-context)
- [2. Native polyfill bindings](#2-native-polyfill-bindings)
- [3. Async callback registration](#3-async-callback-registration)
- [4. Threading model](#4-threading-model)
- [5. Bundle resource declaration](#5-bundle-resource-declaration)
- [6. Diagnostics: exceptions and signposts](#6-diagnostics-exceptions-and-signposts)

</details>

## 1. The JavaScriptCore context

[`JSContextManager`](../../packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Bridge/JSContextManager.swift)
owns the `JSContext` for the lifetime of one `OptimizationClient`. Initialization runs in this fixed
order:

1. **Create the context** with `JSContext()` and install a global exception handler that surfaces
   uncaught JS errors via `onLog("exception", message)`.
2. **Enable remote inspection** (`ctx.isInspectable = true`) only when `config.debug` is `true` and
   the deployment target is iOS 16.4 / macOS 13.3 or newer. Release builds never expose this.
3. **Register the five native polyfill bindings** via `NativePolyfills.register(in: ctx, logger:)`.
   The call returns a `TimerStore` that the manager retains for the lifetime of the context and uses
   for `cancelAll()` on teardown.
4. **Evaluate the UMD bundle** loaded from
   `Bundle.module.url(forResource: "optimization-ios-bridge.umd", withExtension: "js")`. The eight
   polyfills are already prepended into the bundle text at build time, so a single `evaluateScript`
   call installs both the polyfills and `globalThis.__bridge`.
5. **Sanity check** `typeof __bridge` — anything other than `"object"` throws
   `OptimizationError.bridgeError`.
6. **Register the three push-back globals**: `__nativeOnStateChange`, `__nativeOnEventEmitted`, and
   `__nativeOnOverridesChanged`. Each is a Swift `@convention(block) (String) -> Void` closure that
   the JS bundle invokes whenever the relevant signal changes; the manager parses the JSON and
   re-emits on `DispatchQueue.main`.
7. **Call `__bridge.initialize(<configJSON>)`** with the merged configuration (consent, profile,
   changes, personalizations restored from `UserDefaultsStore` before this point).

## 2. Native polyfill bindings

All five `__native*` globals are registered as `@convention(block)` closures so JavaScriptCore can
call them as JS functions. Implementations live in
[`Polyfills/NativePolyfills.swift`](../../packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Polyfills/NativePolyfills.swift):

| Binding                | Signature                                        | Implementation                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `__nativeLog`          | `(String, String) -> Void`                       | Forwards `(level, message)` to the manager's `onLog` handler, which routes to `DiagnosticLogger`.                                                                                                                                                                                                      |
| `__nativeSetTimeout`   | `(Int, Int) -> Void`                             | Schedules a `DispatchWorkItem` on `DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(delayMs))`. The work item calls `__timerFired(id)` and clears its store entry.                                                                                                                       |
| `__nativeClearTimeout` | `(Int) -> Void`                                  | `TimerStore.cancel(id)` cancels the `DispatchWorkItem` and removes it.                                                                                                                                                                                                                                 |
| `__nativeRandomUUID`   | `() -> String`                                   | `UUID().uuidString.lowercased()`.                                                                                                                                                                                                                                                                      |
| `__nativeFetch`        | `(String, String, String, JSValue, Int) -> Void` | Builds a `URLRequest` from `(urlString, method, headersJSON, body, callbackId)` and dispatches via `URLSession.shared.dataTask`. Delivers the response on the main queue by calling `ctx.objectForKeyedSubscript("__fetchComplete")?.call(withArguments: [callbackId, status, headers, body, error])`. |

The `TimerStore` class keeps a `[Int: DispatchWorkItem]` map so per-context timer ids cannot collide
with another context's. `JSContextManager.destroy` calls `timerStore.cancelAll()` before evaluating
`__bridge.destroy()` and dropping the context reference.

For the JS-side polyfills that consume these bindings (load order, what each one installs on
`globalThis`), see
[Native mobile SDK architecture § 2](./native-mobile-sdk-architecture.md#2-polyfills-are-prepended-at-build-time).

## 3. Async callback registration

`__bridge.identify`, `__bridge.screen`, `__bridge.page`, `__bridge.flush`, `__bridge.trackView`, and
`__bridge.trackClick` are `Promise`-returning JS functions. Because `JSContext.evaluateScript`
cannot await a JS promise from Swift, the bridge passes two registered global function names instead
and lets the JS side invoke whichever fires:

[`BridgeCallbackManager`](../../packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Bridge/BridgeCallbackManager.swift)
mints unique callback names of the form `__<method>Callback_<id>_success` and
`__<method>Callback_<id>_error`. For each call, two `@convention(block) (String) -> Void` closures
are installed in the `JSContext` under those names. Each closure forwards its argument to the Swift
completion handler **and** sets both globals back to `nil`, so a single resolve / reject leaves no
lingering state on the JS side.

`JSContextManager.callAsync`
([`JSContextManager.swift:88–141`](../../packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Bridge/JSContextManager.swift))
also installs a per-call exception handler so a synchronous JS throw inside
`__bridge.method(payload, success, error)` is captured and surfaced as
`OptimizationError.bridgeError` rather than being silently logged. After the call returns the
exception handler is restored to whatever was installed before the call.

`OptimizationClient` wraps this in `withCheckedThrowingContinuation` so the public API is
`async throws`. The continuation resumes on the main queue because the success / error closures
dispatch with `DispatchQueue.main.async` before calling the completion handler.

## 4. Threading model

`JSContextManager` does no thread management of its own. JavaScriptCore is thread-safe as long as a
single `JSContext` is not used concurrently from multiple threads; `OptimizationClient` is annotated
`@MainActor` so all public API entry points are forced onto the main actor before the bridge call
issues. That means:

- `evaluateScript` runs on the main thread for every public client call.
- `__nativeFetch` schedules its `URLSession` work off the main queue (default), but delivers
  responses back via `DispatchQueue.main.async` before invoking `__fetchComplete`.
- `__nativeSetTimeout` fires on `DispatchQueue.main` so JS timer callbacks run on the same thread as
  bridge calls.
- The push-back handlers parse JSON on the calling thread and re-publish via
  `DispatchQueue.main.async` inside `handleStateChange`, `handleEvent`, and
  `handleOverridesChanged`.

## 5. Bundle resource declaration

`Package.swift` declares the UMD bundle as a `.copy` resource (verbatim, no Swift Resource Bundle
processing), and links the `JavaScriptCore` framework so the embedding app does not need to add it
manually:

```swift
.target(
    name: "ContentfulOptimization",
    resources: [
        .copy("Resources/optimization-ios-bridge.umd.js"),
    ],
    linkerSettings: [
        .linkedFramework("JavaScriptCore"),
    ]
)
```

`JSContextManager.loadBundleSource()` reads the file via `Bundle.module.url(forResource:)`. If the
resource cannot be located the call throws `OptimizationError.resourceLoadError` rather than
returning an empty bundle.

## 6. Diagnostics: exceptions and signposts

Two channels feed back to the host app from inside the bridge:

- **JS exceptions** — `ctx.exceptionHandler` invokes `onLog("exception", message)`. The default
  client wiring routes this to `DiagnosticLogger.debug`; tests can install
  `testOnlySetLogHandler(_:)` to intercept exceptions verbatim without losing the diagnostic log
  trail.
- **Fetch signposts** — every `__nativeFetch` call brackets the round trip with
  `os_signpost(.begin/.end, ...)` against the `"Fetch Bridge Crossing"` name in the
  `com.contentful.optimization` / `Performance` log. Instruments' "Points of Interest" track shows
  the begin/end pair tagged with method + URL on entry and status code on exit, so you can measure
  bridge round-trip cost without injecting timing into the SDK code itself.

## Related

- [Native mobile SDK architecture](./native-mobile-sdk-architecture.md)
- [Android SDK bridge](./android-sdk-bridge.md)
- [`packages/ios` README](../../packages/ios/README.md)
- [iOS reference implementation README](../../implementations/ios-sdk/README.md)
- [Contributing to the iOS SDK](../guides/contributing-to-the-ios-sdk.md)
