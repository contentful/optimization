# AGENTS.md

Read the repository root `AGENTS.md`, `packages/AGENTS.md`, and `packages/ios/AGENTS.md` before this
file.

## Scope

This Swift Package owns the native iOS and macOS SDK layer: public Swift API, SwiftUI helpers,
tracking, persistence, JavaScriptCore lifecycle, preview-panel UI, native polyfills, resources, and
Swift tests.

## Key paths

- `Sources/ContentfulOptimization/`
- `Sources/ContentfulOptimization/Resources/`
- `Tests/ContentfulOptimizationTests/`
- `Package.swift`

## Local rules

- Keep native runtime concerns here. TypeScript bridge behavior belongs in
  `../../universal/optimization-js-bridge/`; shared optimization behavior belongs in
  `packages/universal/core-sdk`.
- Treat `Resources/optimization-ios-bridge.umd.js` as generated bridge output. It is gitignored and
  not committed; build it by running `@contentful/optimization-js-bridge` (`pnpm run ios:bridge`)
  before `swift build`/`swift test`, and never hand-edit the copied file.
- This package is published to the generated distribution repo `contentful/optimization.swift` by
  `.github/workflows/publish-spm.yaml` on each `v*` release. The mirror is generated output; nobody
  pushes to it by hand. Files in this directory (sources, `Package.swift`, polyfills, `README.md`,
  `LICENSE`) are what ships, so keep them consumer-facing and free of monorepo-internal references.
- Keep Swift payload models and bridge method expectations aligned with
  `../../universal/optimization-js-bridge/src/index.ts`.
- Keep resource additions reflected in `Package.swift` when they must ship with the Swift package.
- Preserve the package platform constraints in `Package.swift` unless the task explicitly changes
  supported platforms.
- Validate the native iOS reference app when public SwiftUI, preview-panel, tracking, storage,
  network, or JavaScriptCore lifecycle behavior changes.

## Commands

- From `packages/ios/ContentfulOptimization/`: `swift test`
- `pnpm --filter @contentful/optimization-js-bridge build`

## Usually validate

- Run Swift package tests for Swift source or resource changes.
- Rebuild the bridge before Swift tests when the copied JavaScriptCore bridge resource changed.
- Run targeted `implementations/ios-sdk` XCUITest coverage for preview-panel UI, tracking,
  navigation, storage, network, or end-to-end integration changes.
