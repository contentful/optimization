# AGENTS.md

Next.js SDK App Router reference implementation for `@contentful/optimization-nextjs`. The adapter
owns server/client SDK composition. Request routes use app-local `Request*` aliases, static/public
routes use app-local `Explicit*` aliases, and client-only entry islands use `/app-router/client`
props such as per-entry `liveUpdates` or `loadingFallback`.

## Rules

- App Router only; no Pages Router.
- `lib/optimization.ts` is the only place that imports
  `bindNextjsAppRouterServerOptimization()` from
  `@contentful/optimization-nextjs/app-router/server`.
- Configure request hydration and trusted handoff once in `lib/optimization.ts`.
- The app-local request family exports `RequestOptimizationRoot`, `RequestOptimizedEntry`, and
  `RequestNextAppAutoPageTracker` from `@/lib/optimization`.
- Request routes, private request slots, and `EntryCard` use the applicable request aliases.
- Static selection-handoff routes use `ExplicitOptimizationRoot` and `ExplicitOptimizedEntry` from
  `@/lib/optimization`. Analytics-only routes use the top-level `OptimizationAnalyticsRoot`.
- Do not add app-owned request caches, request shells, `headers()` or `cookies()` plumbing, URL
  parsing, route-key construction, page payloads, or duplicate handoff awaits to request routes.
- Client-only entry islands import `OptimizedEntry` from
  `@contentful/optimization-nextjs/app-router/client` only when they need per-entry `liveUpdates` or
  `loadingFallback`.
- Browser hooks, providers, runtime components, and their related runtime types import from
  `@contentful/optimization-nextjs/app-router/client`. Do not use the generic
  `@contentful/optimization-nextjs/client` entrypoint beneath a bound App Router root.
- Proxy re-exports `proxy` from `@/lib/optimization` and declares the literal Next.js matcher config
  required by Next.js static analysis.
- Do not import lower-level SDK packages directly from this implementation.
- Landing/SEO pages should be Server Components; interactive/reactive surfaces should be Client
  Components using browser hooks and the `/app-router/client` `<OptimizedEntry>` when per-entry
  live-update control is required.
- Configure app-local request entry live updates through the binding or `LiveUpdatesProvider`; use
  `/app-router/client` `<OptimizedEntry liveUpdates>` for per-entry overrides.
- Entry IDs and click scenarios come from the shared `e2e-web` fixtures (`PAGES`, `CLICK_SCENARIOS`
  from `e2e-web`). Do not duplicate these constants locally.
- If consumed packages changed, run `pnpm build:pkgs` and reinstall before trusting results.

## Commands

- `pnpm implementation:run -- nextjs-sdk_app-router <script>` with `implementation:install`,
  `typecheck`, `lint`, `build`, `dev`, `serve`, `serve:stop`, or `test:e2e`.
- Run `pnpm test:e2e:nextjs-sdk_app-router <file-or-filter>`, omitting the
  file/filter only when the full suite is warranted. Refresh package tarballs and the implementation
  install first only when consumed SDK packages changed or installed artifacts are stale.

## E2E

- Shared behavioral tests run via `lib/e2e-web` with `E2E_FLAGS=CSR,HYDRATION,SSR,SKIP_NO_JS`
  (port 3002).
- App Router hydration behavior is covered by shared `lib/e2e-web` specs.
- `test:e2e` starts the app + mocks via `serve`, then delegates to `lib/e2e-web`.
- `test:e2e:ui` opens the shared Playwright UI with the App Router target pre-configured.

## Validate

- Run `typecheck` for local code changes.
- Run `lint` for source changes.
- Run `build` for production bundling changes.
- Run Playwright E2E for user-visible behavior, routing, event flow, tracking, SSR first-paint,
  hydration handoff, client takeover, proxy cookie continuity, or SDK integration changes.
