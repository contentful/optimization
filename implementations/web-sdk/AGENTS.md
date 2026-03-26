# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This is the Web Vanilla reference implementation for `@contentful/optimization-web`.

## Key Paths

- `public/`
- `e2e/`
- `nginx/`
- `.env.example`
- `docker-compose.yaml`

## Local Rules

- Keep this app minimal and example-oriented. Reusable runtime logic belongs in
  `packages/web/web-sdk`, not here.
- `build` copies Web SDK and preview-panel assets into `public/dist`.
- Docker is required for `serve:app` because the app is served through nginx on port `3000`.
- If you changed a consumed package, run `pnpm build:pkgs` and reinstall this implementation before
  trusting local E2E.

## Common Failure Modes

- Package changes are not reflected here: rerun `pnpm build:pkgs`, then
  `pnpm implementation:run -- web-sdk implementation:install`.
- If the goal is E2E setup rather than the narrowest refresh step, prefer `pnpm setup:e2e:web-sdk`.
- `serve` fails with Docker or container errors: confirm Docker is running before retrying.
- Playwright reports a missing browser or executable: run `pnpm playwright:install` before retrying
  E2E.
- The app or mocks fail to bind local ports such as `3000` or `8000`: stop only this
  implementation's local processes with `pnpm implementation:run -- web-sdk serve:stop`.
- Behavior differs from the documented mock setup: compare `.env` with `.env.example` before
  changing code.

## Commands

- `pnpm implementation:run -- web-sdk implementation:install`
- `pnpm implementation:run -- web-sdk typecheck`
- `pnpm implementation:run -- web-sdk build`
- `pnpm implementation:run -- web-sdk serve`
- `pnpm implementation:run -- web-sdk serve:stop`
- `pnpm implementation:run -- web-sdk implementation:test:e2e:run`

## Usually Validate

- Run `typecheck` for local changes.
- Run `build` when changing static assets or SDK asset copying behavior.
- Run Playwright E2E for user-visible behavior, runtime tracking, or nginx-serving changes.
