# AGENTS.md

Read the repository root `AGENTS.md`, `packages/AGENTS.md`, and `packages/ios/AGENTS.md` before this
file.

## Scope

This package owns the TypeScript adapter compiled into the JavaScriptCore bridge UMD consumed by the
native Swift package.

## Key Paths

- `src/`
- `package.json`
- `rslib.config.ts`

## Local Rules

- Keep the bridge API JavaScriptCore-friendly: JSON strings, callback pairs, and no browser-only or
  Node-only assumptions unless the Swift polyfill layer explicitly provides them.
- Keep bridge state shapes aligned with Swift models in
  `../ContentfulOptimization/Sources/ContentfulOptimization/Core/`.
- Keep preview override calls aligned with `@contentful/optimization-core/preview-support`.
- Do not hand-edit `dist/` or the copied Swift resource bundle output. Build this package to refresh
  generated bridge artifacts.
- If bridge public behavior changes, validate the Swift package and native iOS reference app flows
  that exercise that bridge behavior.

## Commands

- `pnpm --filter @contentful/optimization-ios-bridge typecheck`
- `pnpm --filter @contentful/optimization-ios-bridge build`

## Usually Validate

- Run `typecheck` for TypeScript source changes.
- Run `build` for runtime, export, dependency, bundler config, or bridge contract changes.
- Run Swift package tests after bridge contract or payload-shape changes.
- Run targeted `implementations/ios-sdk` XCUITest coverage for preview-panel, tracking, or
  JavaScriptCore lifecycle changes.
