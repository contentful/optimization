# AGENTS.md

Owns browser-specific SDK behavior, Web runtime concerns, and entry interaction tracking.

## Rules

- Keep the package-local `dev` flow current for browser SDK, developer-facing setup, runtime
  integration, and preview-related behavior.

## Commands

- `pnpm --filter @contentful/optimization-web <script>` with `typecheck`, `test:unit`, `build`,
  `size:check`, `size:report`, or `dev`.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
- Handle bundle-size failures under the root `Bundle size` policy.
- Validate the package-local `dev` flow when changing flows it demonstrates.
