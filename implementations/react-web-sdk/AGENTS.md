# AGENTS.md

React SPA reference implementation for the official `@contentful/optimization-react-web` surface.

## Rules

- Do not add a local `src/optimization/` adapter; import SDK behavior directly from
  `@contentful/optimization-react-web`.
- This app is the counterpart to `web-sdk_react`, which builds its own adapter layer.
- Routing uses `createBrowserRouter` + `RouterProvider`; do not switch to `BrowserRouter` +
  `Routes`.
- This implementation uses Rsbuild, and `serve` uses PM2-managed processes.

## Commands

- `pnpm implementation:react-web-sdk <script>` with `implementation:install`, `typecheck`,
  `build`, `dev`, `serve`, or `serve:stop`.
- Run Playwright with `pnpm test:e2e:react-web-sdk <file-or-filter>`.

## Validate

- Run `typecheck` for local code changes.
- Run `build` for production bundling changes.
- Run Playwright E2E for user-visible behavior, routing, event flow, or React integration changes.
