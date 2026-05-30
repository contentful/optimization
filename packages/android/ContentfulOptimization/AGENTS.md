# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, then `packages/android/AGENTS.md`,
before this file.

## Scope

This directory is the Android library module (AAR) for the Contentful Optimization SDK. It contains
the Kotlin native runtime, QuickJS bridge integration (via `io.github.dokar3:quickjs-kt`), native
polyfill bindings (URLSession/OkHttp/timers/UUID), and public API surface.

## Key paths

- `src/main/kotlin/com/contentful/optimization/bridge/` — QuickJS context manager and callback
  manager
- `src/main/kotlin/com/contentful/optimization/core/` — public API, data models, config
- `src/main/kotlin/com/contentful/optimization/polyfills/` — native bindings exposed to JS
  (`__nativeFetch`, `__nativeSetTimeout`, etc.); JS polyfill source lives in
  `packages/universal/optimization-js-bridge/src/polyfills/` and is prepended into the UMD bundle
- `src/main/kotlin/com/contentful/optimization/storage/` — SharedPreferences persistence
- `src/main/kotlin/com/contentful/optimization/handlers/` — lifecycle and network handlers
- `src/main/kotlin/com/contentful/optimization/tracking/` — view tracking state machine and metadata
- `src/main/kotlin/com/contentful/optimization/compose/` — Jetpack Compose UI layer
  (OptimizationRoot, OptimizedEntry, LazyColumn tracking, screen/click/view tracking)
- `src/main/kotlin/com/contentful/optimization/preview/` — preview panel UI (theme, components,
  overlay, ViewModel, Contentful client, Activity)
- `src/main/assets/` — JS bridge UMD bundle (copied from the `@contentful/optimization-js-bridge`
  build; polyfills are prepended into the bundle itself)

## Local rules

- All QuickJs access must go through `QuickJsContextManager`. Never call `quickJs.evaluate()` from
  outside the manager.
- All JS engine calls must happen on the dedicated `quickJsDispatcher` thread. The manager enforces
  this.
- Do not hand-edit files in `src/main/assets/`. The UMD bundle is copied from the bridge build,
  which prepends polyfill sources from `packages/universal/optimization-js-bridge/src/polyfills/`.
- Keep bridge call signatures and JSON payload shapes aligned with
  `packages/universal/optimization-js-bridge/src/index.ts`.
- Keep Compose UI components aligned with iOS SwiftUI views when changing shared tracking or preview
  contracts.
- `PreviewPanelActivity` uses static client references for View-based app integration. Keep this
  pattern minimal and document the lifecycle implications.
- `ViewTrackingController` uses `positionInRoot()` coordinates. The `ScrollContext.scrollY` is
  always 0 because element positions already account for scroll offset.

## Commands

- Gradle build commands require Android SDK. Use `./gradlew build` from this directory (the module
  ships its own pinned wrapper, 8.10.2, and pins its plugin versions in `settings.gradle.kts`, so it
  builds standalone — not only inside the demo's composite build).
- Run `pnpm --filter @contentful/optimization-js-bridge build` to rebuild the JS bridge bundle
  before Gradle build. `buildJsBridge` (wired into `preBuild`) also does this automatically.

## Releasing

- Published to Maven Central (Sonatype Central Portal) as `com.contentful.java:optimization-android`
  by `.github/workflows/publish-android.yaml` on each `v*` release, in parallel with the Swift
  package. Version comes from the tag (`-Pcontentful.optimization.version` / `RELEASE_VERSION`); the
  group reuses Contentful's existing verified namespace `com.contentful.java`.
- Credentials are GitHub Actions secrets on `contentful/optimization`, provisioned and self-verified
  by `scripts/setup-maven-central-credential.sh` (Central Portal token + GPG signing key). The
  published artifacts are generated; nobody edits them by hand.
- Smoke-test packaging locally with
  `./gradlew publishToMavenLocal -Pcontentful.optimization.version=0.0.0-local` and consume it from
  a real app via `mavenLocal()` — this is how the Android demo is verified before a real release.
