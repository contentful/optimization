# AGENTS.md

Owns the React framework layer over `@contentful/optimization-web`: providers, hooks, and
React-facing entry resolution primitives.

## Rules

- `dev/` is the package-local harness host shell; `dev/app/` is the React harness app.
- Mount one owned stateful SDK root per browser runtime. `OptimizationProvider sdk={...}` injects the
  existing live singleton; it does not create a second stateful lifecycle. Read-only snapshot
  runtimes may back server and initial presentation, but they are not live SDK instances.
- Do not describe structural test runtimes as multiple SDK instances or use them to justify
  per-instance browser state. Route tracking, consent, hydration, and live optimization signals are
  owned by the one active stateful singleton.
- Keep both harness layers current for provider, hook, routing, live updates, and entry-rendering
  behavior.
- Validate the React reference implementation for provider, hook, or component runtime changes.

## Commands

- `pnpm --filter @contentful/optimization-react-web <script>` with `dev:launch`, `typecheck`,
  `test:unit`, `build`, `size:check`, `size:report`, or `dev`.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
- Handle bundle-size failures under the root `Bundle size` policy.
- Before React Web `build`, `size:report`, or `size:check`, make sure any required
  `@contentful/optimization-web` build, clean, package, or size command has completed. Do not run
  React Web build, declaration, package, or size commands concurrently with Web SDK commands that
  clean, write, or measure `dist/`.
- Validate the `dev/` harness when changing package flows it demonstrates.
- Validate `implementations/react-web-sdk` Playwright flows for readiness state, live updates, entry
  rendering, or other runtime behavior changes.
