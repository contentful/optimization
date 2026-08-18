# AGENTS.md

Combined Node SSR + vanilla Web reference implementation for shared cookie-based server/browser
behavior.

## Rules

- Keep this app focused on integration patterns, not reusable SDK logic.
- `build` copies Web SDK and preview-panel assets into `public/dist`.
- `serve` uses PM2-managed processes; use `serve:stop` when done.

## Commands

- `pnpm implementation:node-sdk+web-sdk <script>` with `implementation:install`, `typecheck`,
  `test:unit`, `build`, `serve`, or `serve:stop`.
- Playwright: `pnpm test:e2e:node-sdk+web-sdk <file-or-filter>`. The file or filter is optional; omit
  it only when the full suite is warranted.

## Validate

- Run `typecheck` for local code changes.
- Run `test:unit` for server-side logic or utilities.
- Run Playwright E2E for cookie, browser asset, or cross-layer integration changes.
