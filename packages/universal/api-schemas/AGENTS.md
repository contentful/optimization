# AGENTS.md

Owns Zod-based API schemas, inferred types, and schema helpers for Contentful CDA, Experience API,
and Insights API payloads.

## Commands

- `pnpm --filter @contentful/optimization-api-schemas <script>` with `typecheck`, `test:unit`,
  `build`, `size:check`, or `size:report`.

## Validate

- Run `typecheck` and `test:unit` for local changes.
- Run `build` for export or packaging changes.
- Handle bundle-size failures under the root `Bundle size` policy.
