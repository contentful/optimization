<div align="center">
  <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">

### Contentful Personalization & Analytics

<h3>Android SDK Reference Implementation</h3>

[Readme](./README.md) · [Guides](https://contentful.github.io/optimization/documents/Guides.html) ·
[Reference](https://contentful.github.io/optimization/) · [Contributing](../../CONTRIBUTING.md)

</div>

---

> [!CAUTION] Pre-release. API surface is not yet stable.

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

The app configures native SDK `contentfulLocales` and an app/content `locale`, then uses
`client.locale` in the raw CDA fetch helper. Experience API calls use that resolved locale by
default unless nested `api.locale` is configured as an explicit API override. Entries passed to
`OptimizedEntry` use the standard single-locale CDA entry shape. Do not use all-locale CDA responses
or `locale=*`, because SDK entry resolution expects direct single-locale fields such as
`fields.nt_experiences` and `fields.nt_variants`. See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract.

This mock app uses one Contentful locale, so `ContentfulLocales(default = "en-US")` is enough. Add
`supported` only when a production app needs device-locale matching across multiple Contentful
locales.

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

The E2E suite is [Maestro](https://maestro.dev), run from the command line rather than an IDE run
configuration — `pnpm test:e2e` (both apps) or see [`maestro/README.md`](./maestro/README.md).

## Maintainer edit loop

Use this app when you need a debuggable native Android surface for changes in
`packages/android/ContentfulOptimization` or the shared JS bridge. The Gradle project includes the
SDK module from the workspace through a composite build, so app builds compile the Kotlin source and
package the local bridge asset rather than a published AAR.

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

| Change area                       | Suggested validation                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Bridge TypeScript only            | `pnpm --filter @contentful/optimization-js-bridge typecheck` and `pnpm --filter @contentful/optimization-js-bridge build` |
| Kotlin SDK or UI adapter behavior | `./gradlew :compose:assembleDebug :views:assembleDebug`                                                                   |
| Compose or Views user flow        | `pnpm test:e2e:compose -- --flow <suite>` or `pnpm test:e2e:views -- --flow <suite>`                                      |
| Shared preview-panel behavior     | Run the affected Maestro suite against both apps                                                                          |
| Documentation-only README changes | Prettier on touched Markdown and `git diff --check`                                                                       |

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

- [Android SDK](../../packages/android/README.md)
- [Native bridge architecture](../../packages/universal/optimization-js-bridge/BRIDGE_ARCHITECTURE.md)
- [iOS SDK Reference Implementation](../ios-sdk/README.md)
- [React Native Reference Implementation](../react-native-sdk/README.md)
- [Preview Panel Scenarios](../PREVIEW_PANEL_SCENARIOS.md)
- [Mock Server](../../lib/mocks/README.md)
