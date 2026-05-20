# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, before this file.

## Scope

This directory owns native iOS package work: the Swift Package under `ContentfulOptimization/`. The
shared TypeScript bridge it consumes lives in `packages/universal/optimization-js-bridge/`.

## Key paths

- `ContentfulOptimization/` - Swift Package, public Swift API, native runtime, resources, and tests
- `CODE_MAP.md` - current architecture map for native iOS work
- `README.md` - package status and public-facing notes

## Local rules

- Keep Swift bridge calls, JSON payload shapes, and callback behavior aligned with the shared bridge
  source in `../universal/optimization-js-bridge/src/index.ts`.
- Keep the bridge bundle flow one-way: edit TypeScript bridge source, build the bridge package, and
  let its build copy the generated UMD into Swift package resources.
- Do not hand-edit
  `ContentfulOptimization/Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js`.
- Native Swift SDK behavior belongs in `ContentfulOptimization/`. Shared optimization logic belongs
  in `packages/universal/core-sdk`.
- Keep iOS preview-panel behavior aligned with React Native preview-panel behavior when changing
  shared preview contracts.
- Keep `README.md` and `CODE_MAP.md` aligned with current repository reality when touching iOS
  package structure or public status.

## Cross-boundary validation

- Use the nearest child `AGENTS.md` for Swift package commands, and
  `packages/universal/optimization-js-bridge/AGENTS.md` for shared bridge commands.
- Rebuild the bridge before relying on Swift or XCUITest results when bridge source changed.
- Validate `implementations/ios-sdk` XCUITest flows when runtime tracking, preview-panel behavior,
  JavaScriptCore integration, or cross-platform preview contracts change.
