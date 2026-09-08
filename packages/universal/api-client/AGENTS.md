# AGENTS.md

Owns the unified client surface for Contentful Experience API and Insights API interactions, plus
their runtime schemas, inferred types, and validation helpers exposed through `./api-schemas`.

## Commands

- `pnpm --filter @contentful/optimization-api-client <script>` with `typecheck`, `test:unit`,
  `build`, `size:check`, or `size:report`.

## Validate

- Run `typecheck` and `test:unit` for local changes.
- Run `build` for export, packaging, or runtime changes.
- Handle bundle-size failures under the root `Bundle size` policy.
