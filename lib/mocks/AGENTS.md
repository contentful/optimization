# AGENTS.md

Shared mock fixtures, MSW handlers, mock server behavior, and Contentful test-space utilities used
by unit tests and reference implementations.

## Rules

- Keep mock contracts aligned with `@contentful/optimization-api-schemas`.
- Treat endpoint behavior and fixture-shape changes as cross-implementation changes.
- Do not commit secrets or local credentials from `.contentfulrc.json`.
- Do not run `upload:ctfl:space` unless the user explicitly requested Contentful space mutation.
- Keep `README.md` framed as internal testing support with mock usage, fixture updates, and
  Contentful test-space setup. Prefer repo-root wrappers such as `pnpm serve:mocks` for common
  flows.

## Commands

- `pnpm --filter mocks <script>` with `serve`, `typecheck`, `test:unit`, `fetch:ctfl`, or
  `generate:ctfl:types`.

## Validate

- Run `typecheck` and `test:unit` for code changes.
- Run affected implementation E2E when routes, fixtures, or API response shapes change.
