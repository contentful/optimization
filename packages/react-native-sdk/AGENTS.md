# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, before this file.

## Scope

This package owns the React Native SDK and its package-local development harness under `dev/`.

## Key paths

- `src/`
- `dev/`
- `__mocks__/`
- `README.md`

## Local rules

- Keep reusable React Native SDK logic here rather than in `implementations/react-native-sdk`.
- `dev/` is a package-local harness, not the published SDK surface, but it is still a maintained
  verification and development surface.
- Keep the `dev/` harness relevant and up-to-date when SDK behavior, initialization,
  developer-facing flows, preview behavior, navigation behavior, or configuration changes.
- Do not let the harness drift into a stale demo that no longer exercises the important package
  paths.
- Preserve optional peer dependency behavior unless the task explicitly changes it.

## Commands

- `pnpm --filter @contentful/optimization-react-native typecheck`
- `pnpm --filter @contentful/optimization-react-native test:unit`
- `pnpm --filter @contentful/optimization-react-native build`
- `pnpm --filter @contentful/optimization-react-native size:check`
- `pnpm --filter @contentful/optimization-react-native dev:test`
- `pnpm --filter @contentful/optimization-react-native dev:start`
- `pnpm --filter @contentful/optimization-react-native dev:android`
- `pnpm --filter @contentful/optimization-react-native dev:ios`

## Usually validate

- Run `typecheck`, `test:unit`, and `build`.
- Run `dev:test` when changing package-local harness behavior.
- Validate the `dev/` harness itself when changing SDK flows it is supposed to demonstrate.
- Validate `implementations/react-native-sdk` when runtime tracking, storage, navigation, offline,
  or preview behavior changes.
