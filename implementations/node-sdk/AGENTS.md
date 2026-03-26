# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This is the Node SSR reference implementation for `@contentful/optimization-node`.

## Key Paths

- `src/`
- `e2e/`
- `.env.example`

## Local Rules

- Keep this app minimal and documentation-oriented. Reusable SDK behavior belongs in
  `packages/node/node-sdk`, not here.
- This implementation uses local mock defaults from `.env.example`.
- If you changed a package consumed here, run `pnpm build:pkgs` and then reinstall this
  implementation before relying on E2E results.
- `serve` uses PM2-managed processes. Prefer `serve:stop` over broad PM2 cleanup.

## Common Failure Modes

- Package changes are not reflected here: rerun `pnpm build:pkgs`, then
  `pnpm implementation:run -- node-sdk implementation:install`.
- If the goal is E2E setup rather than the narrowest refresh step, prefer `pnpm setup:e2e:node-sdk`.
- Playwright reports a missing browser or executable: run `pnpm playwright:install` before retrying
  E2E.
- The app or mocks fail to bind local ports such as `3000` or `8000`: stop only this
  implementation's local processes with `pnpm implementation:run -- node-sdk serve:stop`.
- Behavior differs from the documented mock setup: compare `.env` with `.env.example` before
  changing code.

## Commands

- `pnpm implementation:run -- node-sdk implementation:install`
- `pnpm implementation:run -- node-sdk typecheck`
- `pnpm implementation:run -- node-sdk serve`
- `pnpm implementation:run -- node-sdk serve:stop`
- `pnpm implementation:run -- node-sdk implementation:test:e2e:run`

## Usually Validate

- Run `typecheck` for local code changes.
- Run Playwright E2E for user-visible behavior, routing, cookie/session flow, or SDK integration
  changes.
- There are no meaningful unit tests here.
