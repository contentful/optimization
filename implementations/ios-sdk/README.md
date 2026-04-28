# Optimization iOS Reference App

Reference app for the iOS Optimization SDK. Exercises the SDK against the mock server in
`lib/mocks/` and hosts the XCUITest suite.

## UI Tests

All UI tests live under `OptimizationAppUITests/Tests/`. They assume the mock server is running at
`http://localhost:8000`:

```sh
pnpm --filter @contentful/optimization-mocks serve
```

Run the full suite locally:

```sh
xcodebuild test \
  -project OptimizationApp.xcodeproj \
  -scheme OptimizationApp \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

Run only the preview-panel override suite (recommended during development of that feature):

```sh
xcodebuild test \
  -project OptimizationApp.xcodeproj \
  -scheme OptimizationApp \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:OptimizationAppUITests/PreviewPanelOverridesTests
```

### Adding new test files

XCUITest source files must be added to the `OptimizationAppUITests` target in Xcode before they're
compiled. Adding a `.swift` file to `OptimizationAppUITests/Tests/` on disk is **not** enough — open
the project in Xcode and confirm the new file's Target Membership includes `OptimizationAppUITests`.

## Preview panel tests

The preview-panel override suite mirrors the React Native Detox suite in
`implementations/react-native-sdk/e2e/preview-panel-overrides.test.js`. Both reference the shared
contract document at `implementations/PREVIEW_PANEL_SCENARIOS.md`. Keep scenario names and fixture
IDs identical across platforms so cross-platform regressions are visible in CI diffs.
