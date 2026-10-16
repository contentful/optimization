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
  `size:check`, `size:report`, or `dev`.

## Validate

- Run `typecheck` and `build`.
- Handle bundle-size failures under the root `Bundle size` policy.
- For approved increases to exceeded budgets or requested normalization, set each authorized budget
  to `ceil((measuredGzipBytes + 100) / 100) * 100` under the root
  [Bundle size](../../../AGENTS.md#bundle-size) measurement and approval rules.
- Validate the package-local `dev` flow when changing panel flows it exercises.
