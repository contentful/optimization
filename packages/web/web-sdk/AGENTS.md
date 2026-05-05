# AGENTS.md

Read the repository root `AGENTS.md`, `packages/AGENTS.md`, and `packages/web/AGENTS.md` before this
file.

## Scope

This package owns browser-specific SDK behavior, including Web runtime concerns and entry
interaction tracking.

## Key paths

- `src/`
- `dev/`
- `dev/index.html`
- `dev/rsbuild.config.ts`
- `README.md`

## Local rules

- The package-local `dev` flow is a maintained development surface and must stay relevant to the
  current browser SDK behavior.
- Keep the `dev` flow up-to-date when developer-facing flows, configuration, runtime integration, or
  preview-related behavior changes.

## Commands

- `pnpm --filter @contentful/optimization-web typecheck`
- `pnpm --filter @contentful/optimization-web test:unit`
- `pnpm --filter @contentful/optimization-web build`
- `pnpm --filter @contentful/optimization-web size:check`
- `pnpm --filter @contentful/optimization-web dev`

## Usually validate

- Run `typecheck`, `test:unit`, and `build`.
- Validate the package-local `dev` flow itself when changing package flows it is meant to
  demonstrate.
