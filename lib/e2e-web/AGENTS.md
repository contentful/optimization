# AGENTS.md

Shared Playwright E2E package for CSR web SDK reference implementations.

## Boundaries

- This package owns the shared Playwright specs, selectors, fixtures, reports, and `IMPLEMENTATION`
  / `APP_PORT` contract for browser-based Web SDK E2E.
- Current supported implementations are `react-web-sdk`, `web-sdk_react`, and `web-sdk_angular`.
- Keep selectors and `data-testid` contracts aligned with every supported implementation before
  changing shared specs.
- Treat `playwright-report/`, `test-results/`, and `node_modules/` as generated or local-only.

## Commands

- `pnpm --dir lib/e2e-web setup:e2e`
- `pnpm --dir lib/e2e-web test`
- `pnpm --dir lib/e2e-web test:ui`
- `pnpm --dir lib/e2e-web test:report`
- `pnpm --dir lib/e2e-web test:unit`

## Validate

- Run the affected implementation E2E command when shared specs, selectors, fixtures, app-server
  assumptions, or `IMPLEMENTATION` / `APP_PORT` behavior changes.
- Run all supported implementation suites when a shared spec change is intended to apply across all
  CSR Web SDK implementations.
