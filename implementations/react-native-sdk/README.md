<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">React Native Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

This is a reference implementation for the
[Optimization React Native SDK](../../packages/react-native-sdk/README.md) and is part of the
[Contentful Optimization SDK Suite](../../README.md).

## What This Demonstrates

Use this implementation when you need an end-to-end React Native example for Android and iOS app
targets. It demonstrates SDK initialization, optimized entry rendering, interaction tracking,
navigation/screen tracking, offline behavior, preview-panel scenarios, and Detox E2E coverage.

## Prerequisites

- Node.js >= 20.19.0 (24.13.0 recommended to match `.nvmrc`)
- pnpm 10.x
- An Android emulator available and running for Android Detox flows
- Xcode with an iOS Simulator available for iOS Detox flows

## Setup

All steps should be run from the monorepo root.

1. Install pnpm packages:

   ```sh
   pnpm install
   ```

2. Build and package SDK tarballs used by this implementation:

   ```sh
   pnpm build:pkgs
   ```

3. Install implementation dependencies:

   ```sh
   pnpm implementation:run -- react-native-sdk implementation:install
   ```

See `implementations/react-native-sdk/package.json` for more commands.

## Running E2E Tests

Android E2E tests use Detox. Run these commands from the monorepo root.

1. Run the full Android E2E flow:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:android:full
   ```

2. Build Android Detox binaries:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:android:build
   ```

3. Run Android Detox tests only:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:android:run
   ```

4. Pass script arguments through to the one-shot runner:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:android:full -- --test-file e2e/offline-behavior.test.js
   ```

   The one-shot Android command:
   - creates `.env` from `.env.example` for E2E
   - starts the mock server and Metro
   - configures adb reverse
   - builds the Android app (unless skipped)
   - runs Detox tests
   - cleans up background processes

5. Useful one-shot variants:

   Skip rebuild if the app is already built:

   ```sh
   SKIP_BUILD=true pnpm implementation:run -- react-native-sdk test:e2e:android:full
   ```

   Run one test file:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:android:full -- --test-file e2e/offline-behavior.test.js
   ```

   Run tests matching a name pattern:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:android:full -- -t "should recover gracefully when network is restored"
   ```

6. Run iOS Detox commands when needed:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:ios:build
   pnpm implementation:run -- react-native-sdk test:e2e:ios:run
   ```

## Increasing E2E Logging

Local Android E2E logging is intentionally minimal by default.

1. Enable script/service logs (Metro, mock server, and adb logcat stream):

   ```sh
   STREAM_BACKGROUND_LOGS=true ENABLE_DEVICE_LOGCAT=true METRO_VERBOSE=true pnpm implementation:run -- react-native-sdk test:e2e:android:full
   ```

2. Increase Detox runner logging and artifacts:

   ```sh
   pnpm --dir implementations/react-native-sdk --ignore-workspace exec detox test --configuration android.emu.debug --loglevel trace --record-logs all --take-screenshots failing --record-videos failing
   ```

3. Read generated logs:
   - `implementations/react-native-sdk/logs/mock-server.log`
   - `implementations/react-native-sdk/logs/metro.log`
   - `implementations/react-native-sdk/logs/device.log`
   - `implementations/react-native-sdk/logs/test-results.log`

## Related

- [@contentful/optimization-react-native](../../packages/react-native-sdk/README.md) - React Native
  SDK package
- [React Native SDK package-local dev dashboard](../../packages/react-native-sdk/dev/README.md) -
  Interactive development harness
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
