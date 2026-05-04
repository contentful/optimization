# AGENTS.md

Read the repository root `AGENTS.md`, then `implementations/AGENTS.md`, before this file.

## Scope

This is the native iOS reference implementation for current bridge and preview-panel validation
work.

## Key Paths

- `OptimizationApp/`
- `OptimizationAppUITests/`
- `OptimizationApp.xcodeproj/`
- `README.md`

## Local Rules

- Keep this app focused on validating native iOS integration behavior. Reusable Swift SDK behavior
  belongs in `packages/ios/ContentfulOptimization`, and TypeScript bridge behavior belongs in
  `packages/ios/ios-jsc-bridge`.
- The mock server must be running at `http://localhost:8000` before UI tests.
- XCUITest source files must be added to the `OptimizationAppUITests` target in Xcode; adding a
  `.swift` file on disk is not enough.
- Keep preview-panel scenario names, fixture IDs, and accessibility identifiers aligned with
  `implementations/PREVIEW_PANEL_SCENARIOS.md` and the React Native Detox suite.
- This app does not currently have a `package.json`, so root `pnpm implementation:run` wrappers do
  not target it.

## Commands

- `pnpm serve:mocks`
- From `implementations/ios-sdk/`:
  `xcodebuild test -project OptimizationApp.xcodeproj -scheme OptimizationApp -destination 'platform=iOS Simulator,name=iPhone 16'`
- From `implementations/ios-sdk/`:
  `xcodebuild test -project OptimizationApp.xcodeproj -scheme OptimizationApp -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:OptimizationAppUITests/PreviewPanelOverridesTests`

## Usually Validate

- Run targeted XCUITest coverage for the changed scenario when editing app UI, accessibility
  identifiers, or scenario-specific behavior.
- Run the full XCUITest suite for broad native integration, preview-panel, tracking, or lifecycle
  changes.
- Rebuild `@contentful/optimization-ios-bridge` before testing when bridge source changed.
