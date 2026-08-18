# AGENTS.md

Internal shared mock fixtures, MSW handlers, mock server behavior, and Contentful test-space
utilities used by unit tests and reference implementations. Mocks are not published product
artifacts or independent validation targets.

## Rules

- Keep mock contracts aligned with `@contentful/optimization-api-schemas`.
- Implement authored mock behavior only when a consuming unit or E2E test requires it. Consumer
  demand never authorizes manual edits or synthetic additions to generated external data.
- Do not commit secrets or local credentials from `.contentfulrc.json`.
- Do not run `upload:ctfl:space` unless the user explicitly requested Contentful space mutation.
- Keep `README.md` framed as internal testing support with mock usage, fixture updates, and
  Contentful test-space setup. Prefer repo-root wrappers such as `pnpm serve:mocks` for common
  flows.

### Generated external fixtures

- Treat files marked as generated, written by `fetch:ctfl` or `generate:ctfl:types`, or emitted by a
  documented external API/MSW generation flow as generated source mirrors.
- Never manually edit generated external API mock/MSW data, including generated payloads, fixture
  records, handlers, schemas, and types. Update the external source or generator and regenerate.
- Never insert a synthetic profile, segment, experience, variant, response, or error scenario into
  generated external data. Generated data must continue to represent its external source.
- A consumer-only scenario belongs in the narrowest consuming unit test's owned fixture or handler,
  outside generated output. Validate it through that consumer; do not add a mock-owned test.
- If a maintained integration or E2E flow requires a scenario that the external source cannot
  generate, stop and report the missing source scenario and affected consumer. Do not fabricate the
  scenario in `lib/mocks` to make the flow pass.
- Before changing a candidate file, inspect its generated header and the scripts that write it. If
  ownership is ambiguous, do not edit it until the source-of-truth path is identified.

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
