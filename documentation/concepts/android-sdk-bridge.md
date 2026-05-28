---
title: Android SDK bridge
---

# Android SDK bridge

Use this document when you need the Android-specific detail behind the QuickJS bridge — the
`quickjs-kt` engine wrapper, the single-threaded executor that serializes JS evaluation, the
`__native.log`-routing trick that delivers async callbacks back to Kotlin, and how coroutines fold
into the public API. For the cross-platform architecture and the identify / screen /
personalizeEntry call flow, read
[Native mobile SDK architecture](./native-mobile-sdk-architecture.md) first.

<details>
  <summary>Table of Contents</summary>

- [1. The QuickJS engine and dispatcher](#1-the-quickjs-engine-and-dispatcher)
- [2. Initialization sequence](#2-initialization-sequence)
- [3. Native polyfill bindings](#3-native-polyfill-bindings)
- [4. Async callback delivery via \_\_native.log](#4-async-callback-delivery-via-__nativelog)
- [5. Coroutine integration on the public API](#5-coroutine-integration-on-the-public-api)
- [6. Asset packaging](#6-asset-packaging)

</details>

## 1. The QuickJS engine and dispatcher

The Android SDK embeds QuickJS through
[`io.github.dokar3:quickjs-kt:1.0.5`](https://github.com/dokar3/quickjs-kt), declared in
[`packages/android/ContentfulOptimization/build.gradle.kts`](../../packages/android/ContentfulOptimization/build.gradle.kts).
`QuickJs.create(dispatcher)` returns a context that must be touched only from the dispatcher that
created it.

[`QuickJsContextManager`](../../packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/bridge/QuickJsContextManager.kt)
creates that dispatcher up front:

```kotlin
private val quickJsThread = Executors.newSingleThreadExecutor { r ->
    Thread(r, "contentful-quickjs").apply { isDaemon = true }
}
val quickJsDispatcher: CoroutineDispatcher = quickJsThread.asCoroutineDispatcher()
```

Every JS evaluation — sync, async, teardown, and the fetch / timer continuations that re-enter the
engine — runs through `withContext(quickJsDispatcher)`. There is no concurrent access to `QuickJs`
from any other thread.

## 2. Initialization sequence

`initialize(config, assets)` is a suspending function that runs entirely on `quickJsDispatcher`:

1. **Create the engine** with `QuickJs.create(quickJsDispatcher)`.
2. **Construct `NativeImpl`** with the dispatcher-bound `CoroutineScope`, a `TimerStore`, an
   `evaluateJS` callback that re-enters `qjs.evaluate` on the same dispatcher, and the manager's
   `onLog` handler.
3. **Register the native object** via
   `qjs.define("__native") { function("log") { ... }; function("setTimeout") { ... }; ... }`. This
   installs a single `__native` object on `globalThis` with five methods.
4. **Evaluate `NativeImpl.BOOTSTRAP_SCRIPT`**, a five-line script that aliases
   `__native.log/setTimeout/clearTimeout/randomUUID/fetch` to the matching `__nativeLog`,
   `__nativeSetTimeout`, ... globals the prepended polyfills expect.
5. **Evaluate the UMD bundle** loaded from `assets.open("optimization-android-bridge.umd.js")`. The
   eight polyfills are already prepended.
6. **Sanity check** `typeof __bridge`; anything other than `"object"` closes the engine and throws
   `OptimizationError.BridgeError`.
7. **Register the three push-back globals** — `__nativeOnStateChange`, `__nativeOnEventEmitted`,
   `__nativeOnOverridesChanged`. Each is installed in JS as a one-line shim that routes the JSON
   payload through `__native.log` with a sentinel level name (see § 4).
8. **Call `__bridge.initialize(<configJSON>)`**.

The matching `destroy()` runs `timerStore.cancelAll()`, evaluates `__bridge.destroy()`, calls
`qjs.close()`, and cancels the dispatcher-bound `CoroutineScope`.

## 3. Native polyfill bindings

All five `__native*` bindings live on `NativeImpl`
([`polyfills/NativePolyfills.kt`](../../packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/polyfills/NativePolyfills.kt)):

| Binding                | Implementation                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__nativeLog`          | Forwards `(level, message)` to the manager's `onLog`. `DiagnosticLogger` receives normal log levels.                                                                                                  |
| `__nativeSetTimeout`   | `scope.launch { delay(delayMs.coerceAtLeast(0)); timerStore.fired(id); evaluateJS("__timerFired($id)") }`. `Job` stored in `TimerStore`.                                                              |
| `__nativeClearTimeout` | `timerStore.cancel(id)` cancels the `Job` and removes it.                                                                                                                                             |
| `__nativeRandomUUID`   | `UUID.randomUUID().toString()`.                                                                                                                                                                       |
| `__nativeFetch`        | `OkHttpClient.newCall(request).enqueue(callback)`. On response, `scope.launch { evaluateJS("__fetchComplete($id, $status, \"$headers\", \"$body\", \"\")") }` re-enters the engine on the dispatcher. |

`escapeForJS` (also in `NativePolyfills.kt`) is used to safely interpolate response bodies and
headers into the `__fetchComplete` call. The `TimerStore` is a `ConcurrentHashMap<Int, Job>`, which
is overkill given the single-threaded dispatcher but cheap and defensive.

## 4. Async callback delivery via `__native.log`

The async-call contract — JS calls a named function global — exists on both platforms. On Android
the **delivery mechanism** is different: `quickjs-kt`'s binding API can call from JS into Kotlin
only through methods you registered via `qjs.define(...)`. Rather than register one Kotlin binding
per async call, the manager re-uses `__native.log` as a transport.

When `callAsync(method, payload, completion)` runs
([`QuickJsContextManager.kt:129–207`](../../packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/bridge/QuickJsContextManager.kt)):

1. `BridgeCallbackManager.registerCallback` mints unique names like `__identifyCallback_3_success`
   and `__identifyCallback_3_error` and stores their Kotlin closures in an internal map.
2. The manager evaluates a small JS shim that installs both names as globals whose body is
   `__native.log("__callback__<name>", json)`.
3. The manager **temporarily swaps `onLog`** with a wrapping handler that intercepts the
   `"__callback__<name>"` level codes, invokes the corresponding closure from the callback map, and
   restores the original `onLog`. Any other log level falls through to the original handler.
4. The manager evaluates `__bridge.<method>(<payload>, <successName>, <errorName>)`.

When the JS bridge resolves the promise, it calls the success global, which calls
`__native.log("__callback__<successName>", json)`, which is intercepted by the swapped `onLog`,
which invokes the registered Kotlin closure, which `post`s back to `Dispatchers.Main` to resume the
suspended coroutine. The same routing is used for the three push-back globals (`__stateChange__`,
`__eventEmitted__`, `__overridesChanged__`), installed once at initialization time rather than per
call.

The trade-off is that all callback traffic shares the `__native.log` binding, so a Kotlin handler in
the chain has to look at the level code to dispatch — but it avoids a per-call binding registration
and keeps the JS side identical to iOS.

## 5. Coroutine integration on the public API

`OptimizationClient`
([`core/OptimizationClient.kt`](../../packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationClient.kt))
funnels every async call through `bridgeCallAsyncJSON` / `bridgeCallAsyncVoid`, which:

1. Switch to `Dispatchers.Main`.
2. `suspendCoroutine { continuation -> ... }` launches a coroutine on `quickJsDispatcher` that calls
   `bridge.callAsync(method, payload) { result -> continuation.resume(...) }`.

The Main → quickJs → Main hop is intentional: callers can `await` from any dispatcher, the JS
evaluation always happens on the JS dispatcher, and the resumed value lands back on Main.

Sync calls take a different shape. `bridgeCallSyncWhenInitialized` is `fun` rather than
`suspend fun` (it must be callable from non-suspending UI code such as Compose effects), so it uses
`runBlocking(bridge.quickJsDispatcher) { bridge.callSync(...) }`. The comment in
[`QuickJsContextManager.kt:260–280`](../../packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/bridge/QuickJsContextManager.kt)
explains why this matters: `__nativeOnStateChange` fires **synchronously** inside the JS call, and
the `StateFlow` mutations it triggers must have settled before the sync call returns. Hopping off
the JS dispatcher in the middle of that flow would re-introduce the preview-panel race documented in
`PreviewPanelOverridesTests` scenario 3.

## 6. Asset packaging

The UMD bundle is checked into `packages/android/ContentfulOptimization/src/main/assets/`, which is
the default AGP source set for raw assets. `AssetManager.open("optimization-android-bridge.umd.js")`
reads it at runtime. No manifest entry, asset filter, or `aaptOptions` block is needed because the
file is already under `assets/`.

The reference implementation pulls in the SDK module via Gradle composite build
([`implementations/android-sdk/settings.gradle.kts`](../../implementations/android-sdk/settings.gradle.kts)),
so a fresh `./gradlew :app:assembleDebug` rebuilds `:ContentfulOptimization` from source and packs
the up-to-date asset into the test APK.

## Related

- [Native mobile SDK architecture](./native-mobile-sdk-architecture.md)
- [iOS SDK bridge](./ios-sdk-bridge.md)
- [`packages/android` README](../../packages/android/README.md)
- [Android reference implementation README](../../implementations/android-sdk/README.md)
- [Contributing to the Android SDK](../guides/contributing-to-the-android-sdk.md)
