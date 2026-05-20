# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, before this file.

## Scope

This directory owns native Android package work: the Kotlin Android library module under
`ContentfulOptimization/`. The shared TypeScript bridge it consumes lives in
`packages/universal/optimization-js-bridge/`.

## Key paths

- `ContentfulOptimization/` — Android library module (AAR), public Kotlin API, native runtime,
  Compose UI, preview panel, assets, and tests
- `README.md` — package status and public-facing notes

## Local rules

- Keep Kotlin bridge calls, JSON payload shapes, and callback behavior aligned with the shared
  bridge source in `../universal/optimization-js-bridge/src/index.ts`.
- Keep the bridge bundle flow one-way: edit TypeScript bridge source, build the bridge package, and
  let its build copy the generated UMD into Android assets.
- Do not hand-edit `ContentfulOptimization/src/main/assets/optimization-android-bridge.umd.js`.
- Native Kotlin SDK behavior belongs in `ContentfulOptimization/`. Shared optimization logic belongs
  in `packages/universal/core-sdk`.
- Keep Android preview-panel behavior aligned with iOS and React Native preview-panel behavior when
  changing shared preview contracts.

## Cross-boundary validation

- Use the nearest child `AGENTS.md` for Kotlin module commands, and
  `packages/universal/optimization-js-bridge/AGENTS.md` for shared bridge commands.
- Rebuild the bridge before relying on Kotlin or Android test results when bridge source changed.
