# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, before this file.

## Scope

This directory owns native Android package work: the Kotlin Android library module under
`ContentfulOptimization/`. The shared JS bridge it consumes lives under
`packages/universal/optimization-js-bridge/`.

## Key paths

- `ContentfulOptimization/` — Android library module (AAR), public Kotlin API, native runtime,
  Compose UI, preview panel, assets, and tests
- `README.md` — package status and public-facing notes

## Local rules

- Keep Kotlin bridge calls, JSON payload shapes, and callback behavior aligned with
  `packages/universal/optimization-js-bridge/src/index.ts`.
- Keep the bridge bundle flow one-way: edit TypeScript bridge source, build the bridge package, and
  let its build copy the generated UMD into Android assets.
- Do not hand-edit `ContentfulOptimization/src/main/assets/optimization-android-bridge.umd.js`.
- Native Kotlin SDK behavior belongs in `ContentfulOptimization/`. Shared optimization logic belongs
  in `packages/universal/core-sdk`.
- Keep Android preview-panel behavior aligned with iOS and React Native preview-panel behavior when
  changing shared preview contracts.
- The SDK ships **two** public UI adapter packages over the same `core` API:
  - `com.contentful.optimization.compose` — Jetpack Compose adapter (`OptimizationRoot`,
    `OptimizedEntry`, `ScreenTrackingEffect`, `OptimizationLazyColumn`, view/tap-tracking
    Modifiers).
  - `com.contentful.optimization.views` — XML Views adapter (`OptimizationManager`,
    `OptimizedEntryView`, `ScreenTracker`, `TrackingRecyclerView`). Static-singleton client lookup
    extends the previously-documented `PreviewPanelActivity.addFloatingButton` pattern; consumers
    call `OptimizationManager.initialize` from `Application.onCreate` and read
    `OptimizationManager.client` from any `Activity`/`Fragment`.
  - Behavior parity between the two adapters is validated end-to-end by the Android matrix CI leg
    (`e2e-android-sdk` runs the same UI Automator suite against both reference impls). A change in
    one adapter that drifts from the other will fail one matrix leg.

## Cross-boundary validation

- Use the nearest child `AGENTS.md` for bridge or Kotlin module commands.
- Rebuild the bridge before relying on Kotlin or Android test results when bridge source changed.
- The bridge source is shared at `packages/universal/optimization-js-bridge/src/index.ts` — one
  `src/index.ts` builds both native bundles, so there is no per-platform bridge to keep in sync.
