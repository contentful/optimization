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
> The Optimization React Native SDK is in beta. Breaking changes can be published at any time.

This is a reference implementation for the
[Optimization React Native SDK](../../packages/react-native-sdk/README.md) and is part of the
[Contentful Optimization SDK Suite](../../README.md).

## What this demonstrates

Use this implementation when you need an end-to-end React Native example for Android and iOS app
targets. It demonstrates SDK initialization, optimized entry rendering, interaction tracking,
navigation/screen tracking, offline behavior, preview-panel scenarios, and Detox E2E coverage.

## CDA locale handling

The app defines one locale in `env.config.ts`, passes it to the React Native SDK as top-level
`locale`, and passes it directly to Contentful CDA entry fetches. Do not use `contentful.js`
`withAllLocales` or raw CDA `locale=*` for entries passed to `OptimizedEntry`; SDK entry resolution
expects direct single-locale fields such as `fields.nt_experiences` and `fields.nt_variants`. See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract.

## Prerequisites

- Node.js >= 20.19.0 (24.15.0 recommended to match `.nvmrc`)
- pnpm
- Android SDK, `adb`, and at least one configured Android emulator for Android Detox flows. The
  one-shot runner and Detox can launch a configured emulator; it does not need to be running before
  you start the flow.
- Xcode with an iOS Simulator available for iOS Detox flows

## Setup

Run all steps from the monorepo root.

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

4. Create the local `.env` file if it does not already exist:

   ```sh
   test -f implementations/react-native-sdk/.env || cp implementations/react-native-sdk/.env.example implementations/react-native-sdk/.env
   ```

   The `.env.example` values are mock-safe defaults. Android rewrites localhost URLs to the emulator
   host alias in `env.config.ts`; iOS Simulator uses the host network directly.

See `implementations/react-native-sdk/package.json` for more commands.

## Running locally

Run these commands from the monorepo root.

1. Start the mock API server:

   ```sh
   pnpm implementation:run -- react-native-sdk serve:mocks
   ```

2. In another terminal, start Metro:

   ```sh
   pnpm implementation:run -- react-native-sdk start
   ```

3. In a third terminal, install and launch the Android app or iOS app:

   ```sh
   pnpm implementation:run -- react-native-sdk android
   pnpm implementation:run -- react-native-sdk ios
   ```

Use the one-shot E2E runner when you need automatic mock server, Metro, Android emulator, adb
reverse, build, and cleanup orchestration.

## Running E2E tests

Android E2E tests use Detox. Run these commands from the monorepo root.

1. Run the full root setup and E2E wrapper:

   ```sh
   pnpm setup:e2e:react-native-sdk
   pnpm test:e2e:react-native-sdk
   ```

2. Run the preferred targeted local Android E2E flow:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:android:full
   ```

3. Build Android Detox binaries:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:android:build
   ```

4. Run Android Detox tests only:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:android:run
   ```

5. Pass script arguments through to the one-shot runner:

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

6. Useful one-shot variants:

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

7. Run iOS Detox commands when needed:

   ```sh
   pnpm implementation:run -- react-native-sdk test:e2e:ios:build
   pnpm implementation:run -- react-native-sdk test:e2e:ios:run
   ```

## Increasing E2E logging

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
