# AGENTS.md

Next.js SDK Pages Router reference implementation for `@contentful/optimization-nextjs`. The adapter
owns server/client SDK composition; app code imports bound components from `@/lib/optimization` and
uses Next.js SDK subpaths only for non-component runtime surfaces.

## Rules

- Pages Router only; no App Router.
- `lib/optimization.ts` is the only place that imports `bindNextjsPagesRouterOptimization()` from
  `@contentful/optimization-nextjs/pages-router`.
- `lib/optimization-server.ts` is the only place that imports
  `bindNextjsPagesRouterServerOptimization()` from
  `@contentful/optimization-nextjs/pages-router/server`.
- Routes and shared components import `OptimizationRoot`, `OptimizedEntry`, and
  `NextPagesAutoPageTracker` from `@/lib/optimization`; do not import those components directly from
  `@contentful/optimization-nextjs/pages-router` or another SDK subpath.
- Browser hooks, providers, and related runtime types import from
  `@contentful/optimization-nextjs/pages-router`, not the generic `/client` subpath.
- Do not import lower-level SDK packages directly from this implementation.
- Personalized pages should load request handoff in `getServerSideProps`; interactive/reactive surfaces
  use the app-local `<OptimizedEntry>` and browser hooks.
- Use `liveUpdates={true}` on `<OptimizedEntry>` for entries that should re-resolve on profile
  changes.
- Use the app-local bound `OptimizationRoot` directly in `pages/_app.tsx`; do not add custom
  provider wrappers around it.
- Entry IDs and click scenarios come from the shared `e2e-web` fixtures (`PAGES`, `CLICK_SCENARIOS`
  from `e2e-web`). Do not duplicate these constants locally.
- If consumed packages changed, run `pnpm build:pkgs` and reinstall before trusting results.

## Commands

- `pnpm implementation:run -- nextjs-sdk_pages-router <script>` with `implementation:install`,
  `typecheck`, `lint`, `build`, `dev`, `serve`, `serve:stop`, or `test:e2e`.
- Run `pnpm test:e2e:nextjs-sdk_pages-router <file-or-filter>`, omitting the
  file/filter only when the full suite is warranted. Refresh package tarballs and the implementation
  install first only when consumed SDK packages changed or installed artifacts are stale.

## E2E

- Shared behavioral tests run via `lib/e2e-web` with `E2E_FLAGS=CSR,HYDRATION,SSR` (port 3001).
- Pages Router hydration behavior is covered by shared `lib/e2e-web` specs.
- `test:e2e` starts the app + mocks via `serve`, then delegates to `lib/e2e-web`.
- `test:e2e:ui` opens the shared Playwright UI with the Pages Router target pre-configured.

## Validate

- Run `typecheck` for local code changes.
- Run `lint` for source changes.
- Run `build` for production bundling changes.
- Run Playwright E2E for user-visible behavior, routing, event flow, tracking, SSR first-paint,
  hydration handoff, client takeover, cookie continuity, or SDK integration changes.
