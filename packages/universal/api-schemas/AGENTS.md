# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package owns Zod-based API schemas, inferred types, and schema helpers for Contentful CDA,
Experience API, and Insights API payloads.

## Key Paths

- `src/`
- `README.md`

## Local Rules

- Treat schema edits as contract changes. Prefer additive, backward-compatible changes unless the
  task explicitly changes the API contract.
- Keep runtime schemas, inferred types, and exported helper functions aligned.
- If you change public exports or validation behavior, update the package README and relevant TSDoc.

## Commands

- `pnpm --filter @contentful/optimization-api-schemas typecheck`
- `pnpm --filter @contentful/optimization-api-schemas test:unit`
- `pnpm --filter @contentful/optimization-api-schemas build`
- `pnpm --filter @contentful/optimization-api-schemas size:check`

## Usually Validate

- Run `typecheck` and `test:unit` for local changes.
- Run `build` for export or packaging changes.
- Run `size:check` for runtime, export, dependency, or bundle-shape changes.
- If public schemas or helper behavior changed, also validate at least `api-client` and `core-sdk`
  downstream.
