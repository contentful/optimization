# AGENTS.md

Native Android reference implementations: Jetpack Compose and XML Views apps using
`packages/android/ContentfulOptimization`. One Maestro flow set drives both apps.

## Rules

- Keep Compose and Views apps in lock-step. New screens, components, buttons, and test IDs must land
  in both apps in the same change.
- Reusable SDK behavior belongs in `packages/android/ContentfulOptimization`; bridge behavior
  belongs in `packages/universal/optimization-js-bridge`; shared app helpers belong in `:shared`.
- The mock server must run on the host at port `8000`; apps reach it through `http://10.0.2.2:8000`.
- After SDK source changes, build both apps from this directory:
  `./gradlew :compose:assembleDebug :views:assembleDebug`.
- The retired UiAutomator module under `uitests/` is dormant; do not add to it.
- Keep accessibility identifiers aligned with iOS and `implementations/PREVIEW_PANEL_SCENARIOS.md`.
- Prefer `scripts/run-e2e.sh` or the package scripts for local Maestro. The runner starts the mock
  server, resolves or launches a visible emulator for the pinned `pixel_7_api35_e2e` AVD, builds,
  installs, runs Maestro, and writes logs. To recover from stale emulator state, it may terminate
  detected headless `qemu-system` emulator processes and restart adb before launching a visible
  emulator; do not replace that documented runner behavior with manual process termination.
- Do not claim Android Maestro cannot run locally just because no device is attached before the
  runner starts. Run the documented runner or report its exact preflight failure.

## Test IDs and Maestro

- Compose uses `Modifier.testTag("foo-bar")`; `testTagsAsResourceId = true` exposes tags to Maestro
  `id:` selectors.
- Views use `view.setTestTag("foo-bar")` from `views/.../support/TestTagging.kt` to expose the same
  resource-id string.
- SDK-side `accessibilityIdentifier` values surface through `contentDescription` and are matched by
  Maestro text selectors.
- Test launch arguments use intent extras; `--ez reset true` clears SDK SharedPreferences for a
  clean unidentified start.
- Flows live in `maestro/<suite>/*.yaml`; each flow declares `appId: ${APP_ID}` and is run against
  both packages.

## Commands

- `pnpm serve:mocks`
- `pnpm --filter @contentful/optimization-js-bridge build`
- Build one app: `./gradlew :compose:assembleDebug` or `./gradlew :views:assembleDebug`
- Build both APKs: `pnpm build:apks`
- Bootstrap Compose on emulator: `./scripts/bootstrap.sh`
- Run Compose E2E from the monorepo root: `pnpm implementation:run -- android-sdk test:e2e:compose`
- Run Views E2E from the monorepo root: `pnpm implementation:run -- android-sdk test:e2e:views`
- Run both apps from the monorepo root: `pnpm implementation:run -- android-sdk test:e2e`
- Run one suite: `pnpm implementation:run -- android-sdk test:e2e:compose -- --flow preview-panel`
- From `implementations/android-sdk/`, the equivalent local scripts are `pnpm test:e2e:compose`,
  `pnpm test:e2e:views`, `pnpm test:e2e`, and `./scripts/run-e2e.sh --flow <suite>`.

## Validate

- Assemble both APKs after Kotlin changes.
- Run Maestro against both apps after shared UI structure, test ID, or behavior changes. If only
  Compose or only Views is affected, run that shell first, then run the other shell when parity is
  part of the contract.
- Rebuild `@contentful/optimization-js-bridge` before testing when bridge source changed.
