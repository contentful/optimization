# AGENTS.md

Read the repository root `AGENTS.md`, then `implementations/AGENTS.md`, before this file.

## Scope

This directory hosts **two** native Android reference implementations that integrate the Android SDK
from `packages/android/ContentfulOptimization` — one Jetpack Compose, one legacy XML Views. Both
apps demonstrate the same SDK capabilities, expose the same test IDs, and are driven by the **same**
Maestro flow set from `maestro/`. This mirrors the iOS `swiftui/` + `uikit/` pair at
`implementations/ios-sdk/`.

The Android E2E suite is [Maestro](https://maestro.dev) (`maestro/`): one flow set drives both apps
via `appId: ${APP_ID}`, run locally with `pnpm test:e2e` and in CI by the `e2e-android-maestro` job.
The old UiAutomator suite under `uitests/` has been retired (its CI job removed) and that module is
dormant pending deletion in a follow-up — do not add to it.

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
    as the view's `viewIdResourceName` via `AccessibilityNodeInfoCompat.setViewIdResourceName`,
    matching Compose's `testTagsAsResourceId = true` so the same Maestro `id:` selector resolves in
    both apps
  - applicationId: `com.contentful.optimization.app.views`
- `shared/src/main/kotlin/com/contentful/optimization/shared/` — Platform-agnostic Kotlin helpers
  (`AppConfig`, `ContentfulFetcher`, `EventStore`, `MockPreviewContentfulClient`, `RichText`)
  consumed by both `:compose` and `:views`
- `maestro/` — the Maestro E2E flow set (one set, both apps); see `maestro/README.md`
- `uitests/` — retired UiAutomator module (`com.android.test`), dormant pending removal
- `scripts/` — build and run scripts; `run-e2e.sh` is the Maestro runner (manages the emulator, mock
  server, and app installs), `ci-maestro-run.sh` is the CI runner with per-flow retry
- `build.gradle.kts` — Root build config (plugin versions)
- `settings.gradle.kts` — Project structure (includes `:compose`, `:views`, `:shared`, `:uitests`,
  and the SDK module via `project.dir`)

## Local rules

- **Both apps must be kept in lock-step.** Any new screen, component, button, or test-id must land
  in `compose/` and `views/` in the same change. The shared Maestro flow set asserts the same
  contract against both, so a one-sided change fails that app's matrix leg in CI.
- Reusable SDK behavior belongs in `packages/android/ContentfulOptimization`; TypeScript bridge
  behavior belongs in `packages/universal/optimization-js-bridge`. Platform-agnostic helpers shared
  between `:compose` and `:views` belong in `:shared`. Compose-only or Views-only glue stays in its
  own app module.
- The mock server must be running on the host at port `8000` before running either app. The apps
  reach it via the emulator host alias `http://10.0.2.2:8000` (`AppConfig.mockHost`), so no
  `adb reverse` is required; `10.0.2.2` survives adb-daemon restarts that wipe reverse forwards.
- After SDK source changes, rebuild both apps via
  `./gradlew :compose:assembleDebug :views:assembleDebug` from this directory.
- Keep accessibility identifiers (testTags) aligned with the iOS SwiftUI implementation and
  `implementations/PREVIEW_PANEL_SCENARIOS.md`.

## Test-ID contract

- **Compose impl:** `Modifier.testTag("foo-bar")` on the composable; the root composable sets
  `testTagsAsResourceId = true` so the tag is exposed as the node's resource-id, matched by
  Maestro's `id: "foo-bar"` selector.
- **Views impl:** `view.setTestTag("foo-bar")` (the extension in `views/.../support/TestTagging.kt`)
  installs an `AccessibilityDelegateCompat` whose `onInitializeAccessibilityNodeInfo` reports the
  same string as `viewIdResourceName`, so the same `id: "foo-bar"` selector resolves the matching
  `View`. Android XML `android:id` values must be valid Java identifiers and cannot carry kebab-case
  test tags, which is why the resource-id name is set programmatically.
- **SDK-side accessibility identifiers** (e.g. `OptimizedEntry`/`OptimizedEntryView`'s
  `accessibilityIdentifier` parameter) are surfaced through `contentDescription`, matched by
  Maestro's text selector (a bare string or `text:`). This applies to both impls; the SDK adapter is
  responsible for setting the `contentDescription` so the same selector resolves.
- Test launch arguments use intent extras: `--ez reset true` clears SDK SharedPreferences for a
  clean unidentified start. (Offline simulation was removed — see
  [`maestro/OFFLINE_TESTING.md`](./maestro/OFFLINE_TESTING.md).)

## Commands

- `pnpm serve:mocks` (from monorepo root)
- Build bridge first: `pnpm --filter @contentful/optimization-js-bridge build`
- Build one app: `./gradlew :compose:assembleDebug` or `./gradlew :views:assembleDebug`
- Build both APKs for the matrix: `pnpm build:apks`
- Bootstrap Compose impl on emulator: `./scripts/bootstrap.sh`
- Run the Maestro suite against the Compose app: `pnpm test:e2e:compose`
- Run the Maestro suite against the Views app: `pnpm test:e2e:views`
- Default `pnpm test:e2e` runs both apps
- Run a single suite against an app: `pnpm test:e2e:compose -- --flow preview-panel`

## E2E tests (Maestro)

- Flows live in `maestro/<suite>/*.yaml`; a `maestro/config.yaml` workspace file makes flow
  discovery recurse into the per-suite subfolders.
- One flow set drives both apps. Each flow declares `appId: ${APP_ID}`; the runner passes the
  package at runtime (`maestro test -e APP_ID=<pkg> maestro`).
- Selectors: `id:` matches the resource-id (app test tags, per the contract above); a bare string or
  `text:` matches visible text and `contentDescription` (SDK `accessibilityIdentifier` elements).
- `stopApp` + a `reset` launch arg gives a clean unidentified start without `pm clear` (which wedges
  the package manager on loaded CI emulators).
- Flow/test names match the iOS XCUITest suite at `implementations/ios-sdk/uitests/Tests/` for
  cross-platform parity. The dwell/view-tracking contract stays out of E2E — it is owned by
  `ViewTrackingControllerTest` (JVM unit) and the iOS suite.
- The mock server must be running before running the suite; the apps reach it via `10.0.2.2`.

## Usually validate

- Build and assemble both APKs after Kotlin changes:
  `./gradlew :compose:assembleDebug :views:assembleDebug`.
- After UI structure changes, run the Maestro suite against both apps locally before pushing —
  `pnpm test:e2e:compose && pnpm test:e2e:views`. A regression that only shows up against one app
  points to a test-id or behavior divergence between the two reference impls.
- Rebuild `@contentful/optimization-js-bridge` before testing when bridge source changed.
- Verify accessibility identifiers match iOS counterparts when changing UI structure.
