# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, then `packages/android/AGENTS.md`,
before this file.

## Scope

This package compiles the shared TypeScript bridge source into a UMD bundle for the Android SDK. The
bridge source (`src/index.ts`) is identical to `packages/ios/ios-jsc-bridge/src/index.ts` and must
stay in sync.

## Local rules

- Do not diverge bridge source from the iOS bridge without documenting the reason in this file.
- The postbuild script copies the UMD bundle into `../ContentfulOptimization/src/main/assets/`. Do
  not hand-edit the asset copy.
- If a QuickJS-specific workaround is ever needed, isolate it here rather than in the shared bridge
  source.

## Commands

- `pnpm build` — clean + build the UMD bundle and copy to Android assets
- `pnpm typecheck` — type-check bridge source
