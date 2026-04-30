# AGENTS.md

Read the repository root `AGENTS.md`, then `implementations/AGENTS.md`, before this file.

## Scope

This is the React Web reference implementation used to demonstrate `@contentful/optimization-web`
usage in a React application.

## Key Paths

- `src/`
- `e2e/`
- `.env.example`

## Local Rules

- Keep this app focused on example usage. Reusable React SDK abstractions belong in
  `packages/web/frameworks/react-web-sdk`.
- This implementation uses Rsbuild for consistency with the SDK toolchain.
- `serve` uses PM2-managed processes. Use `serve:stop` when done.

## Common Failure Modes

- Playwright reports a missing browser or executable: run `pnpm playwright:install` before retrying
  E2E.
- The app or mocks fail to bind local ports such as `3000` or `8000`: stop only this
  implementation's local processes with `pnpm implementation:run -- web-sdk_react serve:stop`.

## Commands

- `pnpm implementation:run -- web-sdk_react implementation:install`
- `pnpm implementation:run -- web-sdk_react typecheck`
- `pnpm implementation:run -- web-sdk_react build`
- `pnpm implementation:run -- web-sdk_react dev`
- `pnpm implementation:run -- web-sdk_react serve`
- `pnpm implementation:run -- web-sdk_react serve:stop`
- `pnpm implementation:run -- web-sdk_react implementation:test:e2e:run`

## Usually Validate

- Run `typecheck` for local code changes.
- Run `build` when changing production bundling behavior.
- Run Playwright E2E for user-visible behavior, routing, event flow, or React integration changes.
- There are no meaningful unit tests here.
