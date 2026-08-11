# AGENTS.md

Owns browser-specific SDK behavior, Web runtime concerns, and entry interaction tracking.

## Rules

- The live Web SDK is the browser runtime's one active `CoreStateful` singleton. The full content
  runtime and analytics-only runtime are mutually exclusive owners of that same lock; `destroy()`
  must release the current owner before another can initialize.
- Keep singleton enforcement in Core. Do not infer ownership from the optional
  `window.contentfulOptimization` discovery property, and do not introduce per-target state for
  interfaces that structurally describe the singleton.
- Keep the package-local `dev` flow current for browser SDK, developer-facing setup, runtime
  integration, and preview-related behavior.

## Commands

- `pnpm --filter @contentful/optimization-web <script>` with `typecheck`, `test:unit`, `build`,
  `size:check`, `size:report`, or `dev`.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
- Handle bundle-size failures under the root `Bundle size` policy.
- Validate the package-local `dev` flow when changing flows it demonstrates.
