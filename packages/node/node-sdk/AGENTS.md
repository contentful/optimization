# AGENTS.md

Read the repository root `AGENTS.md`, then `packages/AGENTS.md`, before this file.

## Scope

This package owns Node-specific SDK behavior built on top of `@contentful/optimization-core`.

## Key paths

- `src/`
- `dev/`
- `dev/server.ts`
- `dev/index.ejs`
- `.env.example`
- `README.md`

## Local rules

- Keep this package Node-oriented. Do not add browser-only assumptions or DOM dependencies.
- Reusable cross-platform behavior belongs in `core-sdk`.
- The package-local harness under `dev/` is a maintained development surface, not throwaway
  scaffolding.
- The dev harness reads `.env` from this package directory and expects the repo-standard
  `PUBLIC_...` keys shown in `.env.example`.
- Keep the `dev` flow relevant and up-to-date when SDK initialization, server integration behavior,
  or developer-facing package flows change.

## Commands

- `pnpm --filter @contentful/optimization-node typecheck`
- `pnpm --filter @contentful/optimization-node test:unit`
- `pnpm --filter @contentful/optimization-node build`
- `pnpm --filter @contentful/optimization-node size:check`
- `pnpm --filter @contentful/optimization-node dev`

## Usually validate

- Run `typecheck`, `test:unit`, and `build`.
- Validate the package-local `dev` flow itself when changing flows it is meant to exercise.
- Validate `implementations/node-sdk` E2E when runtime or SSR behavior changes.
