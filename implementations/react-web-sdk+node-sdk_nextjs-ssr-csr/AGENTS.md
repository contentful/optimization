# AGENTS.md

Next.js App Router hybrid SSR + CSR takeover reference implementation: Node SDK resolves first
paint, then React Web SDK re-resolves entries after hydration and on client-side profile changes.

## Rules

- App Router only; no Pages Router.
- Server Components import only from `@contentful/optimization-node`; Client Components import only
  from `@contentful/optimization-react-web`.
- Landing/SEO pages should be Server Components; interactive/reactive pages should be Client
  Components using `<OptimizedEntry>` or `resolveEntry()`.
- Use `liveUpdates={true}` on `<OptimizedEntry>` for entries that should re-resolve on profile
  changes.
- Use the SDK's `OptimizationRoot` directly; do not add custom provider wrappers around it.
- If consumed packages changed, run `pnpm build:pkgs` and reinstall before trusting results.

## Commands

- `pnpm implementation:run -- react-web-sdk+node-sdk_nextjs-ssr-csr <script>` with
  `implementation:install`, `typecheck`, `build`, `dev`, `serve`, or `serve:stop`.

## Validate

- Run `typecheck` for local code changes.
- Run `build` for production bundling changes.
