# Optimization Android SDK

Native Android (Kotlin) SDK for the Contentful Optimization SDK Suite. Uses a hybrid
native-JavaScript architecture where Kotlin owns UI, persistence, and lifecycle while a shared
JavaScript core (via QuickJS, embedded through `io.github.dokar3:quickjs-kt`) handles
personalization logic, audience qualification, event batching, and preview overrides.

## Current status

> [!CAUTION] Pre-release. API surface is not yet stable.

- Kotlin Android library module under `ContentfulOptimization/`
- QuickJS JavaScript engine integration via `quickjs-kt`
- Shared TypeScript bridge under `packages/universal/optimization-js-bridge/`
- Jetpack Compose UI layer (OptimizationRoot, OptimizedEntry, scroll/view/click tracking)
- Preview panel with audience/experience overrides, variant selection, and Contentful integration
- View-based app support via `PreviewPanelActivity`
- `OptimizationConfig.locale` is the app/content locale candidate used to resolve `client.locale`.
  `OptimizationApiConfig.locale` is the explicit Experience API locale override. Runtime locale
  changes use `OptimizationClient.setLocale(locale)`. Explicit invalid locale values throw, and
  invalid ambient device locale candidates are ignored.
- `ContentfulLocales(default = "en-US")` is enough for single-locale apps. Add `supported` only when
  the app needs device-locale matching across multiple Contentful locales.
- Use `client.locale` for app-owned CDA fetches that feed SDK entry resolution. Do not pass
  all-locale CDA responses from `withAllLocales` or `locale=*`; see
  [Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).
  For the broader locale model, see
  [Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md).

## Architecture

The SDK mirrors the iOS SDK architecture:

- **QuickJS** (via `io.github.dokar3:quickjs-kt`) replaces JavaScriptCore as the JavaScript engine
- **`QuickJsContextManager`** manages the JS runtime on a dedicated single-thread dispatcher
- **`NativePolyfills`** provides native Kotlin implementations for fetch, timers, crypto, console,
  and URL — the same polyfill JS scripts are shared with iOS
- **`OptimizationClient`** exposes reactive state via `StateFlow` and async operations via `suspend`
  functions
- **`SharedPreferencesStore`** persists SDK state across app launches
- **`ViewTrackingController`** implements the three-phase viewport tracking state machine
- **Compose UI layer** provides `OptimizationRoot`, `OptimizedEntry`, `OptimizationLazyColumn`,
  `ScreenTrackingEffect`, and click/view tracking modifiers
- **Preview panel** provides a debug overlay with audience toggles, variant selectors, profile
  inspection, and override management

## Key differences from iOS

| Aspect         | iOS                    | Android                                  |
| -------------- | ---------------------- | ---------------------------------------- |
| JS engine      | JavaScriptCore         | QuickJS (via `quickjs-kt`)               |
| Threading      | Main thread            | Dedicated single-thread dispatcher       |
| Reactive state | `@Published` / Combine | `StateFlow` / `SharedFlow`               |
| Async          | `async`/`await`        | `suspend` functions                      |
| Persistence    | `UserDefaults`         | `SharedPreferences`                      |
| Lifecycle      | `NotificationCenter`   | `ProcessLifecycleOwner`                  |
| Network        | `NWPathMonitor`        | `ConnectivityManager`                    |
| HTTP           | `URLSession`           | `OkHttp`                                 |
| UI framework   | SwiftUI                | Jetpack Compose                          |
| DI / context   | `@EnvironmentObject`   | `CompositionLocal`                       |
| Preview panel  | `.sheet` + UIHosting   | `ModalBottomSheet` + `ComponentActivity` |

## When to use this directory

Use this SDK when building a native Android application that needs Contentful personalization and
analytics. For React Native applications, use
[@contentful/optimization-react-native](../react-native-sdk/README.md) instead.
