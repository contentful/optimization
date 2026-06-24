# AGENTS.md

Shared Playwright E2E package for web SDK reference implementations.

## Boundaries

- This package owns the shared Playwright specs, selectors, fixtures, reports, and the
  `RENDERING_MODE` / `IMPLEMENTATION` / `APP_PORT` contract for browser-based Web SDK E2E.
- Supported CSR implementations (`RENDERING_MODE=csr`, the default): `react-web-sdk`,
  `web-sdk_react`, and `web-sdk_angular`.
- Supported SSR implementation (`RENDERING_MODE=ssr`): `nextjs-sdk_ssr` (port 3001).
- Supported hybrid implementation (`RENDERING_MODE=hybrid`): `nextjs-sdk_hybrid` (port 3002).
- Keep selectors and `data-testid` contracts aligned with every supported implementation before
  changing shared specs.
- Treat `playwright-report/`, `test-results/`, and `node_modules/` as generated or local-only.

## Environment variables

| Variable         | Default       | Description                                                                                                                             |
| ---------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `RENDERING_MODE` | `csr`         | Rendering target: `csr`, `ssr`, or `hybrid`.                                                                                            |
| `IMPLEMENTATION` | —             | CSR implementation folder name (required when `RENDERING_MODE=csr`). Defaults to the canonical implementation for `ssr`/`hybrid` modes. |
| `APP_PORT`       | mode-specific | Target port. Defaults: `csr`→3000, `ssr`→3001, `hybrid`→3002.                                                                           |

## Commands

- `pnpm --dir lib/e2e-web setup:e2e`
- `pnpm --dir lib/e2e-web test`
- `RENDERING_MODE=hybrid pnpm --dir lib/e2e-web test`
- `RENDERING_MODE=ssr pnpm --dir lib/e2e-web test`
- `IMPLEMENTATION=react-web-sdk pnpm --dir lib/e2e-web test`
- `pnpm --dir lib/e2e-web test:ui`
- `pnpm --dir lib/e2e-web test:report`
- `pnpm --dir lib/e2e-web test:unit`

## Validate

- Run the affected implementation E2E command when shared specs, selectors, fixtures, app-server
  assumptions, or `RENDERING_MODE` / `IMPLEMENTATION` / `APP_PORT` behavior changes.
- Run all supported implementation suites when a shared spec change is intended to apply across all
  Web SDK implementations.
