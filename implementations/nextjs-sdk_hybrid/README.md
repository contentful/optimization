# Next.js SDK hybrid reference implementation

`nextjs-sdk_hybrid` is a Next.js App Router reference implementation for
`@contentful/optimization-nextjs`. The app imports only Next.js SDK subpaths:

- `@contentful/optimization-nextjs/server` in Server Components and server-only modules.
- `@contentful/optimization-nextjs/client` in Client Components.
- `@contentful/optimization-nextjs/request-handler` in proxy.

The Next.js SDK adapter delegates server work internally, but this implementation does not import,
configure, or externalize lower-level SDK packages directly.

## What this demonstrates

- Personalized server-rendered first paint.
- Hydration handoff through `OptimizationRoot` defaults.
- Client-side takeover with `OptimizedEntry` after hydration.
- Live re-resolution after consent, identify, reset, and client-side route changes.
- `initialPageEvent="skip"` only when the server already resolved the same initial page.
- Preview panel attachment as developer/editor tooling in development, preview, and staging app
  environments.

This hybrid pattern keeps the initial HTML stable and personalized, then lets the browser SDK own
reactive entry resolution after hydration.

## Architecture

```text
First request
  proxy.ts
    createNextjsOptimizationRequestHandler()
      reads app consent and anonymous ID
      calls page() when consent allows
      persists or clears the anonymous ID cookie

  lib/optimization-server.ts
    createNextjsOptimization()
    getNextjsServerOptimizationData()

  app/layout.tsx
    passes server profile, changes, and selected optimizations as OptimizationRoot defaults

After hydration
  NextAppAutoPageTracker emits route page events
  OptimizedEntry resolves entries from current selectedOptimizations
  LiveUpdatesProvider controls reactive re-resolution
```

## CDA locale handling

The implementation defines one `APP_LOCALE`, passes it to the Next.js SDK server helpers, uses it
for event context, and passes it directly to Contentful CDA fetches. Hydrated client resolution
reuses the single-locale entries supplied by the server. Do not use `contentful.js` `withAllLocales`
or raw CDA `locale=*`; SDK entry resolution expects direct single-locale fields such as
`fields.nt_experiences` and `fields.nt_variants`.

See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

## Route strategy

Use Server Components for first-paint-sensitive routes and Client Components for routes where
instant personalization reactions matter after hydration. This implementation demonstrates both:

- The home route fetches entries server-side and passes them into client rendering.
- The page-two route demonstrates client navigation and browser-observable page events.
- `OptimizedEntry` owns client re-resolution without implementation-local resolver glue.

## Prerequisites

Create a local environment file from the example and provide the Contentful and Optimization mock or
service values used by the other Web reference implementations:

```bash
cp implementations/nextjs-sdk_hybrid/.env.example implementations/nextjs-sdk_hybrid/.env
```

## Setup

Build local package tarballs, then install this implementation:

```bash
pnpm build:pkgs
pnpm implementation:run -- nextjs-sdk_hybrid implementation:install
```

## Running locally

```bash
pnpm implementation:run -- nextjs-sdk_hybrid dev
```

The app runs on port `3002`.

The preview panel attaches when `PUBLIC_APP_ENVIRONMENT` or `VERCEL_ENV` resolves to `development`,
`preview`, or `staging`. Production builds without one of those app environments leave the panel
out.

## Running E2E tests

```bash
pnpm test:e2e:nextjs-sdk_hybrid
```

The E2E suite mirrors the React SDK reference implementation first: same shared scenarios,
assertions, fixtures, and structure where behavior is shared. It adds Next.js-specific browser tests
only for hydration, proxy cookie continuity, server first paint, full reload server re-resolution,
`ServerOptimizedEntry` attributes, and skipped duplicate initial page events.

## Related

- [Next.js SDK SSR](../nextjs-sdk_ssr/README.md)
- [React Web SDK reference implementation](../react-web-sdk/README.md)
- [Next.js SDK adapter package](../../packages/web/frameworks/nextjs-sdk/README.md)
