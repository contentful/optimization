# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This is the Next.js (App Router) reference implementation demonstrating
`@contentful/optimization-react-web` for client-side optimization and
`@contentful/optimization-node` for server-side optimization in an SSR context.

It shows two integration patterns:

1. **Client-resolved**: entries are resolved entirely on the client via the React SDK
2. **Server-pre-resolved**: entries are resolved on the server via the Node SDK and hydrated on the
   client

## Key Paths

- `app/` — Next.js App Router pages, layouts, and route handlers
- `lib/` — shared utilities (SDK config, Contentful client, server-side helpers)
- `components/` — React components (client and server)
- `.env.example`
- `middleware.ts` — Next.js middleware for cookie-based profile management

## Local Rules

- This implementation uses the Next.js App Router exclusively. Do not add Pages Router files.
- All SDK usage on the client must live inside `"use client"` components. Server Components must not
  import from `@contentful/optimization-react-web` or `@contentful/optimization-web`.
- Server-side SDK usage must import from `@contentful/optimization-node` only.
- The React SDK (`OptimizationRoot`) must be initialized in a single client component wrapper in the
  root layout. Do not create multiple provider instances.
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
