# AGENTS.md

Internal shared mock fixtures, MSW handlers, mock server behavior, and Contentful test-space
utilities used by unit tests and reference implementations. Mocks are not published product
artifacts or independent validation targets.

## Rules

- Keep mock contracts aligned with `@contentful/optimization-api-schemas`.
- Implement only behavior required by consuming unit or E2E tests. If no consumer needs it, do not
  add it.
- Do not commit secrets or local credentials from `.contentfulrc.json`.
- Do not run `upload:ctfl:space` unless the user explicitly requested Contentful space mutation.
- Keep `README.md` framed as internal testing support with mock usage, fixture updates, and
  Contentful test-space setup. Prefer repo-root wrappers such as `pnpm serve:mocks` for common
  flows.

## Commands

- `pnpm --filter mocks <script>` with `serve`, `typecheck`, `fetch:ctfl`, or `generate:ctfl:types`.

## Validation exception

This section overrides broader validation instructions inherited from parent `AGENTS.md` files:

- Never add, run, require, or cite tests whose subject is mock behavior as validation evidence. This
  includes tests under `lib/mocks` and mock-specific E2E scenarios.
- Run `typecheck` for TypeScript changes; this is the only direct validation for mocks.
- Validate behavior only incidentally through the narrowest consuming unit or E2E test that
  specifically needs the changed mock behavior. Reliable consumer use is sufficient.
- A mock change alone never justifies broader consumer coverage.
