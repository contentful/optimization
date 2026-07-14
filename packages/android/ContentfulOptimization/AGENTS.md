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

- Kotlin/unit validation from this module: `./gradlew testDebugUnitTest`.
- Bridge build: `pnpm --filter @contentful/optimization-js-bridge build`
- Local Maven smoke test:
  `./gradlew publishToMavenLocal -Pcontentful.optimization.version=0.0.0-local --no-configuration-cache --no-daemon --console=plain`
- Broad Gradle graph validation from this module:
  `./gradlew build --no-configuration-cache --no-daemon --console=plain`. Use this for
  Gradle/build-graph changes or when a request explicitly needs the full local graph; do not
  substitute it for the CI unit path.
- Downstream Maestro after SDK runtime or UI adapter changes:
  `pnpm implementation:run -- android-sdk test:e2e:compose -- --flow <suite>` and
  `pnpm implementation:run -- android-sdk test:e2e:views -- --flow <suite>`.

## Releasing

- Maven Central publishing uses `.github/workflows/publish-android.yaml` on
  `optimization-android-v*` tags with group `com.contentful.java` and artifact
  `optimization-android`.
- Published artifacts are generated; do not edit them by hand.
- Android third-party notices are release assets. Debug/unit/local development must not depend on
  them. Release and publish flows that pass
  `-Pcontentful.optimization.requireThirdPartyNotices=true` must first run
  `pnpm notices:generate:android`.
- Keep notices assets variant-scoped through Gradle's generated release assets API. Do not fix
  missing generated-notices dependencies by adding piecemeal dependencies to debug tasks such as
  `packageDebugAssets`; that makes release-only artifacts leak into local/debug graphs.

## Validate

- Rebuild the bridge before Gradle checks when bridge source changed.
- Follow CI paths when choosing Android validation: `testDebugUnitTest` for source/unit coverage,
  `publishToMavenLocal` for packaging, and the publish workflow's `pnpm notices:generate:android`
  plus `publishToMavenLocal` or `publishAndReleaseToMavenCentral` with
  `requireThirdPartyNotices=true` for release-notices behavior.
- Smoke-test packaging with `publishToMavenLocal` before release-sensitive changes. When validating
  required notices locally, run `pnpm notices:generate:android` first and pass
  `-Pcontentful.optimization.requireThirdPartyNotices=true`.
- Run targeted Android Maestro through the reference implementation runner for behavior that affects
  persistence, lifecycle, tracking, preview-panel UI, or public Compose/XML Views adapters.
