# AGENTS.md

Swift Package for the native iOS and macOS SDK layer: public Swift API, SwiftUI helpers, tracking,
persistence, JavaScriptCore lifecycle, preview-panel UI, native polyfills, resources, and tests.

## Rules

- Keep native runtime concerns here; TypeScript bridge behavior belongs in
  `../../universal/optimization-js-bridge/`, and shared optimization behavior belongs in
  `packages/universal/core-sdk`.
- Treat `Resources/optimization-ios-bridge.umd.js` as generated, gitignored bridge output. Build
  `@contentful/optimization-js-bridge` (`pnpm ios:bridge`) before Swift build/test and never
  hand-edit the copied file.
- This directory is what ships to the generated `contentful/optimization.swift` distribution repo;
  keep shipped files consumer-facing and free of monorepo-internal references.
- Keep Swift payload models and bridge methods aligned with the shared bridge source.
- Keep resource additions reflected in `Package.swift` and preserve platform constraints unless the
  task explicitly changes supported platforms.

## Commands

- From `packages/ios/ContentfulOptimization/`: `swift test`
- Bridge build: `pnpm --filter @contentful/optimization-js-bridge build`
- Downstream XCUITest after SDK runtime or UI adapter changes:
  `pnpm implementation:run -- ios-sdk test:e2e:ios:build:release`, then
  `IOS_SCHEME=SwiftUI pnpm implementation:run -- ios-sdk test:e2e:ios:run:release`, and
  `IOS_SCHEME=UIKit pnpm implementation:run -- ios-sdk test:e2e:ios:run:release`.
- Target a suite with
  `IOS_SCHEME=SwiftUI IOS_ONLY_TESTING=<target-or-class> pnpm implementation:run -- ios-sdk test:e2e:ios:run:release`.

## Validate

- Run Swift package tests for Swift source or resource changes.
- Rebuild the bridge before Swift tests when the copied JavaScriptCore bridge resource changed.
- Run targeted `implementations/ios-sdk` XCUITest coverage for preview-panel UI, tracking,
  navigation, storage, network, or end-to-end integration changes.
