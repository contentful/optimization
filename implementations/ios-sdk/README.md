<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">iOS Reference App</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

Reference app for current native iOS bridge and preview-panel validation work. This app exercises
the local iOS implementation surface against the mock server in `lib/mocks/` and hosts the XCUITest
suite.

> [!NOTE]
>
> This is not a published iOS SDK package. The public native iOS SDK is still planned; see the
> package placeholder at [`packages/ios`](../../packages/ios/README.md).

## What This Demonstrates

Use this app when you need to validate current native iOS bridge and preview-panel behavior against
the shared mock API. The XCUITest suite mirrors selected cross-platform preview-panel scenarios so
iOS behavior can be compared with React Native E2E coverage.

## Prerequisites

- Xcode with an iOS Simulator available.
- pnpm workspace dependencies installed from the monorepo root.
- The mock server running at `http://localhost:8000`.

## Setup

From the monorepo root, start the mock API server before running UI tests:

```sh
pnpm serve:mocks
```

## Running Tests

All UI tests live under `OptimizationAppUITests/Tests/`.

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

### Adding New Test Files

XCUITest source files must be added to the `OptimizationAppUITests` target in Xcode before they're
compiled. Adding a `.swift` file to `OptimizationAppUITests/Tests/` on disk is **not** enough; open
the project in Xcode and confirm the new file's Target Membership includes `OptimizationAppUITests`.

## Preview Panel Tests

The preview-panel override suite mirrors the React Native Detox suite in
`implementations/react-native-sdk/e2e/preview-panel-overrides.test.js`. Both reference the shared
contract document at `implementations/PREVIEW_PANEL_SCENARIOS.md`. Keep scenario names and fixture
IDs identical across platforms so cross-platform regressions are visible in CI diffs.

## Related

- [iOS SDK package status](../../packages/ios/README.md) - Planned native iOS SDK status marker
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
- [Preview panel scenario contract](../PREVIEW_PANEL_SCENARIOS.md) - Cross-platform preview-panel
  scenario source of truth
