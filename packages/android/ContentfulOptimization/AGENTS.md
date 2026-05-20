# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, then `packages/android/AGENTS.md`,
before this file.

## Scope

This directory is the Android library module (AAR) for the Contentful Optimization SDK. It contains
the Kotlin native runtime, QuickJS bridge integration, polyfill implementations, and public API
surface.

## Key paths

- `src/main/kotlin/com/contentful/optimization/bridge/` — QuickJS context manager and callback
  manager
- `src/main/kotlin/com/contentful/optimization/core/` — public API, data models, config
- `src/main/kotlin/com/contentful/optimization/polyfills/` — native polyfill implementations
- `src/main/kotlin/com/contentful/optimization/storage/` — SharedPreferences persistence
- `src/main/kotlin/com/contentful/optimization/handlers/` — lifecycle and network handlers
- `src/main/kotlin/com/contentful/optimization/tracking/` — view tracking state machine and metadata
- `src/main/kotlin/com/contentful/optimization/compose/` — Jetpack Compose UI layer
  (OptimizationRoot, OptimizedEntry, LazyColumn tracking, screen/click/view tracking)
- `src/main/kotlin/com/contentful/optimization/preview/` — preview panel UI (theme, components,
  overlay, ViewModel, Contentful client, Activity)
- `src/main/assets/` — JS bridge bundle and polyfill scripts (copied from android-quickjs-bridge
  build)

## Local rules

- All QuickJs access must go through `QuickJsContextManager`. Never call `quickJs.evaluate()` from
  outside the manager.
- All JS engine calls must happen on the dedicated `quickJsDispatcher` thread. The manager enforces
  this.
- Do not hand-edit files in `src/main/assets/`. They are copied from the bridge build and iOS
  polyfill sources.
- Keep bridge call signatures and JSON payload shapes aligned with
  `android-quickjs-bridge/src/index.ts`.
- Keep Compose UI components aligned with iOS SwiftUI views when changing shared tracking or preview
  contracts.
- `PreviewPanelActivity` uses static client references for View-based app integration. Keep this
  pattern minimal and document the lifecycle implications.
- `ViewTrackingController` uses `positionInRoot()` coordinates. The `ScrollContext.scrollY` is
  always 0 because element positions already account for scroll offset.

## Commands

- Gradle build commands require Android SDK. Use `./gradlew build` from this directory.
- Run `pnpm --filter @contentful/optimization-android-bridge build` to rebuild the JS bridge bundle
  before Gradle build.
