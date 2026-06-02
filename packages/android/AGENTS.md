# AGENTS.md

Native Android package work under `ContentfulOptimization/`; the shared QuickJS bridge comes from
`packages/universal/optimization-js-bridge/`.

## Rules

- Keep Kotlin bridge calls, JSON payloads, and callbacks aligned with the shared bridge source.
- Bridge bundle flow is one-way: edit TypeScript bridge source, build the bridge package, and let
  the build copy the UMD into Android assets.
- Do not hand-edit `ContentfulOptimization/src/main/assets/optimization-android-bridge.umd.js`.
- Native Kotlin SDK behavior belongs in `ContentfulOptimization/`; shared optimization logic belongs
  in `packages/universal/core-sdk`.
- Keep Android preview-panel behavior aligned with iOS and React Native when changing shared preview
  contracts.
- The public Compose and XML Views adapters share the same `core` API; keep behavior parity because
  Android E2E runs the same Maestro flows against both apps.

## Validate

- Use the nearest child `AGENTS.md` for bridge or Kotlin module commands.
- Rebuild the bridge before relying on Kotlin or Android test results when bridge source changed.
- Validate both public UI adapters for shared UI, tracking, or preview behavior changes.
