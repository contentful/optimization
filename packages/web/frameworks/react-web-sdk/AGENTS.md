# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This package owns the React framework layer on top of `@contentful/optimization-web`, including
providers, hooks, and React-facing entry resolution primitives.

## Key Paths

- `src/`
- `dev/`
- `dev/app/`
- `scripts/`
- `README.md`

## Local Rules

- Keep reusable React abstractions here rather than inside `implementations/react-web-sdk` or
  `implementations/web-sdk_react`.
- Do not reimplement Web SDK core behavior here when it belongs in `packages/web/web-sdk`.
- `dev/` is the package-local harness host shell. `dev/app/` contains the React harness app.
- Keep both harness layers relevant to the current provider, hook, routing, and entry-rendering
  behavior.
- Keep the `dev/` harness up-to-date when developer-facing flows, configuration, router adapters,
  live updates behavior, or core entry-resolution behavior changes.
- Validate both unit behavior and the React reference implementation when changing provider, hook,
  or component runtime behavior.

## Commands

- `pnpm --filter @contentful/optimization-react-web dev:launch` — one-shot mock server + dev harness
- `pnpm --filter @contentful/optimization-react-web typecheck`
- `pnpm --filter @contentful/optimization-react-web test:unit`
- `pnpm --filter @contentful/optimization-react-web build`
- `pnpm --filter @contentful/optimization-react-web size:check`
- `pnpm --filter @contentful/optimization-react-web dev`

## Usually Validate

- Run `typecheck`, `test:unit`, and `build`.
- Run `size:check` for runtime, export, dependency, or bundle-shape changes.
- Validate the `dev/` harness itself when changing package flows it is meant to demonstrate.
- Validate `implementations/react-web-sdk` Playwright flows when changing runtime behavior,
  readiness state, live updates, or entry rendering.
