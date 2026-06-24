# Native bridge architecture

This document is for maintainers working on the internal `@contentful/optimization-js-bridge`
package and the native iOS and Android SDKs that consume it. It is not an application integration
guide.

The bridge lets the native SDKs share one TypeScript optimization core while Swift and Kotlin own
native runtime concerns such as persistence, networking, lifecycle handling, UI adapters, and
preview-panel presentation.

## Ownership

The bridge package owns one TypeScript adapter at `src/index.ts`. That adapter wraps
`@contentful/optimization-core`, exposes a small `globalThis.__bridge` object, and keeps the shared
optimization state machine available to JavaScriptCore on iOS and QuickJS on Android.

Native packages own the engine-specific context managers, host bindings, model decoding, and public
Swift/Kotlin APIs:

| Layer                                       | Owns                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/universal/optimization-js-bridge` | Bridge methods, callback payloads, preview override calls, polyfills, UMD outputs. |
| `packages/ios`                              | JavaScriptCore context lifecycle, Swift models, SwiftUI adapters, persistence.     |
| `packages/android`                          | QuickJS lifecycle, Kotlin models, Compose and Views adapters, persistence.         |

## Build output

`rslib.config.ts` builds the same bridge source into two UMD bundles:

| Bundle                               | Native consumer        | Engine                       |
| ------------------------------------ | ---------------------- | ---------------------------- |
| `optimization-ios-bridge.umd.js`     | iOS Swift Package      | JavaScriptCore (`JSContext`) |
| `optimization-android-bridge.umd.js` | Android library assets | QuickJS (`quickjs-kt`)       |

The bundles differ only in the package name stamped into analytics `library.name`. Keep that
platform-specific define intact so iOS and Android events remain distinguishable.

The package `postbuild` step copies the emitted UMD bundles into the native SDK resource locations.
Do not hand-edit `dist/` output or copied native bundles. Update bridge source or polyfills, then
run:

```sh
pnpm --filter @contentful/optimization-js-bridge build
```

## Polyfills and native bindings

The bridge bundle expects browser-like globals that JavaScriptCore and QuickJS do not provide:
`console`, `setTimeout`, `fetch`, `crypto.randomUUID`, `URL`, `URLSearchParams`, `AbortController`,
`queueMicrotask`, `Promise.withResolvers`, `TextEncoder`, and `TextDecoder`.

The JS polyfills live in `src/polyfills/` and are prepended to each UMD bundle before the bridge
IIFE. The native SDK must register the host-side `__native*` bindings before evaluating the bundle.

| Binding                | iOS implementation            | Android implementation         |
| ---------------------- | ----------------------------- | ------------------------------ |
| `__nativeLog`          | Routes to diagnostics.        | Routes through `__native.log`. |
| `__nativeSetTimeout`   | Schedules on the main queue.  | Schedules a coroutine delay.   |
| `__nativeClearTimeout` | Cancels the stored work item. | Cancels the stored job.        |
| `__nativeRandomUUID`   | Uses `UUID()`.                | Uses `UUID.randomUUID()`.      |
| `__nativeFetch`        | Uses `URLSession`.            | Uses `OkHttp`.                 |

Polyfills must stay platform-agnostic. If a future bridge feature needs platform-specific behavior,
prefer a build-time define in the bridge entry over forking polyfill files.

## Bridge method contract

Native code calls only through `globalThis.__bridge`. The bridge exposes methods such as
`initialize`, `identify`, `screen`, `page`, `track`, `trackView`, `trackClick`, `flush`, `consent`,
`reset`, `resolveOptimizedEntry`, `getProfile`, `getState`, `getPreviewState`, and preview override
mutators.

Async methods receive a payload plus success and error callback names. The JS bridge invokes one of
those global callbacks when the underlying promise settles. This keeps the JS side identical across
JavaScriptCore and QuickJS even though the native callback transport differs by platform.

Synchronous methods, including `resolveOptimizedEntry`, `consent`, `reset`, `setOnline`,
`getMergeTagValue`, `getProfile`, and preview override mutators, return JSON-compatible values
directly from engine evaluation.

## State push-back and lifecycle

During initialization, the native context manager installs push-back globals:

- `__nativeOnStateChange(json)` for profile, consent, locale, and optimization state snapshots.
- `__nativeOnEventEmitted(json)` for emitted Experience and Insights events.
- `__nativeOnOverridesChanged(json)` for preview-panel audience and variant overrides.
- `__nativeOnEventBlocked(json)` for blocked-event payloads with `reason`, `method`, and `args`.
- `__nativeOnQueueEvent(json)` for queue observability events such as offline drops, flush failures,
  circuit-open windows, and flush recovery.

These callbacks fire synchronously inside bridge calls. Native handlers may republish on the main
thread, but they should not defer the underlying state mutation past the method return when the
public API expects an immediate state snapshot.

Destroy paths should cancel timers, remove subscriptions and preview override state, evaluate
`__bridge.destroy()`, and close or release the JavaScript engine.

## Platform notes

- iOS bridge details and the JavaScriptCore package-resource flow live in
  [packages/ios/CODE_MAP.md](../../ios/CODE_MAP.md).
- Android bridge details, QuickJS dispatcher constraints, and asset packaging notes live in
  [packages/android/README.md](../../android/README.md).
- Reference app bootstrap and local validation flows live in the iOS and Android reference app
  READMEs under `implementations/`.

## Validation

For bridge contract, payload-shape, preview, or lifecycle changes:

```sh
pnpm --filter @contentful/optimization-js-bridge typecheck
pnpm --filter @contentful/optimization-js-bridge build
```

Then validate the affected native SDK and reference-app flow. Rebuild the bridge before Swift,
Kotlin, XCUITest, or Maestro results are treated as meaningful.
