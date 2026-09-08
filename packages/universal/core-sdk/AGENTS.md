# AGENTS.md

Owns the platform-agnostic optimization core used by all platform SDKs, Contentful CDA schemas, and
the aggregate `./api-schemas` pass-through for CDA and API Client schema exports.

## Rules

- Prefer shared fixes here when a problem affects more than one platform SDK.
- `src/preview-support/` has additional guidance for preview-panel support.

## Commands

- `pnpm --filter @contentful/optimization-core <script>` with `typecheck`, `test:unit`, `build`, or
  `size:check` or `size:report`.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
- Handle bundle-size failures under the root `Bundle size` policy.
