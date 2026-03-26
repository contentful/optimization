# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package owns browser-specific SDK behavior, including Web runtime concerns and entry
interaction tracking.

## Key Paths

- `src/`
- `dev/`
- `dev/index.html`
- `dev/rsbuild.config.ts`
- `README.md`

## Local Rules

- Keep this package browser-oriented. Do not add server-only assumptions.
- Watch bundle-size impact for runtime changes.
- The package-local `dev` flow is a maintained development surface and should stay relevant to the
  current browser SDK behavior.
- Keep the `dev` flow up-to-date when developer-facing flows, configuration, runtime integration, or
  preview-related behavior changes.
- If you touch preview-panel integration points or preview bridge behavior, validate the preview
  panel package and affected implementations too.
- Update README and relevant TSDoc when public behavior changes.

## Commands

- `pnpm --filter @contentful/optimization-web typecheck`
- `pnpm --filter @contentful/optimization-web test:unit`
- `pnpm --filter @contentful/optimization-web build`
- `pnpm --filter @contentful/optimization-web size:check`
- `pnpm --filter @contentful/optimization-web dev`

## Usually Validate

- Run `typecheck`, `test:unit`, and `build`.
- Run `size:check` for runtime, dependency, or bundle-shape changes.
- Validate the package-local `dev` flow itself when changing package flows it is meant to
  demonstrate.
- Validate `implementations/web-sdk`, `implementations/node-sdk+web-sdk`, or
  `implementations/web-sdk_react` when browser behavior changed.
