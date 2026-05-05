# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This is the Next.js SSR hybrid reference implementation. The Node SDK resolves entries on the server
(personalization is SSR). The React SDK hydrates on the client for event tracking and interactive
controls (consent, identify, page views, clicks).

This represents a customer setup where:

- Personalized content is resolved server-side for fast first paint
- Client-side JS is only used for tracking and interactive features
- The same anonymous profile cookie bridges server and client

## Key Paths

- `app/` — Next.js App Router (single page, Server Component)
- `lib/` — SDK config, Contentful client, Node SDK singleton
- `components/` — ClientProviderWrapper (React SDK), InteractiveControls
- `middleware.ts` — cookie lifecycle
- `.env.example`

## Local Rules

- Next.js App Router only. No Pages Router.
- Server Components must not import from `@contentful/optimization-react-web`.
- Client components (`"use client"`) must not import from `@contentful/optimization-node`.
- Use the SDK's `OptimizationRoot` directly — no custom provider wrappers around it.
- If you changed a consumed package, run `pnpm build:pkgs` and reinstall before trusting results.

## Commands

- `pnpm implementation:run -- react-web-sdk+node-sdk_nextjs implementation:install`
- `pnpm implementation:run -- react-web-sdk+node-sdk_nextjs typecheck`
- `pnpm implementation:run -- react-web-sdk+node-sdk_nextjs build`
- `pnpm implementation:run -- react-web-sdk+node-sdk_nextjs dev`
- `pnpm implementation:run -- react-web-sdk+node-sdk_nextjs serve`
- `pnpm implementation:run -- react-web-sdk+node-sdk_nextjs serve:stop`

## Usually Validate

- Run `typecheck` for local code changes.
- Run `build` when changing production bundling behavior.
