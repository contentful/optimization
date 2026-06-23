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
- If consumed packages changed, run `pnpm build:pkgs` and reinstall before trusting results.

## Commands

- `pnpm implementation:run -- nextjs-sdk_hybrid <script>` with `implementation:install`,
  `typecheck`, `build`, `dev`, `serve`, or `serve:stop`.

## Validate

- Run `typecheck` for local code changes.
- Run `build` for production bundling changes.
