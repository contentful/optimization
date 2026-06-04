# AGENTS.md

Combined Node SSR + vanilla Web reference implementation for shared cookie-based server/browser
behavior.

## Rules

- Keep this app focused on integration patterns, not reusable SDK logic.
- `build` copies Web SDK and preview-panel assets into `public/dist`.
- `serve` uses PM2-managed processes; use `serve:stop` when done.

## Commands

- `pnpm implementation:run -- node-sdk+web-sdk <script>` with `implementation:install`, `typecheck`,
  `test:unit`, `build`, `serve`, `serve:stop`, or `implementation:test:e2e:run`.

## Validate

- Run `typecheck` for local code changes.
- Run `test:unit` for server-side logic or utilities.
- Run Playwright E2E for cookie, browser asset, or cross-layer integration changes.
