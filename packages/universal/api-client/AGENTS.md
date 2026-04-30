# AGENTS.md

Read the repository root `AGENTS.md`, `packages/AGENTS.md`, and `packages/universal/AGENTS.md`
before this file.

## Scope

This package owns the unified client surface for Contentful Experience API and Insights API
interactions.

## Key Paths

- `src/`
- `README.md`

## Commands

- `pnpm --filter @contentful/optimization-api-client typecheck`
- `pnpm --filter @contentful/optimization-api-client test:unit`
- `pnpm --filter @contentful/optimization-api-client build`
- `pnpm --filter @contentful/optimization-api-client size:check`

## Usually Validate

- Run `typecheck` and `test:unit` for local changes.
- Run `build` for export, packaging, or runtime changes.
