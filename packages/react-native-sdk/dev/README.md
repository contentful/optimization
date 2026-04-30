# React Native Dev Dashboard

Development application for testing the Contentful Optimization React Native SDK.

Use this harness when you need an interactive local app for the package under
`packages/react-native-sdk`. For the published SDK API surface, start with the package
[README](../README.md). For the separate reference implementation used by repo-level E2E flows, see
[`implementations/react-native-sdk`](../../../implementations/react-native-sdk/README.md).

## Quick Start

### One-Command Setup (Recommended)

From the `packages/react-native-sdk` directory:

Run iOS setup:

```sh
pnpm dev:setup:ios
```

Run Android setup:

```sh
pnpm dev:setup:android
```

Start only the mock server and Metro bundler:

```sh
pnpm dev:setup:servers
```

Or run the script directly:

```sh
./dev/scripts/run-dev-dashboard.sh --ios
./dev/scripts/run-dev-dashboard.sh --android
./dev/scripts/run-dev-dashboard.sh --no-app
./dev/scripts/run-dev-dashboard.sh --clean
./dev/scripts/run-dev-dashboard.sh --help
```

### What the Script Does

1. Checks all prerequisites (Node.js, pnpm, Watchman, Xcode/CocoaPods or Android SDK)
2. Installs workspace dependencies via `pnpm install`
3. Starts the mock API server on port 8000
4. Starts the Metro bundler on port 8081
5. For iOS: Installs CocoaPods
6. For Android: Sets up adb reverse port forwarding
7. Builds and launches the app (unless `--no-app` is specified)
8. Cleans up all background processes on exit (Ctrl+C)

### Logs

All logs are written to `packages/react-native-sdk/dev/logs/`:

- `mock-server.log`: Mock API server output
- `metro.log`: Metro bundler output

### Manual Setup

If you prefer to set things up manually:

#### 1. Install Dependencies

From the workspace root:

```sh
pnpm install
```

#### 2. Start the Mock Server

The dev app requires the mock server to be running. From the workspace root:

```sh
pnpm serve:mocks
```

This starts the mock server on `http://localhost:8000` with:

- **Experience API**: `http://localhost:8000/experience/`
- **Insights API**: `http://localhost:8000/insights/`
- **Contentful CDA**: `http://localhost:8000/contentful/`

#### 3. Install iOS Dependencies (iOS only)

```sh
cd packages/react-native-sdk/dev/ios
pod install --repo-update
cd ..
```

#### 4. Start Metro Bundler

From `packages/react-native-sdk`:

```sh
pnpm dev:start
```

Or with cache reset:

```sh
pnpm dev:start:clean
```

#### 5. Run the App

In a new terminal, from `packages/react-native-sdk`:

Run iOS:

```sh
pnpm dev:ios
```

Run Android:

```sh
pnpm dev:android
```

## Prerequisites

### Required

- **Node.js** >= 20.19.0 (`24.13.0` recommended to match `.nvmrc`)
- **pnpm** (workspace package manager)
- **Watchman** (recommended for file watching)
  ```sh
  brew install watchman
  ```

### For iOS Development

- **Xcode** with iOS Simulator
- **CocoaPods**
  ```sh
  sudo gem install cocoapods
  ```

### For Android Development

- **Android Studio** with emulator configured
- **ANDROID_HOME** environment variable set

## Troubleshooting

### "Failed to fetch entries" Error

This usually means the mock server isn't running. Make sure to start it:

```sh
pnpm serve:mocks
```

### Port Already in Use

First try to stop only the known development processes you started:

Stop Metro by exiting its terminal, or use the package clean start:

```sh
pnpm dev:start:clean
```

Inspect port owners before stopping anything manually:

```sh
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:8081 -sTCP:LISTEN
```

If a stale local process is definitely the dev dashboard or mock server, stop that process by PID
with `kill <pid>`. Avoid broad or forceful cleanup unless you have confirmed the process is safe to
terminate.

### Metro Bundler Issues

Reset the cache:

```sh
pnpm dev:start:clean
```

### iOS Build Issues

Clean and reinstall pods:

```sh
cd dev/ios
pod deintegrate
pod install --repo-update
```

If CocoaPods still resolves stale native dependencies, remove `Pods/` and `Podfile.lock` only from
`packages/react-native-sdk/dev/ios/`, then run `pod install --repo-update` again.

### Android Build Issues

Clean Gradle cache:

```sh
cd dev/android
./gradlew clean
```

## Architecture

```
dev/
├── App.tsx                 # Main app component
├── components/             # UI components
│   ├── LoadingScreen.tsx
│   ├── MergeTagDetailCard.tsx
│   ├── SDKConfigCard.tsx
│   └── SDKStatusCard.tsx
├── utils/
│   └── sdkHelpers.ts       # SDK initialization and data fetching
├── env.config.ts           # Environment configuration (mock server URLs)
├── scripts/
│   └── run-dev-dashboard.sh  # Setup and run script
├── ios/                    # iOS native project
└── android/                # Android native project
```

## Environment Configuration

The app connects to the mock server by default. Configuration is in `env.config.ts`:

- `PUBLIC_EXPERIENCE_API_BASE_URL`: Experience API endpoint
- `PUBLIC_INSIGHTS_API_BASE_URL`: Insights API endpoint
- `PUBLIC_CONTENTFUL_CDA_HOST`: Contentful mock server host

## What This App Tests

1. **SDK Initialization:** Verifies the Optimization React Native SDK initializes correctly
2. **Profile Management:** Tests profile creation and updates
3. **Merge Tag Resolution:** Demonstrates merge tag value resolution
4. **Entry Tracking:** Tests viewport-based analytics tracking
5. **Optimization:** Shows optimized content rendering

## Available Scripts

| Script                   | Description                                   |
| ------------------------ | --------------------------------------------- |
| `pnpm dev:setup:ios`     | Full setup and run on iOS                     |
| `pnpm dev:setup:android` | Full setup and run on Android                 |
| `pnpm dev:setup:servers` | Start mock server and Metro only              |
| `pnpm dev:ios`           | Run app on iOS (requires servers running)     |
| `pnpm dev:android`       | Run app on Android (requires servers running) |
| `pnpm dev:start`         | Start Metro bundler                           |
| `pnpm dev:start:clean`   | Start Metro with cache reset                  |
