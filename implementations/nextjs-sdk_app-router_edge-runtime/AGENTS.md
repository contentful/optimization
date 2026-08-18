# AGENTS.md

Next.js SDK App Router Edge runtime reference implementation for `@contentful/optimization-nextjs`.

## Rules

- App Router only; no Pages Router.
- Actual Edge runtime routes must export `runtime = 'edge'` and assert
  `globalThis.EdgeRuntime === 'edge-runtime'` at request time.
- Do not enable `cacheComponents`; this implementation does not cover ISR or revalidation.
- Keep this implementation focused on Edge runtime handoff routes. Cache Components SSG/ISR coverage
  belongs in `nextjs-sdk_app-router`.
- Do not import lower-level SDK packages directly from this implementation.
- Entry IDs and customer segments come from the shared `e2e-web` fixtures.
- If consumed packages changed, run `pnpm build:pkgs` once, then
  `pnpm implementation:nextjs-sdk_app-router_edge-runtime implementation:install`. Skip this refresh
  when the installed dependencies are already current.

## Commands

- `pnpm implementation:run -- nextjs-sdk_app-router_edge-runtime <script>` with
  `implementation:install`, `typecheck`, `lint`, `build`, `dev`, `serve`, `serve:stop`, or
  `test:e2e`.
- Playwright: `pnpm test:e2e:nextjs-sdk_app-router_edge-runtime <file-or-filter>`. This runner is
  setup-free. The file or filter is optional; omit it only when the full suite is warranted.

## E2E

- Shared Edge runtime tests run via `lib/e2e-web` with `E2E_FLAGS=EDGE` (port 3003).
- `test:e2e` starts the app + mocks via the shared Playwright web server.

## Validate

- Run `typecheck` for local code changes.
- Run `lint` for source changes.
- Run `build` for production bundling changes.
- Run Playwright E2E for Edge runtime handoff behavior.
