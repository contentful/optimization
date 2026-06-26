# AGENTS.md

Next.js SDK SSR reference implementation for `@contentful/optimization-nextjs`. The adapter owns
server/client SDK composition; app code imports only Next.js SDK subpaths.

## Rules

- App Router only; no Pages Router.
- Server Components import from `@contentful/optimization-nextjs/server`.
- Client components (`"use client"`) import from `@contentful/optimization-nextjs/client`.
- Proxy imports from `@contentful/optimization-nextjs/request-handler`.
- Do not import lower-level SDK packages directly from this implementation.
- Use the SDK's `OptimizationRoot` directly; do not add custom provider wrappers around it.
- If consumed packages changed, run `pnpm build:pkgs` and reinstall before trusting results.

## E2E tests

- All E2E tests live in `lib/e2e-web`. Hydration-specific specs are gated with `runIf('HYDRATION')`
  and run automatically when `E2E_FLAGS=CSR,HYDRATION`. This implementation uses
  `E2E_FLAGS=SSR,SKIP_NO_JS`: SSR enables the SSR suite, and `SKIP_NO_JS` skips the
  JavaScript-disabled variant resolution suite (`Variant Resolution (SSR, JavaScript disabled)`).
- Entry cards must expose `data-ctfl-entry-id` on the `content-*` element so shared selectors work.
- `test:e2e` delegates to `lib/e2e-web`.

## Commands

- `pnpm implementation:run -- nextjs-sdk_ssr <script>` with `implementation:install`, `typecheck`,
  `lint`, `build`, `dev`, `serve`, `serve:stop`, `implementation:setup:e2e`, or
  `implementation:test:e2e:run`.
- Root wrappers: `pnpm setup:e2e:nextjs-sdk_ssr` and `pnpm test:e2e:nextjs-sdk_ssr`.

## Validate

- Run `typecheck` for local code changes.
- Run `lint` for source changes.
- Run `build` for production bundling changes.
- Run Playwright E2E for user-visible behavior, routing, event flow, tracking, SSR first-paint,
  proxy cookie continuity, or SDK integration changes.
