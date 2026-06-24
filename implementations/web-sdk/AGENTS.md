# AGENTS.md

Vanilla JS reference implementation for `@contentful/optimization-web`.

## Rules

- Keep this app minimal and example-oriented; reusable runtime logic belongs in
  `packages/web/web-sdk`.
- `build` copies Web SDK, preview-panel, and `lib/e2e-web/src/theme.css` assets into `public/dist`.
- `server.ts` is a lightweight Node.js HTTP server; it reads `.env` (or `.env.example`), injects env
  vars as `window.ENVIRONMENT` into the HTML, and serves `public/` with an SPA fallback. No Docker
  or nginx required.
- E2E tests run against `lib/e2e-web` — no implementation-specific test code. The shared Playwright
  suite is invoked via `IMPLEMENTATION=web-sdk pnpm --dir ../../lib/e2e-web test`.
- The canonical `data-testid` contract is defined in `lib/e2e-web`. Do not add vanilla-specific
  testids that diverge from the shared contract.

## Commands

- `pnpm implementation:run -- web-sdk <script>` with `implementation:install`, `typecheck`, `build`,
  `serve`, `serve:stop`, or `implementation:test:e2e:run`.

## Validate

- Run `typecheck` for local changes.
- Run `build` when changing static assets or SDK asset copying.
- Run `test:e2e` (delegates to `lib/e2e-web`) for user-visible behavior or runtime tracking changes.
