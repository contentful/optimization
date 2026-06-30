<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Android SDK Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

This is the native Android reference implementation for the
[Contentful Optimization Android SDK](../../packages/android/README.md). It demonstrates the
integration pattern for both Jetpack Compose (`:compose`) and XML Views (`:views`), and is the
target for the shared [Maestro](https://maestro.dev) E2E suite (see
[`maestro/README.md`](./maestro/README.md)).

## What this demonstrates

- `OptimizationRoot` initialization with mock server configuration
- `OptimizedEntry` personalization with view and click tracking
- Nested entry resolution and recursive rendering
- Navigation with screen tracking via `ScreenTrackingEffect`
- Live updates behavior: default (global), explicit live, and locked variants
- `PreviewPanelConfig` preview panel with audience/variant override controls
- Analytics event display for debugging tracked events
- All accessibility identifiers aligned with the iOS SwiftUI implementation for cross-platform E2E
  parity

## CDA locale handling

The app defines one locale in shared config, passes it to the native SDK as top-level `locale`, and
passes it directly to the raw CDA fetch helper. Entries passed to `OptimizedEntry` use the standard
single-locale CDA entry shape. Do not use all-locale CDA responses or `locale=*`, because SDK entry
resolution expects direct single-locale fields such as `fields.nt_experiences` and
`fields.nt_variants`. See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract.

This mock app uses one Contentful locale. A production app can derive the application locale from
its own navigation, i18n, or account-preference layer and pass that value to both SDK `locale` and
CDA requests when they should stay aligned.

## Prerequisites

- Android SDK with `ANDROID_HOME` set
- Android emulator or connected device
- `adb` in PATH
- pnpm dependencies installed at monorepo root (`pnpm install`)
- Android bridge built: `pnpm --filter @contentful/optimization-js-bridge build`

## Setup

From the monorepo root:

```sh
pnpm install
pnpm --filter @contentful/optimization-js-bridge build
```

This implementation does not use a local `.env` file. Mock API settings live in the Android app
configuration and point emulator traffic to the host mock server through `http://10.0.2.2:8000`.

## Running locally

The bootstrap script starts the mock server, builds the app, and launches it on an emulator:

```sh
cd implementations/android-sdk
./scripts/bootstrap.sh
```

Or manually:

```sh
# Terminal 1: Start mock server
pnpm serve:mocks

# Terminal 2: Build and install (the app reaches the host mock via 10.0.2.2 — no adb reverse needed)
cd implementations/android-sdk
./gradlew :compose:assembleDebug
adb install -r compose/build/outputs/apk/debug/compose-debug.apk
adb shell am start -n com.contentful.optimization.app/.MainActivity
```

To launch with a clean SDK state (clears the persisted profile on cold start):

```sh
adb shell am start -n com.contentful.optimization.app/.MainActivity --ez reset true
```

## Running E2E tests

The E2E suite uses [Maestro](https://maestro.dev). Prefer the monorepo-root wrappers or local
runner; they start the mock server, resolve or launch an emulator, build/install the app, and run
the flow suite.

Run both Compose and XML Views apps:

```sh
pnpm implementation:run -- android-sdk test:e2e
```

Run one app shell:

```sh
pnpm implementation:run -- android-sdk test:e2e:compose
pnpm implementation:run -- android-sdk test:e2e:views
```

Run one Maestro suite:

```sh
pnpm implementation:run -- android-sdk test:e2e:compose -- --flow preview-panel
```

From `implementations/android-sdk/`, the equivalent Compose-only local runner is:

```sh
APP_PACKAGE=com.contentful.optimization.app ./scripts/run-e2e.sh --flow preview-panel
```

Omit `APP_PACKAGE` to run the same suite against both Compose and XML Views.

See [`scripts/README.md`](./scripts/README.md) for emulator, AVD, and environment-variable details.

## Android Studio

Open this directory (`implementations/android-sdk/`) as an Android Studio project. After Gradle
sync, build and launch either app on the selected device (`MainActivity` in `:compose` or `:views`),
set breakpoints in the app or SDK source, and run the JVM unit tests from the gutter.

Before running the app from the IDE, in a separate terminal:

```sh
# From the monorepo root, build the bridge once (or after bridge source changes):
pnpm --filter @contentful/optimization-js-bridge build

# Then start the mock server and leave it running:
pnpm --dir lib/mocks serve
```

The E2E suite is run from the command line rather than an IDE run configuration; see
[`maestro/README.md`](./maestro/README.md) for flow structure.

## Maintainer edit loop

Use this app when you need a debuggable native Android surface for changes in
`packages/android/ContentfulOptimization` or the shared JS bridge. The Gradle project includes the
SDK module from the workspace as an included Gradle subproject, so app builds compile the Kotlin
source and package the local bridge asset rather than a published AAR.

The normal loop is:

1. Edit Kotlin in `packages/android/ContentfulOptimization/src/main/kotlin/...` or bridge TypeScript
   in `packages/universal/optimization-js-bridge/src/...`.
2. Build the changed app or both app shells from `implementations/android-sdk/`:

   ```sh
   ./gradlew :compose:assembleDebug :views:assembleDebug
   ```

3. Run the Compose or Views app locally, then validate with the matching Maestro flow.

If bridge source changed, rebuild the bridge before treating app results as meaningful:

```sh
pnpm --filter @contentful/optimization-js-bridge build
```

## Maintainer validation

Run the smallest check that covers the changed surface:

| Change area                       | Suggested validation                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bridge TypeScript only            | `pnpm --filter @contentful/optimization-js-bridge typecheck` and `pnpm --filter @contentful/optimization-js-bridge build`                                |
| Kotlin SDK or UI adapter behavior | `./gradlew :compose:assembleDebug :views:assembleDebug`                                                                                                  |
| Compose or Views user flow        | `pnpm implementation:run -- android-sdk test:e2e:compose -- --flow <suite>` or `pnpm implementation:run -- android-sdk test:e2e:views -- --flow <suite>` |
| Shared preview-panel behavior     | Run the affected Maestro suite against both apps                                                                                                         |
| Documentation-only README changes | Prettier on touched Markdown and `git diff --check`                                                                                                      |

Common local pitfalls:

- Keep the Compose and Views apps in lock-step. New screens, controls, and test identifiers must
  exist in both app shells.
- The apps reach the host mock through `http://10.0.2.2:8000`; no manual `adb reverse` setup is
  required for normal local runs.
- The old UiAutomator module is dormant. Add or update Maestro flows instead.
- After switching branches, force a bridge rebuild if the copied Android UMD asset may not match the
  checked-out bridge source.
- If an E2E regression appears in only one app shell, check app test-tag parity before changing SDK
  behavior.

## Related

- [Optimization Android SDK](../../packages/android/README.md) - Native Android SDK package
- [Native bridge architecture](../../packages/universal/optimization-js-bridge/BRIDGE_ARCHITECTURE.md) -
  Shared bridge runtime and build notes
- [iOS reference app](../ios-sdk/README.md) - Native iOS reference app
- [React Native reference implementation](../react-native-sdk/README.md) - React Native reference
  implementation
- [Preview panel scenario contract](../PREVIEW_PANEL_SCENARIOS.md) - Cross-platform preview-panel
  scenario source of truth
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
