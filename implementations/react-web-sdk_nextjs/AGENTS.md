# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This is the Next.js (App Router) reference implementation demonstrating
`@contentful/optimization-react-web` for client-side optimization and
`@contentful/optimization-node` for server-side optimization.

It shows two independent integration patterns, each with its own route layout and SDK setup:

1. **Client-resolved** (`/client-resolved`): React SDK does everything in the browser — entry
   resolution, event tracking, consent, identify. No Node SDK.
2. **Server-resolved** (`/server-resolved`): Node SDK resolves entries on the server as pure HTML.
   React SDK hydrates only for interactive controls (consent, identify) and event tracking.

## Key Paths

- `app/` — Next.js App Router pages and route-scoped layouts
- `app/client-resolved/` — client-only pattern (React SDK)
- `app/server-resolved/` — server pattern (Node SDK + React SDK for tracking)
- `lib/` — shared utilities (SDK config, Contentful client, server-side helpers)
- `components/` — shared client wrapper (`ClientProviderWrapper`)
- `middleware.ts` — cookie lifecycle management
- `.env.example`

## Local Rules

- This implementation uses the Next.js App Router exclusively. Do not add Pages Router files.
- The root layout is neutral — no SDK provider. Each route owns its own SDK setup via route layouts.
- All SDK usage on the client must live inside `"use client"` components. Server Components must not
  import from `@contentful/optimization-react-web` or `@contentful/optimization-web`.
- Server-side SDK usage must import from `@contentful/optimization-node` only.
- Do not create a custom `OptimizationProvider` wrapper — use the SDK's `OptimizationRoot` directly.
- Do not add a `src/optimization/` directory. Follow the same direct-import pattern as
  `implementations/react-web-sdk`.
- If you changed a consumed package, run `pnpm build:pkgs` and reinstall this implementation before
  trusting local results.
- `serve` uses PM2-managed processes. Use `serve:stop` when done.

## Common Failure Modes

- Package changes are not reflected here: rerun `pnpm build:pkgs`, then
  `pnpm implementation:run -- react-web-sdk_nextjs implementation:install`.
- The app or mocks fail to bind local ports such as `3000` or `8000`: stop only this
  implementation's local processes with
  `pnpm implementation:run -- react-web-sdk_nextjs serve:stop`.
- Behavior differs from the documented mock setup: compare `.env` with `.env.example` before
  changing code.
- Next.js caching stale data: run `pnpm clean` to clear the `.next` directory.
- `ContentfulOptimization is already initialized`: stale singleton from a previous dev session or
  HMR. Run `window.contentfulOptimization?.destroy()` in the browser console and refresh.

## Commands

- `pnpm implementation:run -- react-web-sdk_nextjs implementation:install`
- `pnpm implementation:run -- react-web-sdk_nextjs typecheck`
- `pnpm implementation:run -- react-web-sdk_nextjs build`
- `pnpm implementation:run -- react-web-sdk_nextjs dev`
- `pnpm implementation:run -- react-web-sdk_nextjs serve`
- `pnpm implementation:run -- react-web-sdk_nextjs serve:stop`

## Usually Validate

- Run `typecheck` for local code changes.
- Run `build` when changing production bundling behavior.
- There are no meaningful unit tests here.
