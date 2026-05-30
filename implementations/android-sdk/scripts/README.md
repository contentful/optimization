# Android reference app scripts

Developer helper scripts for the Android reference implementation. They wrap the Gradle + `adb` +
emulator workflow so you can go from a clean checkout to a running app or a green E2E run with a
single command.

> [!NOTE]
>
> These scripts forward the mock server into the emulator with `adb reverse tcp:8000 tcp:8000` so
> the app can reach `http://localhost:8000`.

## Scripts

| Script           | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `bootstrap.sh`   | Build, install, and launch the app on an emulator for local dev      |
| `run-e2e.sh`     | Build, install, and run the UI Automator 2 instrumented E2E suite    |
| `prepare-env.sh` | Validate the local environment without starting anything (fast fail) |

## Prerequisites

- Android SDK installed with `ANDROID_HOME` set, and `adb` on `PATH`.
- pnpm dependencies installed at the monorepo root (`pnpm install`).
- The JS bridge built: `pnpm --filter @contentful/optimization-js-bridge build` (`bootstrap.sh` and
  `run-e2e.sh` build it for you unless `SKIP_BUILD=true`).

If no device or emulator is connected, `bootstrap.sh` starts an existing AVD (or creates a Pixel 7
API 35 AVD as a last resort), and `run-e2e.sh` auto-launches a visible emulator pinned to the
CI-aligned AVD `pixel_7_api35_e2e`.

## `bootstrap.sh`

Ensures a device is available, starts the mock server, sets up `adb reverse`, builds and installs
the app, and launches it. The mock server keeps running in the foreground (press `Ctrl+C` to stop it
and exit).

```sh
cd implementations/android-sdk
./scripts/bootstrap.sh
```

## `run-e2e.sh`

Ensures a visible emulator, starts the mock server, sets up `adb reverse`, builds and installs the
app and test APKs, then runs the UI Automator 2 instrumented suite. Logs are written to
`implementations/android-sdk/logs/` (`mock-server.log`, `test-results.log`).

```sh
cd implementations/android-sdk
./scripts/run-e2e.sh
```

Run a single test class or method:

```sh
./scripts/run-e2e.sh --test-class AnalyticsTests
./scripts/run-e2e.sh --test-class AnalyticsTests --test-method testTracksComponentImpressionEventsForVisibleEntries
```

Skip the build and reuse the installed APKs:

```sh
./scripts/run-e2e.sh --skip-build
```

Run `./scripts/run-e2e.sh --help` for the full option list.

## `prepare-env.sh`

Read-only validation: checks that the mock server is reachable, the bridge bundle is built, a device
is connected, and sets up `adb reverse`. It starts nothing, so it fails fast with a clear message.
It is wired in as a "Before launch" step for the **App** and **All UI Tests** run configurations in
Android Studio.

```sh
cd implementations/android-sdk
./scripts/prepare-env.sh
```

## Environment variables

| Variable                      | Default             | `bootstrap.sh` | `run-e2e.sh` | `prepare-env.sh` | Notes                                                    |
| ----------------------------- | ------------------- | :------------: | :----------: | :--------------: | -------------------------------------------------------- |
| `MOCK_SERVER_PORT`            | `8000`              |       ✅       |      ✅      |        ✅        | Port for the mock API server.                            |
| `SKIP_BUILD`                  | `false`             |       ✅       |      ✅      |        —         | Reuse the existing build instead of rebuilding.          |
| `EMULATOR_AVD`                | `pixel_7_api35_e2e` |       —        |      ✅      |        —         | AVD to require/auto-launch; pinned to match CI.          |
| `DISABLE_EMULATOR_ANIMATIONS` | `true`              |       —        |      ✅      |        —         | Set `false` to keep emulator animation scales unchanged. |
| `FAIL_FAST`                   | `true`              |       —        |      ✅      |        —         | Set `false` to run the whole suite even after a failure. |
| `STREAM_BACKGROUND_LOGS`      | `false`             |       —        |      ✅      |        —         | Set `true` to stream mock server logs to stdout.         |
| `CI`                          | `false`             |       —        |      ✅      |        —         | Set `true` for CI mode.                                  |

## Related

- [Android reference app README](../README.md)
- [iOS reference app scripts](../../ios-sdk/scripts/README.md)
- [Mock server](../../../lib/mocks/README.md)
