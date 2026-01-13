# E2E Testing with Detox

This React Native application is configured with [Detox](https://wix.github.io/Detox/) for
end-to-end testing.

## Quick Start (Android)

For a fresh machine, run the automated setup script:

```bash
./scripts/setup-android-e2e.sh
```

This script will install all required dependencies (Node.js, pnpm, Java, Android SDK, emulator) and
configure your environment. After setup completes, restart your terminal and run:

```bash
# Start the emulator
emulator -avd Pixel_7_API_34 &

# Run E2E tests
./scripts/run-e2e-android.sh
```

For CI environments, use:

```bash
./scripts/setup-android-e2e.sh --ci
```

## Prerequisites

### iOS

- Xcode installed (latest version recommended)
- iOS Simulator
- CocoaPods installed

### Android

- Android Studio installed (or use the setup script above)
- Android SDK
- An Android emulator configured (recommended: Pixel 7 with API 34)
- Java Development Kit (JDK 17)

## Setup

### iOS Setup

1. Install iOS dependencies:

```bash
cd ios
pod install
cd ..
```

2. Build the app for testing:

```bash
pnpm run test:e2e:ios:build
```

### Android Setup

1. Ensure you have an Android emulator configured. You can check available emulators with:

```bash
emulator -list-avds
```

2. If you need to create one, the default configuration expects an emulator named `Pixel_7_API_34`.
   You can either:
   - Create an emulator with that name
   - Or update the `.detoxrc.js` file with your emulator name

3. Build the app for testing:

```bash
pnpm run test:e2e:android:build
```

## Running Tests

### iOS

```bash
# Build and run tests
pnpm run test:e2e:ios

# Or run separately
pnpm run test:e2e:ios:build
pnpm run test:e2e:ios:run
```

### Android

#### One-Shot Script (Recommended)

The easiest way to run Android E2E tests is using the all-in-one script:

```bash
./scripts/run-e2e-android.sh
```

Or from the root `optimization` directory:

```bash
pnpm --filter @implementation/react-native run e2e:run:android
```

This script handles the complete E2E testing workflow automatically:

1. **Creates `.env` configuration** - Generates a `.env` file with mock server URLs and test
   credentials
2. **Starts mock API server** - Launches the mock server from `lib/mocks` on port 8000
3. **Starts Metro bundler** - Starts the React Native bundler on port 8081
4. **Sets up adb reverse** - Configures port forwarding so the emulator can reach localhost services
5. **Builds the Android app** - Runs the Detox build for Android
6. **Runs E2E tests** - Executes the Detox test suite
7. **Cleans up** - Automatically stops all background processes on exit (including on errors)

**Environment variables** you can use to customize behavior:

| Variable           | Default | Description                                  |
| ------------------ | ------- | -------------------------------------------- |
| `MOCK_SERVER_PORT` | `8000`  | Port for the mock API server                 |
| `METRO_PORT`       | `8081`  | Port for Metro bundler                       |
| `SKIP_BUILD`       | `false` | Set to `true` to skip the Android build step |
| `CI`               | `false` | Set to `true` when running in CI environment |

**Example with custom options:**

```bash
# Skip build if you've already built recently
SKIP_BUILD=true ./scripts/run-e2e-android.sh

# Use different ports
MOCK_SERVER_PORT=9000 METRO_PORT=8082 ./scripts/run-e2e-android.sh
```

**Logs** are written to `implementations/react-native/logs/`:

- `mock-server.log` - Mock API server output
- `metro.log` - Metro bundler output
- `device.log` - Android device logcat output (React Native logs)

#### Manual Steps

If you need more control, you can run each step separately:

```bash
# Build and run tests
pnpm run test:e2e:android

# Or run separately
pnpm run test:e2e:android:build
pnpm run test:e2e:android:run
```

## Test Files

- Test files are located in `e2e/`
- `e2e/app.test.js` - Main application tests
- `e2e/jest.config.js` - Jest configuration for Detox

## Configuration

The Detox configuration is in `.detoxrc.js`. It includes:

- Build configurations for iOS and Android (debug and release)
- Device/simulator configurations
- Test runner settings

## Writing Tests

Tests use Detox's API along with Jest. Example:

```javascript
describe('My Feature', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  it('should display welcome screen', async () => {
    await expect(element(by.id('welcomeText'))).toBeVisible()
  })
})
```

### Test IDs

The app components have been annotated with `testID` props for Detox to identify them:

- `appTitle` - Main app title
- `appSubtitle` - App subtitle
- `sdkStatusCard` - SDK status card container
- `sdkLoaded` - SDK loaded status indicator
- `sdkConfigCard` - Configuration card
- `clientIdValue` - Client ID value
- `environmentValue` - Environment value
- `instructionsCard` - Instructions card

## Troubleshooting

### iOS

- If you get build errors, try cleaning the build: `rm -rf ios/build`
- Make sure Xcode is properly configured and you've accepted the license agreement
- Run `pod install` again if you've made changes to dependencies

### Android

- If the emulator doesn't start, launch it manually before running tests:
  ```bash
  emulator -avd Pixel_7_API_34
  ```
- Clean the Android build: `cd android && ./gradlew clean && cd ..`
- Make sure ANDROID_HOME environment variable is set

### General

- Metro bundler issues: Kill Metro and restart with cache reset:
  ```bash
  pnpm run start:clean
  ```
- Detox issues: Check the
  [Detox troubleshooting guide](https://wix.github.io/Detox/docs/introduction/troubleshooting)

## CI/CD Integration

Detox tests can be integrated into your CI/CD pipeline. Make sure to:

1. Install all dependencies
2. Set up simulators/emulators in the CI environment
3. Build the app
4. Run tests with appropriate timeout settings

### GitHub Actions

The project includes a GitHub Actions workflow (`.github/workflows/main-pipeline.yaml`) that runs
Android e2e tests on pull requests.

#### Testing Headless Locally (Before CI)

To test the headless emulator setup locally before pushing to CI:

1. **Start emulator in headless mode:**

   ```bash
   emulator -avd Pixel_7_API_34 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect &
   ```

2. **Wait for emulator to boot:**

   ```bash
   adb wait-for-device
   timeout 120 bash -c 'while [[ "$(adb shell getprop sys.boot_completed)" != "1" ]]; do sleep 5; done'
   ```

3. **Run tests:**

   ```bash
   pnpm --filter @implementation/react-native run test:e2e:android:full
   ```

#### CI Workflow Example

The CI workflow uses `reactivecircus/android-emulator-runner` action which handles emulator
lifecycle automatically. The action creates its own AVD, so no manual AVD creation is needed:

```yaml
- name: Start Android Emulator
  uses: reactivecircus/android-emulator-runner@v2
  with:
    api-level: 34
    arch: x86_64
    target: google_apis
    emulator-options: -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect
    disable-animations: true
    script: |
      cd implementations/react-native
      pnpm run test:e2e:android:build
      pnpm run test:e2e:android:run
```

**Important Notes:**

- The `android-emulator-runner` action automatically creates and manages the AVD
- No need to manually create an AVD or cache it
- The action handles emulator startup and shutdown
- Use `target: google_apis` for Google APIs system images

## Resources

- [Detox Documentation](https://wix.github.io/Detox/)
- [Detox API Reference](https://wix.github.io/Detox/docs/api/actions)
- [Jest Matchers](https://wix.github.io/Detox/docs/api/matchers)
