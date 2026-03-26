# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package owns the Web preview panel micro-frontend built with Lit and integrated with
`@contentful/optimization-web`.

## Key Paths

- `src/`
- `dev/`
- `dev/index.html`
- `dev/rsbuild.config.ts`
- `README.md`

## Local Rules

- This package is intentionally tightly coupled to Web SDK preview internals. Coordinate changes
  with `packages/web/web-sdk`.
- Prefer local fixes here for panel UI behavior, but shared preview bridge changes usually need
  matching Web SDK changes.
- The package-local `dev` flow is a maintained development surface and should stay relevant to the
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

## Usually Validate

- Run `typecheck` and `build`.
- Run `size:check` for runtime, export, dependency, or bundle-shape changes.
- Validate the package-local `dev` flow itself when changing panel flows it is meant to exercise.
- Validate with a relevant Playwright implementation run when panel behavior or preview bridging
  changes.
