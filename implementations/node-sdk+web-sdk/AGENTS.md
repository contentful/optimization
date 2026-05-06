# AGENTS.md

Read the repository root `AGENTS.md`, then `implementations/AGENTS.md`, before this file.

## Scope

This is the combined Node SSR + Web Vanilla reference implementation used to demonstrate shared
cookie-based server and browser behavior.

## Key paths

- `src/`
- `public/`
- `e2e/`
- `.env.example`

## Local rules

- Keep this app focused on demonstrating integration patterns, not housing reusable SDK logic.
- `build` copies Web SDK and preview-panel assets into `public/dist`. Rebuild after changing those
  packages or the way assets are served.
- `serve` uses PM2-managed processes. Use `serve:stop` when done.

## Common failure modes

- Playwright reports a missing browser or executable: run `pnpm playwright:install` before retrying
  E2E.
- The app or mocks fail to bind local ports such as `3000` or `8000`: stop only this
  implementation's local processes with `pnpm implementation:run -- node-sdk+web-sdk serve:stop`.

## Commands

- `pnpm implementation:run -- node-sdk+web-sdk implementation:install`
- `pnpm implementation:run -- node-sdk+web-sdk typecheck`
- `pnpm implementation:run -- node-sdk+web-sdk test:unit`
- `pnpm implementation:run -- node-sdk+web-sdk build`
- `pnpm implementation:run -- node-sdk+web-sdk serve`
- `pnpm implementation:run -- node-sdk+web-sdk serve:stop`
- `pnpm implementation:run -- node-sdk+web-sdk implementation:test:e2e:run`

## Usually validate

- Run `typecheck` for local code changes.
- Run `test:unit` when server-side logic or utilities change.
- Run Playwright E2E for integration changes spanning cookies, browser assets, or cross-layer
  behavior.
