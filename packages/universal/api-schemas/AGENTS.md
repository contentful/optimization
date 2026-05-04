# AGENTS.md

Read the repository root `AGENTS.md`, `packages/AGENTS.md`, and `packages/universal/AGENTS.md`
before this file.

## Scope

This package owns Zod-based API schemas, inferred types, and schema helpers for Contentful CDA,
Experience API, and Insights API payloads.

## Key Paths

- `src/`
- `README.md`

## Commands

- `pnpm --filter @contentful/optimization-api-schemas typecheck`
- `pnpm --filter @contentful/optimization-api-schemas test:unit`
- `pnpm --filter @contentful/optimization-api-schemas build`
- `pnpm --filter @contentful/optimization-api-schemas size:check`

## Usually Validate

- Run `typecheck` and `test:unit` for local changes.
- Run `build` for export or packaging changes.
