# AGENTS.md

Read the repository root `AGENTS.md`, `packages/AGENTS.md`, and `packages/web/AGENTS.md` before this
file.

## Scope

This package owns the Web preview panel micro-frontend built with Lit and integrated with
`@contentful/optimization-web`.

## Key paths

- `src/`
- `dev/`
- `dev/index.html`
- `dev/rsbuild.config.ts`
- `README.md`

## Local rules

- Prefer local fixes here for panel UI behavior.
- The package-local `dev` flow is a maintained development surface and must stay relevant to the
  current preview-panel behavior.
- Keep the `dev` flow up-to-date when panel UI, preview bridge behavior, CSP-related setup, or
  developer-facing preview workflows change.
- The current `test:unit` script is a placeholder. Build and runtime validation matter more here.
- Update the README when public setup or CSP behavior changes.

## Commands

- `pnpm --filter @contentful/optimization-web-preview-panel typecheck`
- `pnpm --filter @contentful/optimization-web-preview-panel build`
- `pnpm --filter @contentful/optimization-web-preview-panel size:check`
- `pnpm --filter @contentful/optimization-web-preview-panel dev`

## Usually validate

- Run `typecheck` and `build`.
- Validate the package-local `dev` flow itself when changing panel flows it is meant to exercise.
