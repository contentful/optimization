# AGENTS.md

Shared Playwright E2E package for web SDK reference implementations.

## Boundaries

- This package owns the shared Playwright specs, selectors, fixtures, reports, and the `E2E_FLAGS` /
  `IMPLEMENTATION` / `APP_PORT` contract for browser-based Web SDK E2E.
- Supported CSR implementations (`E2E_FLAGS=CSR`, the default): `react-web-sdk`, `web-sdk_react`,
  and `web-sdk_angular`.
- Supported App Router implementation (`E2E_FLAGS=CSR,HYDRATION,SSR,SKIP_NO_JS`):
  `nextjs-sdk_app-router` (port 3002).
- Supported App Router Edge runtime implementation (`E2E_FLAGS=EDGE`):
  `nextjs-sdk_app-router_edge-runtime` (port 3003).
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

- Prefer the implementation-aware setup-free root runner
  `pnpm test:e2e:<implementation> <file-or-filter>` for normal validation. The file or filter is
  optional; omit it only when the full suite is warranted.
- Use `IMPLEMENTATION=<implementation> pnpm --dir lib/e2e-web test <file-or-filter>` only for direct
  shared-suite debugging.
- `pnpm --dir lib/e2e-web setup:e2e` installs browser prerequisites. It is an explicit user/CI-owned
  setup operation, not routine run preparation.
- `pnpm --dir lib/e2e-web test:codegen`
- `pnpm --dir lib/e2e-web test:ui`
- `pnpm --dir lib/e2e-web test:report`
- `pnpm --dir lib/e2e-web test:unit`

## Validate

- Run the affected implementation E2E command when shared specs, selectors, fixtures, app-server
  assumptions, or `E2E_FLAGS` / `IMPLEMENTATION` / `APP_PORT` behavior changes.
- Run all supported implementation suites when a shared spec change is intended to apply across all
  Web SDK implementations.
