# AGENTS.md

Owns the platform-agnostic optimization core used by all platform SDKs.

## Rules

- Prefer shared fixes here when a problem affects more than one platform SDK.
- `src/preview-support/` has additional guidance for preview-panel support.

## Commands

- `pnpm --filter @contentful/optimization-core <script>` with `typecheck`, `test:unit`, `build`, or
  `size:check`.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
