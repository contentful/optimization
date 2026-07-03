# AGENTS.md

Next.js SDK App Router reference implementation for `@contentful/optimization-nextjs`. The adapter
owns server/client SDK composition; app code imports bound components from `@/lib/optimization`
unless a client-only entry island needs `/client` props such as per-entry `liveUpdates` or
`loadingFallback`.

## Rules

- App Router only; no Pages Router.
- `lib/optimization.ts` is the only place that imports `createNextjsAppRouterOptimization()` from
  `@contentful/optimization-nextjs/app-router`.
- Routes and shared components import `OptimizationRoot`, the bound `OptimizedEntry`, and
  `NextAppAutoPageTracker` from `@/lib/optimization`; do not import those components from
  `@contentful/optimization-nextjs/server`.
- Client-only entry islands import `OptimizedEntry` from `@contentful/optimization-nextjs/client`
  only when they need per-entry `liveUpdates` or `loadingFallback`.
- Browser hooks and providers import from `@contentful/optimization-nextjs/client`.
- Proxy re-exports `proxy` from `@/lib/optimization` and declares the literal Next.js matcher config
  required by Next.js static analysis.
- Do not import lower-level SDK packages directly from this implementation.
- Landing/SEO pages should be Server Components; interactive/reactive surfaces should be Client
  Components using browser hooks and either the app-local `<OptimizedEntry>` or the `/client`
  `<OptimizedEntry>` when per-entry live-update control is required.
- Configure app-local `<OptimizedEntry>` live updates through the factory or `LiveUpdatesProvider`;
  use `/client` `<OptimizedEntry liveUpdates>` for per-entry overrides.
- Use the app-local bound `OptimizationRoot` directly; do not add custom provider wrappers around
  it.
- Entry IDs and click scenarios come from the shared `e2e-web` fixtures (`PAGES`, `CLICK_SCENARIOS`
  from `e2e-web`). Do not duplicate these constants locally.
- If consumed packages changed, run `pnpm build:pkgs` and reinstall before trusting results.

## Commands

- `pnpm implementation:run -- nextjs-sdk_app-router <script>` with `implementation:install`,
  `typecheck`, `lint`, `build`, `dev`, `serve`, `serve:stop`, or `test:e2e`.
- Root wrappers: `pnpm setup:e2e:nextjs-sdk_app-router` and `pnpm test:e2e:nextjs-sdk_app-router`.

## E2E

- Shared behavioral tests run via `lib/e2e-web` with `E2E_FLAGS=CSR,HYDRATION,SSR` (port 3002).
- App Router hydration behavior is covered by shared `lib/e2e-web` specs.
- `test:e2e` starts the app + mocks via `serve`, then delegates to `lib/e2e-web`.
- `test:e2e:ui` opens the shared Playwright UI with the App Router target pre-configured.

## Validate

- Run `typecheck` for local code changes.
- Run `lint` for source changes.
- Run `build` for production bundling changes.
- Run Playwright E2E for user-visible behavior, routing, event flow, tracking, SSR first-paint,
  hydration handoff, client takeover, proxy cookie continuity, or SDK integration changes.
