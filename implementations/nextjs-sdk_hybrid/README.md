<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Next.js SDK Hybrid Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

Reference implementation demonstrating `@contentful/optimization-nextjs` in a Next.js App Router
application with personalized server first paint and browser-side takeover after state handoff. The
app imports only Next.js SDK subpaths:

- `@contentful/optimization-nextjs/server` in Server Components and server-only modules
- `@contentful/optimization-nextjs/client` in Client Components
- `@contentful/optimization-nextjs/request-handler` in proxy

The Next.js SDK adapter delegates server work internally, so this implementation does not import,
configure, or externalize lower-level SDK packages directly.

## What this demonstrates

Use this implementation when you need a Next.js example where the server personalizes first paint
and the browser SDK owns reactive updates after server-to-browser state handoff. It demonstrates:

- Personalized server-rendered first paint
- Server-to-browser state handoff through `NextjsOptimizationState`
- Client-side takeover with `OptimizedEntry` after browser startup
- Live re-resolution after consent, identify, reset, and client-side route changes
- `initialPageEvent="skip"` only when the server already resolved the same initial page
- Preview panel attachment as developer/editor tooling in development, preview, and staging app
  environments

This hybrid pattern keeps the initial HTML stable and personalized, then lets the browser SDK own
reactive entry resolution after state handoff.

## Architecture

```text
First request
  proxy.ts
    createNextjsOptimizationContextHandler()
      forwards sanitized request URL context for Server Components

  lib/optimization-server.ts
    createNextjsOptimization()
    getNextjsServerOptimizationData()

  app/page.tsx and app/page-two/page.tsx
    call getNextjsServerOptimizationData() with cookies() and headers()
    render NextjsOptimizationState near server-rendered optimized content

  app/layout.tsx
    owns one OptimizationRoot for browser takeover and route tracking

Browser runtime
  NextAppAutoPageTracker emits route page events
  OptimizedEntry resolves entries from current selectedOptimizations
  LiveUpdatesProvider controls reactive re-resolution
```

## CDA locale handling

The implementation defines one `APP_LOCALE`, passes it to the Next.js SDK server helpers, uses it
for event context, and passes it directly to Contentful CDA fetches. Browser client resolution
reuses the single-locale entries supplied by the server. Do not use `contentful.js` `withAllLocales`
or raw CDA `locale=*`; SDK entry resolution expects direct single-locale fields such as
`fields.nt_experiences` and `fields.nt_variants`.

See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

## Route strategy

Use Server Components for first-paint-sensitive routes and Client Components for routes where
instant personalization reactions matter after browser startup. This implementation demonstrates
both:

- The home route fetches entries server-side and passes them into client rendering
- The page-two route demonstrates client navigation and browser-observable page events
- `OptimizedEntry` owns client re-resolution without implementation-local resolver glue

## Prerequisites

- Node.js >= 20.19.0 (24.15.0 recommended to match `.nvmrc`)
- pnpm

## Setup

Run these commands from the monorepo root:

```sh
pnpm install
pnpm build:pkgs
pnpm implementation:run -- nextjs-sdk_hybrid implementation:install
test -f implementations/nextjs-sdk_hybrid/.env || cp implementations/nextjs-sdk_hybrid/.env.example implementations/nextjs-sdk_hybrid/.env
```

The `.env.example` values are mock-safe defaults for the shared local mock API. Provide live
Contentful and Optimization values only when testing against real services.

## Running locally

Run these commands from the monorepo root:

```sh
pnpm implementation:run -- nextjs-sdk_hybrid dev
pnpm implementation:run -- nextjs-sdk_hybrid build
pnpm implementation:run -- nextjs-sdk_hybrid typecheck
pnpm implementation:run -- nextjs-sdk_hybrid lint
```

The development server runs on `http://localhost:3002`.

For production-style local serving with PM2-managed mock and app processes:

```sh
pnpm implementation:run -- nextjs-sdk_hybrid serve
pnpm implementation:run -- nextjs-sdk_hybrid serve:stop
```

The preview panel attaches when `PUBLIC_APP_ENVIRONMENT` or `VERCEL_ENV` resolves to `development`,
`preview`, or `staging`. Production builds without one of those app environments leave the panel
out.

## Running E2E tests

Run the full E2E setup and test suite from the monorepo root:

```sh
pnpm setup:e2e:nextjs-sdk_hybrid
pnpm test:e2e:nextjs-sdk_hybrid
```

The E2E suite mirrors the React SDK reference implementation first: same shared scenarios,
assertions, fixtures, and structure where behavior is shared. It adds Next.js-specific browser tests
only for server-to-browser state handoff, proxy request URL context, server first paint, full reload
server re-resolution, `ServerOptimizedEntry` attributes, and skipped duplicate initial page events.

Use Playwright UI or codegen when needed:

```sh
pnpm implementation:run -- nextjs-sdk_hybrid test:e2e:ui
pnpm implementation:run -- nextjs-sdk_hybrid test:e2e:codegen
```

## Related

- [Next.js SDK SSR](../nextjs-sdk_ssr/README.md) - Static-after-browser-startup SSR reference
  implementation
- [React Web SDK reference implementation](../react-web-sdk/README.md) - Browser-side React
  integration using the React Web SDK
- [@contentful/optimization-nextjs](../../packages/web/frameworks/nextjs-sdk/README.md) - Next.js
  SDK package
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
