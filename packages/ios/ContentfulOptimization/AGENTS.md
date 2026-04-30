# AGENTS.md

Read the repository root `AGENTS.md`, `packages/AGENTS.md`, and `packages/ios/AGENTS.md` before this
file.

## Scope

This Swift Package owns the native iOS and macOS SDK layer: public Swift API, SwiftUI helpers,
tracking, persistence, JavaScriptCore lifecycle, preview-panel UI, native polyfills, resources, and
Swift tests.

## Key Paths

- `Sources/ContentfulOptimization/`
- `Sources/ContentfulOptimization/Resources/`
- `Tests/ContentfulOptimizationTests/`
- `Package.swift`

## Local Rules

- Keep native runtime concerns here. TypeScript bridge behavior belongs in `../ios-jsc-bridge/`;
  shared optimization behavior belongs in `packages/universal/core-sdk`.
- Treat `Resources/optimization-ios-bridge.umd.js` as generated bridge output. Update it by building
  `@contentful/optimization-ios-bridge`, not by hand-editing the copied file.
- Keep Swift payload models and bridge method expectations aligned with
  `../ios-jsc-bridge/src/index.ts`.
- Keep resource additions reflected in `Package.swift` when they must ship with the Swift package.
- Preserve the package platform constraints in `Package.swift` unless the task explicitly changes
  supported platforms.
- Validate the native iOS reference app when public SwiftUI, preview-panel, tracking, storage,
  network, or JavaScriptCore lifecycle behavior changes.

## Commands

- From `packages/ios/ContentfulOptimization/`: `swift test`
- `pnpm --filter @contentful/optimization-ios-bridge build`

## Usually Validate

- Run Swift package tests for Swift source or resource changes.
- Rebuild the bridge before Swift tests when the copied JavaScriptCore bridge resource changed.
- Run targeted `implementations/ios-sdk` XCUITest coverage for preview-panel UI, tracking,
  navigation, storage, network, or end-to-end integration changes.
