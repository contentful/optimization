# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, before this file.

## Scope

This directory owns native Android package work, including the Kotlin Android library module under
`ContentfulOptimization/` and the Zipline (QuickJS) bridge package under `android-zipline-bridge/`.

## Key paths

- `ContentfulOptimization/` — Android library module (AAR), public Kotlin API, native runtime,
  Compose UI, preview panel, assets, and tests
- `android-zipline-bridge/` — TypeScript bridge compiled to a QuickJS-compatible UMD bundle
- `README.md` — package status and public-facing notes

## Local rules

- Keep Kotlin bridge calls, JSON payload shapes, and callback behavior aligned with
  `android-zipline-bridge/src/index.ts`.
- Keep the bridge bundle flow one-way: edit TypeScript bridge source, build the bridge package, and
  let its build copy the generated UMD into Android assets.
- Do not hand-edit `ContentfulOptimization/src/main/assets/optimization-android-bridge.umd.js`.
- Native Kotlin SDK behavior belongs in `ContentfulOptimization/`. Shared optimization logic belongs
  in `packages/universal/core-sdk`.
- Keep Android preview-panel behavior aligned with iOS and React Native preview-panel behavior when
  changing shared preview contracts.

## Cross-boundary validation

- Use the nearest child `AGENTS.md` for bridge or Kotlin module commands.
- Rebuild the bridge before relying on Kotlin or Android test results when bridge source changed.
- Keep the bridge source (`android-zipline-bridge/src/index.ts`) in sync with
  `packages/ios/ios-jsc-bridge/src/index.ts`.
