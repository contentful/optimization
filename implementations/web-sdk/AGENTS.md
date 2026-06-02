# AGENTS.md

Vanilla Web reference implementation for `@contentful/optimization-web`.

## Rules

- Keep this app minimal and example-oriented; reusable runtime logic belongs in
  `packages/web/web-sdk`.
- `build` copies Web SDK and preview-panel assets into `public/dist`.
- Docker is required for `serve:app`; nginx serves the app on port `3000`.

## Commands

- `pnpm implementation:run -- web-sdk <script>` with `implementation:install`, `typecheck`, `build`,
  `serve`, `serve:stop`, or `implementation:test:e2e:run`.

## Validate

- Run `typecheck` for local changes.
- Run `build` when changing static assets or SDK asset copying.
- Run Playwright E2E for user-visible behavior, runtime tracking, or nginx-serving changes.
