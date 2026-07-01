# Android reference app scripts

Developer helper scripts for the Android reference implementation. They wrap the Gradle + `adb` +
emulator workflow so you can go from a clean checkout to a running app or a green E2E run with a
single command.

> [!NOTE]
>
> The apps reach the host mock server through the emulator host alias `http://10.0.2.2:8000`.
> `run-e2e.sh` still sets `adb reverse tcp:8000 tcp:8000` as a localhost fallback, then verifies the
> `10.0.2.2` path the apps actually use.

## Scripts

| Script           | Purpose                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `bootstrap.sh`   | Build, install, and launch the app on an emulator for local dev   |
| `run-e2e.sh`     | Build, install, and run the Maestro E2E flow suite                |
| `prepare-env.sh` | Check local prerequisites and configure `adb reverse` (fast fail) |

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

Ensures a visible emulator, starts the mock server, verifies the emulator can reach the host mock
through `10.0.2.2`, builds and installs the Compose and XML Views app APKs, then runs the shared
Maestro flow suite against both apps. Logs are written to `implementations/android-sdk/logs/`,
including `mock-server.log`.

```sh
cd implementations/android-sdk
./scripts/run-e2e.sh
```

Run one Maestro suite:

```sh
./scripts/run-e2e.sh --flow preview-panel
```

Run only the XML Views app:

```sh
APP_PACKAGE=com.contentful.optimization.app.views ./scripts/run-e2e.sh
```

Skip the build and reuse the installed APKs:

```sh
./scripts/run-e2e.sh --skip-build
```

Run `./scripts/run-e2e.sh --help` for the full option list.

The runner never launches a headless emulator. If it detects stale headless `qemu-system` emulator
processes, it terminates those processes and restarts adb so a fresh visible emulator can take the
device slot.

## `prepare-env.sh`

Pre-launch validation: checks that the mock server is reachable, the bridge bundle is built, a
device is connected, and sets up `adb reverse`. It starts no servers, emulators, or builds, so it
fails fast with a clear message. Run it manually before Android Studio app/test launches, or add it
as a "Before launch" step in local run configurations.

```sh
cd implementations/android-sdk
./scripts/prepare-env.sh
```

## Environment variables

| Variable                      | Default             | `bootstrap.sh` | `run-e2e.sh` | `prepare-env.sh` | Notes                                                              |
| ----------------------------- | ------------------- | :------------: | :----------: | :--------------: | ------------------------------------------------------------------ |
| `MOCK_SERVER_PORT`            | `8000`              |       ✅       |      ✅      |        ✅        | Port for the mock API server.                                      |
| `SKIP_BUILD`                  | `false`             |       ✅       |      ✅      |        —         | Reuse the existing build instead of rebuilding.                    |
| `EMULATOR_AVD`                | `pixel_7_api35_e2e` |       —        |      ✅      |        —         | AVD to require/auto-launch; pinned to match CI.                    |
| `APP_PACKAGE`                 | `all`               |       —        |      ✅      |        —         | `all`, `both`, or one app package such as the XML Views package.   |
| `MAESTRO_ITERATIONS`          | `1`                 |       —        |      ✅      |        —         | Repeat the full run to measure flakiness.                          |
| `MAESTRO_ATTEMPTS`            | `2`                 |       —        |      ✅      |        —         | Attempts per app suite before declaring failure. Set `1` for none. |
| `DISABLE_EMULATOR_ANIMATIONS` | `true`              |       —        |      ✅      |        —         | Set `false` to keep emulator animation scales unchanged.           |
| `STREAM_BACKGROUND_LOGS`      | `false`             |       —        |      ✅      |        —         | Set `true` to stream mock server logs to stdout.                   |
| `CI`                          | `false`             |       —        |      ✅      |        —         | Set `true` for CI mode.                                            |

## Related

- [Android reference app README](../README.md)
- [iOS reference app scripts](../../ios-sdk/scripts/README.md)
- [Mock server](../../../lib/mocks/README.md)
