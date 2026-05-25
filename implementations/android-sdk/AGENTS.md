# AGENTS.md

Read the repository root `AGENTS.md`, then `implementations/AGENTS.md`, before this file.

## Scope

This directory hosts **two** native Android reference implementations that integrate the Android SDK
from `packages/android/ContentfulOptimization` — one Jetpack Compose, one legacy XML Views. Both
apps demonstrate the same SDK capabilities, expose the same test IDs, and are driven by the **same**
UI Automator 2 suite from `uitests/`. This mirrors the iOS `swiftui/` + `uikit/` pair at
`implementations/ios-sdk/`.

## Key paths

- `compose/src/main/kotlin/com/contentful/optimization/app/` — Jetpack Compose reference impl
  - `screens/` — Screen composables
  - `components/` — Reusable UI components
  - applicationId: `com.contentful.optimization.app`
- `views/src/main/kotlin/com/contentful/optimization/app/views/` — XML Views reference impl
  - `screens/` is folded into per-screen Activities (`MainActivity`, `NavigationTestActivity`,
    `LiveUpdatesTestActivity`)
  - `components/` — `*Binder` objects that construct the equivalent View trees
  - `support/TestTagging.kt` — `View.setTestTag(testTag)` extension that exposes a kebab-case string
    as the view's `viewIdResourceName` via [AccessibilityNodeInfoCompat.setViewIdResourceName],
    matching Compose's `testTagsAsResourceId = true` behavior so the same UI Automator
    `By.res("testTag")` selector resolves in both apps
  - applicationId: `com.contentful.optimization.app.views`
- `shared/src/main/kotlin/com/contentful/optimization/shared/` — Platform-agnostic Kotlin helpers
  (`AppConfig`, `ContentfulFetcher`, `EventStore`, `MockPreviewContentfulClient`, `RichText`)
  consumed by both `:compose` and `:views`
- `uitests/` — UI Automator 2 E2E test module (`com.android.test`)
  - `uitests/src/main/kotlin/.../uitests/tests/` — Test files (1:1 mirror of iOS XCUITest suite)
  - `uitests/src/main/kotlin/.../uitests/support/` — `AppLauncher` (reads `APP_PACKAGE` from the
    instrumentation arguments), `TestHelpers`, `DeviceExtensions`
- `scripts/` — Build and run scripts; `run-e2e.sh` selects the target gradle module + APK from the
  `APP_PACKAGE` env var
- `build.gradle.kts` — Root build config (plugin versions)
- `settings.gradle.kts` — Project structure (includes `:compose`, `:views`, `:shared`, `:uitests`,
  and the SDK module via `project.dir`)

## Local rules

- **Both apps must be kept in lock-step.** Any new screen, component, button, or test-id must land
  in `compose/` and `views/` in the same change. The shared `uitests/` suite asserts the same
  contract against both, so a one-sided change breaks one matrix leg in CI.
- Reusable SDK behavior belongs in `packages/android/ContentfulOptimization`; TypeScript bridge
  behavior belongs in `packages/universal/optimization-js-bridge`. Platform-agnostic helpers shared
  between `:compose` and `:views` belong in `:shared`. Compose-only or Views-only glue stays in its
  own app module.
- The mock server must be running at `http://localhost:8000` before running either app. Use
  `adb reverse tcp:8000 tcp:8000` to forward the port to the emulator.
- After SDK source changes, rebuild both apps via
  `./gradlew :compose:assembleDebug :views:assembleDebug` from this directory.
- Keep accessibility identifiers (testTags) aligned with the iOS SwiftUI implementation and
  `implementations/PREVIEW_PANEL_SCENARIOS.md`.

## Test-ID contract

- **Compose impl:** `Modifier.testTag("foo-bar")` on the composable; the root composable sets
  `testTagsAsResourceId = true` so UI Automator resolves the tag through `By.res("foo-bar")`.
- **Views impl:** `view.setTestTag("foo-bar")` (the extension in `views/.../support/TestTagging.kt`)
  installs an `AccessibilityDelegateCompat` whose `onInitializeAccessibilityNodeInfo` reports the
  same string as `viewIdResourceName`, so the same `By.res("foo-bar")` selector resolves the
  matching `View`. Android XML `android:id` values must be valid Java identifiers and cannot carry
  kebab-case test tags, which is why the resource-id name is set programmatically.
- **SDK-side accessibility identifiers** (e.g. `OptimizedEntry`/`OptimizedEntryView`'s
  `accessibilityIdentifier` parameter) are surfaced through `contentDescription` and matched by
  tests with `By.desc("content-entry-${id}")`. This applies to both impls; the SDK adapter is
  responsible for setting the `contentDescription` so the same selector resolves.
- Test launch arguments use intent extras: `--ez reset true` clears SDK SharedPreferences,
  `--ez simulate_offline true` sets the client offline.

## Commands

- `pnpm serve:mocks` (from monorepo root)
- Build bridge first: `pnpm --filter @contentful/optimization-js-bridge build`
- Build one app: `./gradlew :compose:assembleDebug` or `./gradlew :views:assembleDebug`
- Build everything for the matrix: `pnpm build:apks`
- Bootstrap Compose impl on emulator: `./scripts/bootstrap.sh`
- Run UI tests against Compose app: `pnpm test:e2e:compose`
- Run UI tests against Views app: `pnpm test:e2e:views`
- Default `pnpm test:e2e` targets the Compose app
- Run a single test class against either app: `pnpm test:e2e:compose -- --test-class AnalyticsTests`

## UI tests

- The `uitests/` module is a `com.android.test` Gradle module — fully decoupled from app internals.
- Tests interact with the app purely through UI Automator 2's accessibility layer.
- The instrumentation runner argument `APP_PACKAGE` selects the app: `AppLauncher` reads it via
  `InstrumentationRegistry.getArguments()` and defaults to `com.contentful.optimization.app` when
  unset (so plain IDE runs hit the Compose impl).
- Element discovery: `By.res("testTag")` for app-level test identifiers (works for both apps thanks
  to the test-id contract above), `By.desc("id")` for SDK-level `accessibilityIdentifier` elements
  (e.g., `content-entry-{id}`).
- Test names and accessibility identifiers match the iOS XCUITest suite at
  `implementations/ios-sdk/uitests/Tests/` for cross-platform test parity.
- The mock server must be running and port-forwarded before running tests.

## Usually validate

- Build and assemble both APKs after Kotlin changes:
  `./gradlew :compose:assembleDebug :views:assembleDebug :uitests:assembleDebug`.
- After UI structure changes, run the UI test suite against both apps locally before pushing —
  `pnpm test:e2e:compose && pnpm test:e2e:views`. A regression that only shows up against one app
  points to a test-id or behavior divergence between the two reference impls.
- Rebuild `@contentful/optimization-js-bridge` before testing when bridge source changed.
- Verify accessibility identifiers match iOS counterparts when changing UI structure.
