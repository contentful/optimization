# AGENTS.md

Owns the deprecated compatibility facade that re-exports API Client Experience/Insights/validation
schemas and Core CDA schema exports. It does not own schema implementations.

## Commands

- `pnpm --filter @contentful/optimization-api-schemas <script>` with `typecheck`, `test:unit`,
  `build`, `size:check`, or `size:report`.

## Validate

- Validate API Client and Core before validating facade changes.
- Run `typecheck` and `test:unit` for local changes.
- Run `build` for export or packaging changes.
- Handle bundle-size failures under the root `Bundle size` policy.
- For approved increases to exceeded budgets or requested normalization, set each authorized budget
  to `ceil((measuredGzipBytes + 100) / 100) * 100` under the root
  [Bundle size](../../../AGENTS.md#bundle-size) measurement and approval rules.
