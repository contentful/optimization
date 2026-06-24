# AGENTS.md

Next.js SDK hybrid reference implementation for `@contentful/optimization-nextjs`. The adapter owns
server/client SDK composition; app code imports only Next.js SDK subpaths.

## Rules

- App Router only; no Pages Router.
- Server Components import from `@contentful/optimization-nextjs/server`.
- Client Components import from `@contentful/optimization-nextjs/client`.
- Proxy imports from `@contentful/optimization-nextjs/request-handler`.
- Do not import lower-level SDK packages directly from this implementation.
- Landing/SEO pages should be Server Components; interactive/reactive pages should be Client
  Components using `<OptimizedEntry>` or `resolveEntry()`.
- Use `liveUpdates={true}` on `<OptimizedEntry>` for entries that should re-resolve on profile
  changes.
- Use the SDK's `OptimizationRoot` directly; do not add custom provider wrappers around it.
- Entry IDs and click scenarios come from the shared `e2e-web` fixtures (`PAGES`, `CLICK_SCENARIOS`
  from `e2e-web`). Do not duplicate these constants locally.
- If consumed packages changed, run `pnpm build:pkgs` and reinstall before trusting results.

## Commands

- `pnpm implementation:run -- nextjs-sdk_hybrid <script>` with `implementation:install`,
  `typecheck`, `lint`, `build`, `dev`, `serve`, `serve:stop`, or `test:e2e`.
- Root wrappers: `pnpm setup:e2e:nextjs-sdk_hybrid` and `pnpm test:e2e:nextjs-sdk_hybrid`.

## E2E

- Shared behavioral tests run via `lib/e2e-web` with `RENDERING_MODE=hybrid` (port 3002).
- The local `e2e/` directory only contains hybrid-specific tests such as `nextjs-hydration.spec.ts`.
- `test:e2e` starts the app + mocks via `serve`, then delegates to `lib/e2e-web`.
- `test:e2e:ui` opens the shared Playwright UI with the hybrid target pre-configured.

## Validate

- Run `typecheck` for local code changes.
- Run `lint` for source changes.
- Run `build` for production bundling changes.
- Run Playwright E2E for user-visible behavior, routing, event flow, tracking, SSR first-paint,
  hydration handoff, client takeover, proxy cookie continuity, or SDK integration changes.
