# e2e-web

Shared Playwright E2E suite for browser-based Web SDK reference implementations. The suite owns the
test specs as a single source of truth; each implementation runs them against its own dev server via
the `IMPLEMENTATION` env var, so tracking and consent behavior is verified consistently across
vanilla, React, and Angular implementations without duplicating spec files.

## Running tests

```sh
# First-time setup, run once from the repo root
pnpm --dir lib/e2e-web setup:e2e

# Run the full suite from an implementation directory
pnpm test:e2e

# Open the interactive UI runner
pnpm test:e2e:ui

# View the last HTML report
pnpm test:e2e:report
```

Supported implementations: `web-sdk`, `react-web-sdk`, `web-sdk_react`, and `web-sdk_angular`.

Root wrappers are available for the current implementations:

```sh
pnpm test:e2e:web-sdk
pnpm test:e2e:react-web-sdk
pnpm test:e2e:web-sdk_react
pnpm test:e2e:web-sdk_angular
```

## How it works

`playwright.config.mjs` uses two env vars to know which app to test:

- `IMPLEMENTATION` - folder name under `implementations/`, such as `web-sdk_angular`. The config
  validates the value against `/^[a-z0-9_-]+$/`, resolves it to an absolute path, loads the
  implementation `.env` file when present, and registers that implementation's `serve:e2e` script as
  the Playwright app `webServer`.
- `APP_PORT` - port the app listens on. It defaults to `3000`; Angular sets `APP_PORT=4200`.

The config also starts the shared mock server from `lib/mocks` as a Playwright `webServer`. Both web
servers use `reuseExistingServer: true`, so Playwright can reuse a server that is already listening
or start it for a cold run and clean up the child process afterward.

Each implementation owns its own app startup behavior through `serve:e2e`, including any build step,
dev server command, fixed port, and environment handling. The shared suite only needs the app to be
reachable at `APP_PORT` and the mock API server to be reachable at `http://localhost:8000`.

Current implementation scripts point the shared suite at the right app:

```sh
# web-sdk
IMPLEMENTATION=web-sdk pnpm --dir ../../lib/e2e-web test

# react-web-sdk
IMPLEMENTATION=react-web-sdk pnpm --dir ../../lib/e2e-web test

# web-sdk_react
IMPLEMENTATION=web-sdk_react pnpm --dir ../../lib/e2e-web test

# web-sdk_angular
IMPLEMENTATION=web-sdk_angular APP_PORT=4200 pnpm --dir ../../lib/e2e-web test
```

Playwright browsers are installed once in `lib/e2e-web` and shared across all implementations. Run
`pnpm --dir lib/e2e-web setup:e2e` from the repo root before running any implementation suite for
the first time.

## Adding a new implementation

Add scripts to the implementation `package.json`; no new Playwright config or duplicated spec files
are needed:

```jsonc
// implementations/my-web-sdk/package.json
{
  "scripts": {
    // Builds and starts the app on a fixed port for Playwright to target.
    "serve:e2e": "<your build + serve command>",

    // Points the shared suite at this implementation. Set APP_PORT when it is not 3000.
    "test:e2e": "IMPLEMENTATION=my-web-sdk pnpm --dir ../../lib/e2e-web test",
    "test:e2e:codegen": "IMPLEMENTATION=my-web-sdk pnpm --dir ../../lib/e2e-web test:codegen",
    "test:e2e:ui": "IMPLEMENTATION=my-web-sdk pnpm --dir ../../lib/e2e-web test:ui",
    "test:e2e:report": "pnpm --dir ../../lib/e2e-web test:report",
  },
}
```

Then align visible labels, interaction behavior, and `data-testid` attributes with the selectors
used in the shared specs.
