# AGENTS.md

Android library module (AAR) for the native Kotlin SDK: public API, QuickJS bridge integration,
native bindings, persistence, lifecycle/network handlers, tracking, Compose UI, preview panel, and
assets.

## Rules

- All QuickJS access goes through `QuickJsContextManager` on the dedicated `quickJsDispatcher`
  thread.
- Do not hand-edit `src/main/assets/`; it is copied from the bridge build with shared polyfills
  prepended.
- Keep bridge signatures and JSON payload shapes aligned with
  `packages/universal/optimization-js-bridge/src/index.ts`.
- Keep Compose UI components aligned with iOS SwiftUI views for shared tracking or preview
  contracts.
- `PreviewPanelActivity` uses static client references for View-based integration; keep the pattern
  minimal and document lifecycle implications.
- `ViewTrackingController` uses `positionInRoot()` coordinates; `ScrollContext.scrollY` stays `0`
  because positions already include scroll offset.

## Commands

- From this directory: `./gradlew build`
- Bridge build: `pnpm --filter @contentful/optimization-js-bridge build`
- Local Maven smoke test:
  `./gradlew publishToMavenLocal -Pcontentful.optimization.version=0.0.0-local`
- Downstream Maestro after SDK runtime or UI adapter changes:
  `pnpm implementation:run -- android-sdk test:e2e:compose -- --flow <suite>` and
  `pnpm implementation:run -- android-sdk test:e2e:views -- --flow <suite>`.

## Releasing

- Maven Central publishing uses `.github/workflows/publish-android.yaml` on `v*` tags with group
  `com.contentful.java` and artifact `optimization-android`.
- Published artifacts are generated; do not edit them by hand.

## Validate

- Rebuild the bridge before Gradle checks when bridge source changed.
- Smoke-test packaging with `publishToMavenLocal` before release-sensitive changes.
- Run targeted Android Maestro through the reference implementation runner for behavior that affects
  persistence, lifecycle, tracking, preview-panel UI, or public Compose/XML Views adapters.
