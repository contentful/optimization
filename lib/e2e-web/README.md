# e2e-web

Shared Playwright E2E suite for CSR web SDK implementations. The suite owns the test specs as a
single source of truth — each implementation runs them against its own dev server via the
`IMPLEMENTATION` env var, so tracking and consent behaviour is verified consistently across React
and Angular without duplicating spec files.

## Running tests

From an implementation directory:

```sh
# First-time setup (installs Playwright browsers)
pnpm implementation:setup:e2e

# Run the full suite
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
  uses this to resolve the implementation directory and run its `serve:e2e` script, which builds and
  starts the app.
- `APP_PORT` — the port the app listens on. Defaults to `3000`. Angular dev server uses `4200`, so
  it must be set explicitly.

Each implementation sets both in its own `test:e2e` script:

```sh
# web-sdk_angular
IMPLEMENTATION=web-sdk_angular APP_PORT=4200 pnpm --dir ../../lib/e2e-web test

# web-sdk_react
IMPLEMENTATION=web-sdk_react pnpm --dir ../../lib/e2e-web test
```

The config also starts the shared mock server (`lib/mocks`) automatically before running any specs.

## Adding a new implementation

1. Add `test:e2e` and `implementation:setup:e2e` scripts to the implementation's `package.json`
   following the pattern above.
2. Ensure the implementation's app responds at the configured `APP_PORT` when `serve:e2e` is run.
3. Align UI labels and `data-testid` attributes with the selectors used in the specs.
