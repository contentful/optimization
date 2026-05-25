# AGENTS.md

Read the repository root `AGENTS.md`, then `implementations/AGENTS.md`, before this file.

## Scope

This is the native Android reference implementation for bridge and preview-panel validation work. It
uses a Jetpack Compose app shell with the Android SDK library module included via Gradle composite
build.

## Key paths

- `compose/src/main/kotlin/com/contentful/optimization/app/` — Jetpack Compose app source
- `compose/src/main/kotlin/com/contentful/optimization/app/screens/` — Screen composables
- `compose/src/main/kotlin/com/contentful/optimization/app/components/` — Reusable UI components
- `shared/src/main/kotlin/com/contentful/optimization/shared/` — Platform-agnostic Kotlin helpers
  (AppConfig, ContentfulFetcher, EventStore, MockPreviewContentfulClient, RichText) shared by every
  reference app under this directory
- `uitests/` — UI Automator 2 E2E test module (`com.android.test`)
- `uitests/src/main/kotlin/.../uitests/tests/` — Test files (1:1 mirror of iOS XCUITest suite)
- `uitests/src/main/kotlin/.../uitests/support/` — Shared test helpers, app launcher, device
  extensions
- `scripts/` — Build and run scripts
- `build.gradle.kts` — Root build config (plugin versions)
- `settings.gradle.kts` — Project structure (includes SDK module + uitests via project.dir)
- `compose/build.gradle.kts` — Compose app module build config and dependencies

## Local rules

- Keep this app focused on validating native Android integration behavior. Reusable SDK behavior
  belongs in `packages/android/ContentfulOptimization`, and TypeScript bridge behavior belongs in
  `packages/universal/optimization-js-bridge`.
- The mock server must be running at `http://localhost:8000` before running the app. Use
  `adb reverse tcp:8000 tcp:8000` to forward the port to the emulator.
- The app references the SDK via Gradle `include` + `project.dir` in `settings.gradle.kts`. After
  SDK source changes, rebuild via `./gradlew :compose:assembleDebug` from this directory.
- Keep accessibility identifiers (testTags) aligned with the iOS SwiftUI implementation and
  `implementations/PREVIEW_PANEL_SCENARIOS.md`.
- Use `Modifier.testTag()` for app-level test identifiers. The root composable sets
  `testTagsAsResourceId = true` so UI Automator 2 can discover them as `resource-id`.
- The SDK uses `Modifier.semantics { contentDescription = ... }` for its own identifiers (e.g.,
  `OptimizedEntry`'s `accessibilityIdentifier` parameter).
- Test launch arguments use intent extras: `--ez reset true` clears SDK SharedPreferences,
  `--ez simulate_offline true` sets the client offline.

## Commands

- `pnpm serve:mocks` (from monorepo root)
- From `implementations/android-sdk/`: `./gradlew :compose:assembleDebug`
- From `implementations/android-sdk/`: `./scripts/bootstrap.sh`
- Build bridge first: `pnpm --filter @contentful/optimization-js-bridge build`
- Build UI test APK: `./gradlew :uitests:assembleDebug`
- Run all UI tests: `./gradlew :uitests:connectedAndroidTest`
- Run single test class:
  `./gradlew :uitests:connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.contentful.optimization.uitests.tests.AnalyticsTests`

## UI tests

- The `uitests/` module is a `com.android.test` Gradle module — fully decoupled from app internals.
- Tests interact with the app purely through UI Automator 2's accessibility layer.
- Element discovery: `By.res("testTag")` for app `testTag` values, `By.desc("id")` for SDK
  `contentDescription` elements (e.g., `content-entry-{id}`).
- Test names and accessibility identifiers match the iOS XCUITest suite at
  `implementations/ios-sdk/uitests/Tests/` for cross-platform test parity.
- The mock server must be running and port-forwarded before running tests.

## Usually validate

- Run the app on emulator after changes to verify UI renders correctly.
- Verify accessibility identifiers match iOS counterparts when changing UI structure.
- Rebuild `@contentful/optimization-js-bridge` before testing when bridge source changed.
- After UI structure changes, run `./gradlew :uitests:assembleDebug` to verify test APK compiles.
