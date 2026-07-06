# AGENTS.md

Shared Playwright E2E package for web SDK reference implementations.

## Boundaries

- This package owns the shared Playwright specs, selectors, fixtures, reports, and the `E2E_FLAGS` /
  `IMPLEMENTATION` / `APP_PORT` contract for browser-based Web SDK E2E.
- Supported CSR implementations (`E2E_FLAGS=CSR`, the default): `react-web-sdk`, `web-sdk_react`,
  and `web-sdk_angular`.
- Supported App Router implementation (`E2E_FLAGS=CSR,HYDRATION,SSR`): `nextjs-sdk_app-router` (port
  3002).
- Supported Pages Router implementation (`E2E_FLAGS=CSR,HYDRATION,SSR`): `nextjs-sdk_pages-router`
  (port 3001).
- Keep selectors and `data-testid` contracts aligned with every supported implementation before
  changing shared specs.
- Treat `playwright-report/`, `test-results/`, and `node_modules/` as generated or local-only.

## Environment variables

| Variable         | Default | Description                                                                              |
| ---------------- | ------- | ---------------------------------------------------------------------------------------- |
| `E2E_FLAGS`      | `CSR`   | Comma-separated feature flags controlling test gating. Case-insensitive. e.g. `CSR,SSR`. |
| `IMPLEMENTATION` | —       | Implementation folder name under `implementations/`. Required for CSR implementations.   |
| `APP_PORT`       | `3000`  | Port the app is running on.                                                              |

## Commands

- `pnpm --dir lib/e2e-web setup:e2e`
- `pnpm --dir lib/e2e-web test`
- `IMPLEMENTATION=nextjs-sdk_app-router pnpm --dir lib/e2e-web test`
- `IMPLEMENTATION=nextjs-sdk_pages-router pnpm --dir lib/e2e-web test`
- `IMPLEMENTATION=react-web-sdk pnpm --dir lib/e2e-web test`
- `pnpm --dir lib/e2e-web test:codegen`
- `pnpm --dir lib/e2e-web test:ui`
- `pnpm --dir lib/e2e-web test:report`
- `pnpm --dir lib/e2e-web test:unit`

## Validate

- Run the affected implementation E2E command when shared specs, selectors, fixtures, app-server
  assumptions, or `E2E_FLAGS` / `IMPLEMENTATION` / `APP_PORT` behavior changes.
- Run all supported implementation suites when a shared spec change is intended to apply across all
  Web SDK implementations.
