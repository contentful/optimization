<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../documentation/assets/contentful-logo-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="../../documentation/assets/contentful-logo-light.png" />
    <img width="300" alt="Contentful" src="../../documentation/assets/contentful-logo-light.png" />
  </picture>

### Contentful Personalization & Analytics

<h3>Android SDK Reference Implementation</h3>

[Readme](./README.md) · [Guides](https://contentful.github.io/optimization/documents/Guides.html) ·
[Reference](https://contentful.github.io/optimization/) · [Contributing](../../CONTRIBUTING.md)

</div>

---

> [!CAUTION] Pre-release. API surface is not yet stable.

This is the native Android reference implementation for the
[Contentful Optimization Android SDK](../../packages/android/README.md). It demonstrates the minimal
integration pattern using Jetpack Compose and serves as a test target for UI Automator 2 E2E tests.

## What this demonstrates

- `OptimizationRoot` initialization with mock server configuration
- `OptimizedEntry` personalization with view and click tracking
- Nested entry resolution and recursive rendering
- Navigation with screen tracking via `ScreenTrackingEffect`
- Live updates behavior: default (global), explicit live, and locked variants
- `PreviewPanelOverlay` with audience/variant override controls
- Analytics event display for debugging tracked events
- All accessibility identifiers aligned with the iOS SwiftUI implementation for cross-platform E2E
  parity

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

# Terminal 2: Build and install
cd implementations/android-sdk
adb reverse tcp:8000 tcp:8000
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.contentful.optimization.app/.MainActivity
```

To launch with test arguments (clear state or simulate offline):

```sh
adb shell am start -n com.contentful.optimization.app/.MainActivity --ez reset true
adb shell am start -n com.contentful.optimization.app/.MainActivity --ez simulate_offline true
```

## Android Studio

Open this directory (`implementations/android-sdk/`) as an Android Studio project. After Gradle
sync, three run configurations are available in the toolbar dropdown:

- **App** — builds and launches `MainActivity` on the selected device.
- **All UI Tests** — runs the full UI Automator 2 instrumented suite.
- **Prepare Env** — standalone check that the mock server is reachable, the bridge JS bundle is
  built, and `adb reverse` is set up.

**App** and **All UI Tests** both run **Prepare Env** as a "Before launch" step, so the run will
fail fast with instructions if the mock server is not up or the bridge bundle has not been built.

Before running anything from the IDE, in a separate terminal:

```sh
# From the monorepo root, build the bridge once (or after bridge source changes):
pnpm --filter @contentful/optimization-js-bridge build

# Then start the mock server and leave it running:
pnpm --dir lib/mocks serve
```

To run or debug a single test, open any file under
`uitests/src/main/kotlin/com/contentful/optimization/uitests/tests/`, right-click a `@Test` method
or class, and choose **Run** or **Debug**. Android Studio creates a temporary instrumented-test
configuration and attaches the debugger automatically. Set breakpoints in test or production code —
they will be hit on the device. Note that ad-hoc gutter runs skip the **Prepare Env** check, so make
sure the mock server is running first (running **Prepare Env** once per session is enough as long as
`adb reverse` survives).

## Related

- [Android SDK](../../packages/android/README.md)
- [iOS SDK Reference Implementation](../ios-sdk/README.md)
- [React Native Reference Implementation](../react-native-sdk/README.md)
- [Preview Panel Scenarios](../PREVIEW_PANEL_SCENARIOS.md)
- [Mock Server](../../lib/mocks/README.md)
