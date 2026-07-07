# AGENTS.md

Node SSR reference implementation for `@contentful/optimization-node`.

## Rules

- Keep this app focused and reference-oriented; reusable Node SDK behavior belongs in
  `packages/node/node-sdk`.
- Local mock defaults come from `.env.example`.
- `serve` uses PM2-managed processes; use `serve:stop` when done.

## Commands

- `pnpm implementation:run -- node-sdk <script>` with `implementation:install`, `typecheck`,
  `serve`, `serve:stop`, or `implementation:test:e2e:run`.

## Validate

- Run `typecheck` for local code changes.
- Run Playwright E2E for user-visible behavior, routing, cookie/session flow, or SDK integration
  changes.
