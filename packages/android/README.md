# Optimization Android SDK

Native Android (Kotlin) SDK for the Contentful Optimization SDK Suite. Uses a hybrid
native-JavaScript architecture where Kotlin owns UI, persistence, and lifecycle while a shared
JavaScript core (via Zipline/QuickJS) handles personalization logic, audience qualification, event
batching, and preview overrides.

## Current status

> [!CAUTION] Pre-release. API surface is not yet stable.

- Kotlin Android library module under `ContentfulOptimization/`
- Zipline (QuickJS) JavaScript engine integration
- Shared TypeScript bridge under `packages/universal/optimization-js-bridge/`
- Jetpack Compose UI layer (OptimizationRoot, OptimizedEntry, scroll/view/click tracking)
- Preview panel with audience/experience overrides, variant selection, and Contentful integration
- View-based app support via `PreviewPanelActivity`

## Architecture

The SDK mirrors the iOS SDK architecture:

- **Zipline (QuickJS)** replaces JavaScriptCore as the JavaScript engine
- **`ZiplineContextManager`** manages the JS runtime on a dedicated single-thread dispatcher
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
| JS engine      | JavaScriptCore         | Zipline (QuickJS)                        |
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
