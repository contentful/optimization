# AGENTS.md

Read the repository root `AGENTS.md` first.

## Scope

This is the Next.js Hybrid SSR + CSR Takeover reference implementation. It combines
`@contentful/optimization-node` for server-side first-paint resolution with
`@contentful/optimization-react-web` for client-side reactivity after hydration.

This represents a customer setup where:

- First paint is server-resolved (no flicker)
- After hydration, the React Web SDK takes over for entry resolution
- Identify, consent, and reset re-resolve entries immediately (no server roundtrip)
- Subsequent navigations via `<Link>` are SPA-style (client-resolved)
- Some routes are Server Components (SSR-resolved), others are Client Components (CSR-resolved)

Contrast with (`react-web-sdk+node-sdk_nextjs-ssr`) where content is static until the next server
roundtrip — there the React Web SDK only handles events/tracking, never entry resolution.

## Key Paths

- `app/` — Next.js App Router (mix of Server and Client Components)
- `lib/` — SDK config, Contentful client, Node SDK singleton
- `components/` — ClientProviderWrapper, client-resolved page components
- `middleware.ts` — cookie lifecycle (same as )
- `.env.example`

## Local Rules

- Next.js App Router only. No Pages Router.
- Server Components import only from `@contentful/optimization-node`.
- Client Components (`"use client"`) import only from `@contentful/optimization-react-web`.
- Landing/SEO pages should be Server Components with Node SDK resolution.
- Interactive/reactive pages should be Client Components using `<OptimizedEntry>` or
  `resolveEntry()`.
- Use `liveUpdates={true}` on `<OptimizedEntry>` for entries that should re-resolve on profile
  change.
- Use the SDK's `OptimizationRoot` directly — no custom provider wrappers around it.
- If you changed a consumed package, run `pnpm build:pkgs` and reinstall before trusting results.

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
