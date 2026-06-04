# AGENTS.md

Shared TypeScript bridge source compiled into the native UMD bundles consumed by iOS JavaScriptCore
and Android QuickJS.

## Rules

- `src/index.ts` is the single bridge source of truth; do not fork per platform.
- Keep the bridge engine-agnostic: JSON strings, callback pairs, and no browser-only or Node-only
  assumptions.
- Polyfills under `src/polyfills/` are shared and prepended into both bundles. Platform-specific
  behavior should use build defines, not forked polyfill files.
- The build emits `optimization-ios-bridge.umd.js` and `optimization-android-bridge.umd.js`; keep
  platform names in `rslib.config.ts` so analytics `library.name` remains distinguishable.
- Keep method contracts, payload shapes, and preview override calls aligned with native model layers
  and `@contentful/optimization-core/preview-support`.
- Do not hand-edit `dist/` or copied native bundle outputs. Build this package to refresh them.

## Commands

- `pnpm --filter @contentful/optimization-js-bridge <script>` with `typecheck` or `build`.

## Validate

- Run `typecheck` for TypeScript source changes.
- Run `build` for runtime, export, dependency, bundler config, or bridge contract changes.
- After bridge contract or payload-shape changes, validate the iOS Swift package, Android Kotlin
  SDK, and targeted reference-app coverage.
