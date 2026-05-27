# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, then
`packages/universal/AGENTS.md`, before this file.

## Scope

This package owns the shared TypeScript bridge source compiled into the UMD bundles consumed by both
native SDKs: the iOS Swift package (JavaScriptCore) and the Android Kotlin SDK (QuickJS). One
`src/index.ts` is the single source of truth — there is no separate per-platform bridge.

## Key paths

- `src/index.ts` — the shared bridge adapter over `@contentful/optimization-core`
- `rslib.config.ts` — builds one UMD bundle per native platform
- `package.json` — `postbuild` copies each bundle into its native SDK

## Local rules

- Keep the bridge engine-agnostic: JSON strings, callback pairs, and no browser-only or Node-only
  assumptions. Both JavaScriptCore and QuickJS host this bundle; runtime gaps are filled by each
  native polyfill layer, not here.
- The build emits two UMD bundles from the one source — `optimization-ios-bridge.umd.js` and
  `optimization-android-bridge.umd.js`. They differ only in the `__OPTIMIZATION_PACKAGE_NAME__`
  define, which Core stamps into the analytics `library.name`. Keep both platform names in
  `rslib.config.ts` so iOS and Android events stay distinguishable.
- Keep bridge state shapes and method contracts aligned with both native model layers, under
  `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/` and
  `packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/`.
- Keep preview override calls aligned with `@contentful/optimization-core/preview-support`.
- Do not hand-edit `dist/` or the copied native bundle outputs. Build this package to refresh them.

## Commands

- `pnpm --filter @contentful/optimization-js-bridge typecheck`
- `pnpm --filter @contentful/optimization-js-bridge build`

## Usually validate

- Run `typecheck` for TypeScript source changes.
- Run `build` for runtime, export, dependency, bundler config, or bridge contract changes — it
  refreshes both native bundles.
- After bridge contract or payload-shape changes, validate the iOS Swift package and the Android
  Kotlin SDK, plus targeted reference-app coverage that exercises the changed behavior.
