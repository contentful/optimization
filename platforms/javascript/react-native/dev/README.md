# React Native Dev Dashboard

Development application for testing the Contentful Optimization React Native SDK.

## Quick Start

### One-Command Setup (Recommended)

From the `platforms/javascript/react-native` directory:

```bash
# For iOS
pnpm dev:setup:ios

# For Android
pnpm dev:setup:android

# Start only mock server and Metro bundler (no app launch)
pnpm dev:setup:servers
```

Or run the script directly:

```bash
./dev/scripts/run-dev-dashboard.sh --ios      # Run on iOS
./dev/scripts/run-dev-dashboard.sh --android  # Run on Android
./dev/scripts/run-dev-dashboard.sh --no-app   # Start servers only
./dev/scripts/run-dev-dashboard.sh --clean    # Clean build first
./dev/scripts/run-dev-dashboard.sh --help     # Show all options
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

All logs are written to `platforms/javascript/react-native/dev/logs/`:

- `mock-server.log` - Mock API server output
- `metro.log` - Metro bundler output

### Manual Setup

If you prefer to set things up manually:

#### 1. Install Dependencies

From the workspace root:

```bash
pnpm install
```

#### 2. Start the Mock Server

The dev app requires the mock server to be running. From the workspace root:

```bash
pnpm serve:mocks
```

This starts the mock server on `http://localhost:8000` with:

- **Experience API**: `http://localhost:8000/experience/`
- **Insights API**: `http://localhost:8000/insights/`
- **Contentful CDA**: `http://localhost:8000/contentful/`

#### 3. Install iOS Dependencies (iOS only)

```bash
cd platforms/javascript/react-native/dev/ios
pod install --repo-update
cd ..
```

#### 4. Start Metro Bundler

From `platforms/javascript/react-native`:

```bash
pnpm dev:start

# Or with cache reset
pnpm dev:start:clean
```

#### 5. Run the App

In a new terminal, from `platforms/javascript/react-native`:

```bash
# iOS
pnpm dev:ios

# Android
pnpm dev:android
```

## Prerequisites

### Required

- **Node.js** >= 18
- **pnpm** (workspace package manager)
- **Watchman** (recommended for file watching)
  ```bash
  brew install watchman
  ```

### For iOS Development

- **Xcode** with iOS Simulator
- **CocoaPods**
  ```bash
  sudo gem install cocoapods
  ```

### For Android Development

- **Android Studio** with emulator configured
- **ANDROID_HOME** environment variable set

## Troubleshooting

### "Failed to fetch entries" Error

This usually means the mock server isn't running. Make sure to start it:

```bash
# From workspace root
pnpm serve:mocks
```

### Port Already in Use

Kill existing processes:

```bash
# Kill mock server (port 8000)
lsof -ti:8000 | xargs kill -9

# Kill Metro bundler (port 8081)
lsof -ti:8081 | xargs kill -9
```

### Metro Bundler Issues

Reset the cache:

```bash
pnpm dev:start:clean
```

### iOS Build Issues

Clean and reinstall pods:

```bash
cd dev/ios
rm -rf Pods Podfile.lock
pod install --repo-update
```

### Android Build Issues

Clean Gradle cache:

```bash
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

- `VITE_EXPERIENCE_API_BASE_URL`: Experience API endpoint
- `VITE_INSIGHTS_API_BASE_URL`: Insights API endpoint
- `VITE_CONTENTFUL_CDA_HOST`: Contentful mock server host

## What This App Tests

1. **SDK Initialization** - Verifies the Optimization SDK initializes correctly
2. **Profile Management** - Tests profile creation and updates
3. **Merge Tag Resolution** - Demonstrates merge tag value resolution
4. **Component Tracking** - Tests viewport-based analytics tracking
5. **Personalization** - Shows personalized content rendering

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
