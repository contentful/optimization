# AGENTS.md

React reference implementation for direct `@contentful/optimization-web` usage in a React
application.

## Rules

- Keep reusable React SDK abstractions in `packages/web/frameworks/react-web-sdk`, not here.
- This implementation uses Rsbuild for consistency with the SDK toolchain.
- `serve` uses PM2-managed processes; use `serve:stop` when done.

## Commands

- `pnpm implementation:web-sdk_react <script>` with `implementation:install`, `typecheck`,
  `build`, `dev`, `serve`, or `serve:stop`.
- Run Playwright with `pnpm test:e2e:web-sdk_react <file-or-filter>`.

## Validate

- Run `typecheck` for local code changes.
- Run `build` for production bundling changes.
- Run Playwright E2E for user-visible behavior, routing, event flow, or React integration changes.
