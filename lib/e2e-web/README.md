# e2e-web

Shared Playwright E2E suite for CSR web SDK implementations. The suite owns the test specs as a
single source of truth — each implementation runs them against its own dev server via the
`IMPLEMENTATION` env var, so tracking and consent behaviour is verified consistently across React
and Angular without duplicating spec files.

## Running tests

```sh
# First-time setup — installs Playwright browsers, run once from the repo root
pnpm --dir lib/e2e-web setup:e2e

# Run the full suite (from an implementation directory)
pnpm test:e2e

# Open the interactive UI runner
pnpm test:e2e:ui

# View the last HTML report
pnpm test:e2e:report
```

Supported implementations: `web-sdk_react`, `web-sdk_angular`.

## How it works

`playwright.config.mjs` uses two env vars to know which app to test:

- `IMPLEMENTATION` — the folder name under `implementations/` (e.g. `web-sdk_angular`). The config
  uses this to resolve the implementation directory and registers its `serve:e2e` script as a
  Playwright `webServer`. Playwright starts the server automatically before the suite runs and shuts
  it down after — or reuses it if it is already listening on the port. This means no manual pm2
  process tracking: you can run `pnpm test:e2e` from a cold start and the app comes up, tests run,
  and the process is cleaned up without any extra steps. Playwright browsers are installed once in
  `lib/e2e-web` via `setup:e2e` and shared across all implementations — no per-implementation
  install, no duplicating Playwright config, test scripts, or spec files. The value is validated
  against `/^[a-z0-9_-]+$/` and resolved to an absolute path before use, so it is never interpolated
  directly into a shell command.
- `APP_PORT` — the port the app listens on. Defaults to `3000`. Angular dev server uses `4200`, so
  it must be set explicitly. Having a configurable port also makes it possible to run E2E suites for
  multiple implementations in parallel — each on its own port with no conflicts.

The config also loads the implementation's `.env` file via `process.loadEnvFile()` before the suite
runs, so vars like `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` are available to both the test process
and the app server without any manual forwarding.

Each implementation sets both in its own `test:e2e` script:

```sh
# web-sdk_angular
IMPLEMENTATION=web-sdk_angular APP_PORT=4200 pnpm --dir ../../lib/e2e-web test

# web-sdk_react
IMPLEMENTATION=web-sdk_react pnpm --dir ../../lib/e2e-web test
```

The config also starts the shared mock server (`lib/mocks`) with the same lifecycle — spun up before
the suite and reused if already running. Each implementation registers its own `serve:e2e` command,
so the server startup behaviour (port, build step, env) is fully owned by that implementation.

## Adding a new implementation

Two changes are needed in the implementation's `package.json` — no new dependencies, no new spec
files, no Playwright config:

```jsonc
// implementations/my-web-sdk/package.json
{
  "scripts": {
    // Builds and starts the app on a fixed port for Playwright to target
    "serve:e2e": "<your build + serve command>",

    // Points the shared suite at this implementation; .env is loaded automatically
    "test:e2e": "IMPLEMENTATION=my-web-sdk pnpm --dir ../../lib/e2e-web test",
  },
}
```

Then align UI labels and `data-testid` attributes with the selectors used in the specs.

Playwright browsers are installed once in `lib/e2e-web` and shared — run `pnpm setup:e2e` there once
before running any implementation's suite for the first time.
