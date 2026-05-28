# Contributing to the Android SDK

Use this guide when you want to work on the native Android SDK
([`packages/android/ContentfulOptimization`](../../packages/android/ContentfulOptimization)) or the
shared JS bridge
([`packages/universal/optimization-js-bridge`](../../packages/universal/optimization-js-bridge)) and
validate your changes in the reference app at
[`implementations/android-sdk/`](../../implementations/android-sdk/). For an explanation of how the
bridge works at runtime, read
[Native mobile SDK architecture](../concepts/native-mobile-sdk-architecture.md) and
[Android SDK bridge](../concepts/android-sdk-bridge.md) first.

<details>
  <summary>Table of Contents</summary>

- [1. Prerequisites](#1-prerequisites)
- [2. Fresh-clone bootstrap](#2-fresh-clone-bootstrap)
- [3. How the IDE build chain wires together](#3-how-the-ide-build-chain-wires-together)
- [4. The daily edit loop](#4-the-daily-edit-loop)
- [5. Running the reference app](#5-running-the-reference-app)
- [6. Validation cheatsheet](#6-validation-cheatsheet)
- [7. Common pitfalls](#7-common-pitfalls)

</details>

## 1. Prerequisites

- The Node version pinned in [`.nvmrc`](../../.nvmrc) at the repo root.
- `pnpm` (the pinned `packageManager` version is in the root [`package.json`](../../package.json);
  install via Corepack).
- Android Studio (any recent stable release) with the Android SDK platform tools installed.
- `JAVA_HOME` pointing at a JDK 17+ (AGP 8.7 requires it).
- `ANDROID_HOME` exported and `adb` on `PATH`. An emulator image or a connected device.

## 2. Fresh-clone bootstrap

From the repository root:

```sh
pnpm install
pnpm build:pkgs
```

`pnpm build:pkgs` builds every workspace package, including `@contentful/optimization-js-bridge`.
Its `postbuild` script copies the freshly built `optimization-android-bridge.umd.js` into
`packages/android/ContentfulOptimization/src/main/assets/`, which is where
`AssetManager.open("optimization-android-bridge.umd.js")` expects to find it at runtime.

Then open the reference impl in Android Studio:

```sh
cd implementations/android-sdk
# Either launch Android Studio with this directory, or use the bootstrap script:
./scripts/bootstrap.sh
```

`./scripts/bootstrap.sh` is the one-shot path: it starts the mock server, runs
`./gradlew :app:assembleDebug`, installs the APK, and launches `MainActivity` on the connected
device or emulator.

To open in the IDE instead: launch Android Studio → **Open** → `implementations/android-sdk/` and
let Gradle sync. Three run configurations appear in the toolbar once sync completes: **App**, **All
UI Tests**, **Prepare Env**.

## 3. How the IDE build chain wires together

The reference impl wires the SDK module as a Gradle composite-build local module:

```kotlin
// implementations/android-sdk/settings.gradle.kts
include(":ContentfulOptimization")
project(":ContentfulOptimization").projectDir =
    file("../../packages/android/ContentfulOptimization")
```

`:app` depends on `project(":ContentfulOptimization")`, so a Gradle build of `:app` rebuilds the SDK
module from source as a transitive task. There is no published AAR involved.

For the JS bridge,
[`packages/android/ContentfulOptimization/build.gradle.kts`](../../packages/android/ContentfulOptimization/build.gradle.kts)
registers a `buildJsBridge` task that invokes
`pnpm --filter @contentful/optimization-js-bridge build` and wires it as a dependency of `preBuild`:

```kotlin
val buildJsBridge = tasks.register<Exec>("buildJsBridge") {
    workingDir = rootProject.projectDir.resolve("../..")
    commandLine("pnpm", "--filter", "@contentful/optimization-js-bridge", "build")
    inputs.dir(rootProject.projectDir.resolve("../../packages/universal/optimization-js-bridge/src"))
    outputs.file(layout.projectDirectory.file("src/main/assets/optimization-android-bridge.umd.js"))
}
tasks.named("preBuild").configure { dependsOn(buildJsBridge) }
```

The `inputs` / `outputs` declarations are load-bearing. With them, Gradle's up-to-date check skips
the task when the asset is already newer than the bridge source — so a no-op rebuild reports
`:ContentfulOptimization:buildJsBridge UP-TO-DATE` rather than re-running pnpm on every build.

The end-state is: edit Kotlin in `packages/android/...` **or** TypeScript in
`packages/universal/optimization-js-bridge/src/`, run **App** in Android Studio (or
`./gradlew :app:assembleDebug` from the impl directory), and both layers pick up the change without
any manual pnpm or asset-copy step.

## 4. The daily edit loop

1. Make your change in `packages/android/ContentfulOptimization/src/main/kotlin/...` (Kotlin) or
   `packages/universal/optimization-js-bridge/src/...` (TypeScript).
2. From Android Studio, run **App** (or **All UI Tests**). Gradle rebuilds the SDK module; the
   `buildJsBridge` task regenerates the UMD asset only when TS sources changed.
3. Validate with the targeted UI Automator test or app flow (see § 6).

From the command line:

```sh
cd implementations/android-sdk
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.contentful.optimization.app/.MainActivity
```

## 5. Running the reference app

Before launching, start the mock server from the repo root **and** forward the port to the
emulator/device:

```sh
# Terminal 1 (repo root):
pnpm serve:mocks

# Terminal 2 (anywhere):
adb reverse tcp:8000 tcp:8000
```

Then run **App** from Android Studio, or use the bootstrap path:

```sh
cd implementations/android-sdk
./scripts/bootstrap.sh
```

`./scripts/bootstrap.sh` handles `adb reverse`, the gradle assemble, the install, and the launch in
one step.

To run the full UI Automator 2 suite from the command line:

```sh
./gradlew :uitests:connectedAndroidTest
```

A single test class:

```sh
./gradlew :uitests:connectedAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=com.contentful.optimization.uitests.tests.AnalyticsTests
```

Keep `testTag` values and `contentDescription`-based identifiers in sync with the iOS XCUITest suite
— see
[`implementations/PREVIEW_PANEL_SCENARIOS.md`](../../implementations/PREVIEW_PANEL_SCENARIOS.md) and
[`implementations/android-sdk/AGENTS.md`](../../implementations/android-sdk/AGENTS.md) for the
contract.

## 6. Validation cheatsheet

Repo-wide checks (run from the repo root):

| Command              | What it covers                                            |
| -------------------- | --------------------------------------------------------- |
| `pnpm lint`          | ESLint for `lib/` and `packages/`.                        |
| `pnpm typecheck`     | `tsc --noEmit` across every workspace package.            |
| `pnpm test:unit`     | Unit tests for `lib/` and the `@contentful/*` packages.   |
| `pnpm format:check`  | Prettier check on the entire repo.                        |
| `pnpm size:check`    | Bundle size budgets for built artifacts.                  |
| `pnpm docs:generate` | TypeDoc, which also picks up `documentation/**` markdown. |

Impl-side checks:

| Command                                  | What it covers                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm implementation:lint`               | ESLint across reference implementations.                                      |
| `./gradlew :app:lint`                    | Android Lint against the reference app (from `implementations/android-sdk/`). |
| `./gradlew :ContentfulOptimization:lint` | Android Lint against the SDK module.                                          |

For a change that only edits TypeScript bridge source,
`pnpm lint && pnpm typecheck && pnpm test:unit` is the right minimum. For Kotlin changes that touch
the SDK module, add `./gradlew :ContentfulOptimization:assembleDebug` (and a targeted UI Automator
scenario when the change is observable through the app).

## 7. Common pitfalls

- **`pnpm` not on Gradle's `PATH`** — Android Studio inherits its environment from the shell that
  launched it. If `buildJsBridge` fails with `command not found`, launch Android Studio from a shell
  where `pnpm --version` works, or symlink the binary into a standard location (e.g.
  `sudo ln -s "$(which pnpm)" /usr/local/bin/pnpm`). Restart the IDE after.
- **Stale bridge bundle after a `git checkout` between branches** — the `inputs`/`outputs` check is
  mtime-based. After a branch switch that touches bridge source, run
  `pnpm --filter @contentful/optimization-js-bridge build` once, or
  `touch packages/universal/optimization-js-bridge/src/index.ts` so the next Gradle build re-runs
  `buildJsBridge`.
- **`__bridge not found after bundle evaluation`** — the Android asset is missing or empty. Most
  likely cause: a failed bridge build left an empty `dist/` and the `postbuild` copy never ran.
  Rerun the bridge build and inspect output. The reference app's **Prepare Env** run configuration
  also checks for this and fails fast.
- **Mock server unreachable** — the app expects `http://localhost:8000` and the emulator routes that
  to the host via `adb reverse tcp:8000 tcp:8000`. After an emulator restart you must re-run
  `adb reverse`.
- **AGP / Gradle JDK mismatch** — AGP 8.7.3 (pinned in
  [`implementations/android-sdk/build.gradle.kts`](../../implementations/android-sdk/build.gradle.kts))
  needs JDK 17+. In Android Studio: **Settings → Build, Execution, Deployment → Build Tools → Gradle
  → Gradle JDK**.

## Related

- [Native mobile SDK architecture](../concepts/native-mobile-sdk-architecture.md)
- [Android SDK bridge](../concepts/android-sdk-bridge.md)
- [Android reference implementation README](../../implementations/android-sdk/README.md)
- [`packages/android` README](../../packages/android/README.md)
- [Contributing to the iOS SDK](./contributing-to-the-ios-sdk.md)
