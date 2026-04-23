# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This is the React Web SDK reference implementation demonstrating
`@contentful/optimization-react-web` usage in a React SPA. It is the counterpart to
`implementations/web-sdk_react`, which builds its own adapter layer. This implementation uses the
official React SDK surface directly — no local `src/optimization/` adapter directory.

## Key Paths

- `src/`
- `e2e/`
- `scripts/`
- `.env.example`

## Local Rules

- Do not add a `src/optimization/` directory. All SDK usage comes from direct imports of
  `@contentful/optimization-react-web`.
- This implementation uses Rsbuild for consistency with the SDK toolchain.
- Routing uses `createBrowserRouter` + `RouterProvider` (required by `ReactRouterAutoPageTracker`).
  Do not switch to `BrowserRouter` + `Routes`.
- If you changed a consumed package, run `pnpm build:pkgs` and reinstall this implementation before
  trusting local E2E.
- `serve` uses PM2-managed processes. Use `serve:stop` when done.

## Common Failure Modes

- Package changes are not reflected here: rerun `pnpm build:pkgs`, then
  `pnpm implementation:run -- react-web-sdk implementation:install`.
- If the goal is E2E setup rather than the narrowest refresh step, prefer
  `pnpm setup:e2e:react-web-sdk`.
- Playwright reports a missing browser or executable: run `pnpm playwright:install` before retrying
  E2E.
- The app or mocks fail to bind local ports such as `3000` or `8000`: stop only this
  implementation's local processes with `pnpm implementation:run -- react-web-sdk serve:stop`.
- Behavior differs from the documented mock setup: compare `.env` with `.env.example` before
  changing code.

## Commands

- `pnpm launch` or `./scripts/launch-reference-app.sh` — one-shot setup + dev server
- `pnpm implementation:run -- react-web-sdk implementation:install`
- `pnpm implementation:run -- react-web-sdk typecheck`
- `pnpm implementation:run -- react-web-sdk build`
- `pnpm implementation:run -- react-web-sdk dev`
- `pnpm implementation:run -- react-web-sdk serve`
- `pnpm implementation:run -- react-web-sdk serve:stop`
- `pnpm implementation:run -- react-web-sdk implementation:test:e2e:run`

## Usually Validate

- Run `typecheck` for local code changes.
- Run `build` when changing production bundling behavior.
- Run Playwright E2E for user-visible behavior, routing, event flow, or React integration changes.
- There are no meaningful unit tests here.
