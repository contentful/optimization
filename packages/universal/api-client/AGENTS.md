# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package owns the unified client surface for Contentful Experience API and Insights API
interactions.

## Key Paths

- `src/`
- `README.md`

## Local Rules

- Keep request and response handling aligned with `@contentful/optimization-api-schemas`.
- Put transport and API concerns here. Shared optimization business logic belongs in `core-sdk`, not
  in this package.
- If public client behavior changes, update the README and relevant TSDoc in the same change.

## Commands

- `pnpm --filter @contentful/optimization-api-client typecheck`
- `pnpm --filter @contentful/optimization-api-client test:unit`
- `pnpm --filter @contentful/optimization-api-client build`
- `pnpm --filter @contentful/optimization-api-client size:check`

## Usually Validate

- Run `typecheck` and `test:unit` for local changes.
- Run `build` for export, packaging, or runtime changes.
- Run `size:check` for runtime, export, dependency, or bundle-shape changes.
- Broaden validation to `core-sdk` or an implementation when changing request lifecycle, retries,
  event transport, or error handling.
