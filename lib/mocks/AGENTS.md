# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package owns shared mock fixtures, MSW handlers, mock server behavior, and Contentful test
space utilities used by unit tests and reference implementations.

## Key Paths

- `src/`
- `scripts/`
- `.contentfulrc.json` for local Contentful credentials

## Local Rules

- Keep mock contracts aligned with `@contentful/optimization-api-schemas`.
- Server behavior changes here can affect multiple implementations at once. Broaden validation when
  endpoint behavior or fixture shape changes.
- Do not commit secrets or local credentials from `.contentfulrc.json`.
- Do not run `upload:ctfl:space` unless the user explicitly asked for Contentful space mutation.

## Commands

- `pnpm --filter mocks serve`
- `pnpm --filter mocks typecheck`
- `pnpm --filter mocks test:unit`
- `pnpm --filter mocks fetch:ctfl`
- `pnpm --filter mocks generate:ctfl:types`

## Usually Validate

- Run `typecheck` and `test:unit` for code changes.
- Run affected implementation E2E when mock server routes, fixtures, or API response shapes change.
