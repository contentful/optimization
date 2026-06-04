# AGENTS.md

Native iOS package work under `ContentfulOptimization/`; the shared JavaScriptCore bridge comes from
`packages/universal/optimization-js-bridge/`.

## Rules

- Keep Swift bridge calls, JSON payloads, and callbacks aligned with the shared bridge source.
- Bridge bundle flow is one-way: edit TypeScript bridge source, build the bridge package, and let
  the build copy the UMD into Swift package resources.
- Do not hand-edit
  `ContentfulOptimization/Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js`.
- Native Swift SDK behavior belongs in `ContentfulOptimization/`; shared optimization logic belongs
  in `packages/universal/core-sdk`.
- Keep iOS preview-panel behavior aligned with React Native and Android when changing shared preview
  contracts.
- Keep `README.md` and `CODE_MAP.md` current when touching iOS package structure or public status.

## Validate

- Use the nearest child `AGENTS.md` for bridge or Swift package commands.
- Rebuild the bridge before relying on Swift or XCUITest results when bridge source changed.
- Validate `implementations/ios-sdk` XCUITest flows for runtime tracking, preview-panel behavior,
  JavaScriptCore integration, or cross-platform preview contract changes.
