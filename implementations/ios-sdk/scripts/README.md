# iOS reference app scripts

Developer helper scripts for the iOS reference implementation. They wrap the XcodeGen +
`xcodebuild` + `simctl` workflow so you can go from a clean checkout to a running app or a green E2E
run with a single command.

> [!NOTE]
>
> These scripts only run on macOS with Xcode. They reach the mock server at `http://localhost:8000`;
> unlike the Android scripts, no port forwarding is needed because the iOS Simulator shares the host
> network.

## Scripts

| Script         | Purpose                                                           |
| -------------- | ----------------------------------------------------------------- |
| `bootstrap.sh` | Configure, build, and launch the app on a simulator for local dev |
| `run-e2e.sh`   | Run the XCUITest E2E suite against one or both app shells         |

Both scripts run the same preflight checks first and stop with explicit remediation steps if
anything is missing, before building or running anything.

## Preflight checks

Both scripts verify, in order:

1. The host is macOS.
2. The Xcode Command Line Tools are installed (`xcode-select -p`).
3. A full Xcode install is selected and its license is accepted (`xcodebuild -version`).
4. An iOS Simulator runtime with at least one iPhone is available.
5. Node.js and pnpm are on `PATH`.
6. XcodeGen is installed — auto-installed via Homebrew if missing.

If a check fails, the script prints the exact command to fix it (for example
`xcode-select --install`, or installing Xcode from the App Store and running
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`) and exits without building.

## `bootstrap.sh`

Runs preflight, then configures, builds, and launches the app. When it finishes it leaves a
simulator booted with the reference app and the mock server running in the foreground (press
`Ctrl+C` to stop the mock server and exit).

```sh
cd implementations/ios-sdk
./scripts/bootstrap.sh
```

## `run-e2e.sh`

Runs preflight, starts the mock server, resolves a simulator, and runs the XCUITest suite via
`xcodebuild test`. Result bundles are written to `implementations/ios-sdk/logs/<scheme>.xcresult`.

```sh
cd implementations/ios-sdk
./scripts/run-e2e.sh
```

Run a single test class against the SwiftUI shell:

```sh
ONLY_TESTING=OptimizationAppUITestsSwiftUI/PreviewPanelOverridesTests \
  ./scripts/run-e2e.sh
```

Run the full suite against both shells:

```sh
APP_SHELL=both ./scripts/run-e2e.sh
```

## Environment variables

| Variable           | Default     | `bootstrap.sh` | `run-e2e.sh` | Notes                                                                                    |
| ------------------ | ----------- | :------------: | :----------: | ---------------------------------------------------------------------------------------- |
| `APP_SHELL`        | `swiftui`   |       ✅       |      ✅      | `swiftui` or `uikit`. `run-e2e.sh` also accepts `both`.                                  |
| `IOS_SIM_NAME`     | `iPhone 16` |       ✅       |      ✅      | Simulator device name; falls back to the first available iPhone if absent.               |
| `MOCK_SERVER_PORT` | `8000`      |       ✅       |      ✅      | The app is hardcoded to `localhost:8000`; override only if you also edit `Config.swift`. |
| `SKIP_BUILD`       | `false`     |       ✅       |      ✅      | `bootstrap.sh` reuses the last build; `run-e2e.sh` runs `test-without-building`.         |
| `ONLY_TESTING`     | _(unset)_   |       —        |      ✅      | Restrict the run to a target/class/method, e.g. `OptimizationAppUITestsSwiftUI/...`.     |

## Related

- [iOS reference app README](../README.md)
- [Android reference app scripts](../../android-sdk/scripts/README.md)
- [Mock server](../../../lib/mocks/README.md)
