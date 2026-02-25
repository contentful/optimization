<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">React Native Reference Implementation</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is currently ALPHA! Breaking changes may be published at any time.

This is a reference implementation for the
[Optimization React Native SDK](../../platforms/javascript/react-native/README.md) and is part of
the [Contentful Optimization SDK Suite](../../README.md).

## Setup

All steps should be run from the monorepo root.

1. Install pnpm packages:

   ```sh
   pnpm install
   ```

2. Build and package SDK tarballs used by this implementation:

   ```sh
   pnpm run build:pkgs
   ```

3. Install implementation dependencies:

   ```sh
   pnpm --dir implementations/react-native --ignore-workspace install --no-frozen-lockfile
   ```

4. Ensure an Android emulator is available and running.

See `implementations/react-native/package.json` for more commands.

## Running From Root Scripts

You can run this implementation from the monorepo root via the root `package.json` implementation
scripts.

1. Run the full Android E2E flow:

   ```sh
   pnpm run implementation:react-native -- test:e2e:android:full
   ```

2. Build Android Detox binaries:

   ```sh
   pnpm run implementation:react-native -- test:e2e:android:build
   ```

3. Run Android Detox tests only:

   ```sh
   pnpm run implementation:react-native -- test:e2e:android:run
   ```

4. Pass script arguments through to the one-shot runner:

   ```sh
   pnpm run implementation:react-native -- test:e2e:android:full -- --test-file e2e/offline-behavior.test.js
   ```

## Running E2E Tests

Android E2E tests use Detox.

1. Run the one-shot Android E2E flow:

   ```sh
   pnpm --dir implementations/react-native --ignore-workspace test:e2e:android:full
   ```

   This command:
   - creates `.env` from `.env.example` for E2E
   - starts the mock server and Metro
   - configures adb reverse
   - builds the Android app (unless skipped)
   - runs Detox tests
   - cleans up background processes

2. Useful one-shot variants:

   ```sh
   # Skip rebuild if app is already built
   SKIP_BUILD=true pnpm --dir implementations/react-native --ignore-workspace test:e2e:android:full

   # Run one test file
   pnpm --dir implementations/react-native --ignore-workspace test:e2e:android:full -- --test-file e2e/offline-behavior.test.js

   # Run tests matching a name pattern
   pnpm --dir implementations/react-native --ignore-workspace test:e2e:android:full -- -t "should recover gracefully when network is restored"
   ```

3. Run Detox steps manually if needed:

   ```sh
   pnpm --dir implementations/react-native --ignore-workspace test:e2e:android:build
   pnpm --dir implementations/react-native --ignore-workspace test:e2e:android:run
   ```

4. iOS commands:

   ```sh
   pnpm --dir implementations/react-native --ignore-workspace test:e2e:ios:build
   pnpm --dir implementations/react-native --ignore-workspace test:e2e:ios:run
   ```

## Increasing E2E Logging

Local Android E2E logging is intentionally minimal by default.

1. Enable script/service logs (Metro, mock server, and adb logcat stream):

   ```sh
   STREAM_BACKGROUND_LOGS=true ENABLE_DEVICE_LOGCAT=true METRO_VERBOSE=true pnpm --dir implementations/react-native --ignore-workspace test:e2e:android:full
   ```

2. Increase Detox runner logging and artifacts:

   ```sh
   pnpm --dir implementations/react-native --ignore-workspace exec detox test --configuration android.emu.debug --loglevel trace --record-logs all --take-screenshots failing --record-videos failing
   ```

3. Read generated logs:
   - `implementations/react-native/logs/mock-server.log`
   - `implementations/react-native/logs/metro.log`
   - `implementations/react-native/logs/device.log`
   - `implementations/react-native/logs/test-results.log`
