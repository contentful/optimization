# AGENTS.md

Owns the Web preview panel micro-frontend built with Lit and integrated with
`@contentful/optimization-web`.

## Rules

- Prefer local fixes here for panel UI behavior.
- Keep the package-local `dev` flow current for panel UI, preview bridge behavior, CSP setup, and
  developer-facing preview workflows.
- `test:unit` is currently a placeholder; build and runtime validation matter more.
- Update the README when public setup or CSP behavior changes.

## Commands

- `pnpm --filter @contentful/optimization-web-preview-panel <script>` with `typecheck`, `build`,
  `size:check`, or `dev`.

## Validate

- Run `typecheck` and `build`.
- Validate the package-local `dev` flow when changing panel flows it exercises.
