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
application with server-provided Optimization state handoff and browser-side entry resolution after
startup. For SDK runtime APIs, app code imports Next.js SDK package subpaths:

- `@contentful/optimization-nextjs/server` in Server Components and server-only modules
- `@contentful/optimization-nextjs/client` in Client Components
- `@contentful/optimization-nextjs/api-schemas` in components that need SDK schema guards
- `@contentful/optimization-nextjs/request-handler` in proxy

The Next.js SDK adapter delegates server and browser SDK work internally, so this implementation
does not import, configure, or externalize lower-level SDK packages directly for Optimization
runtime work.

## What this demonstrates

Use this implementation when you need a Next.js example where the server fetches Contentful entries
and Optimization state, then the browser SDK resolves entries and owns reactive updates after state
handoff. It demonstrates:

- Server request context forwarding through proxy
- Server-to-browser state handoff through `NextjsOptimizationState`
- Browser-side entry resolution with `OptimizedEntry` after browser startup
- Live re-resolution after consent, identify, reset, and client-side route changes
- `initialPageEvent="skip"` when the server request helper already emitted the initial page event
- Preview panel attachment behind `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`

This hybrid pattern keeps App Router server fetching in place, hands Optimization state to the
browser, and lets the browser SDK own entry resolution and reactive updates after startup.

## Architecture

```text
First request
  proxy.ts
    createNextjsOptimizationContextHandler()
      forwards sanitized request URL context for Server Components

  lib/optimization.ts
    createNextjsOptimization()
    getOptimizationData()
      calls getNextjsServerOptimizationData() with cookies() and headers()

  app/page.tsx and app/page-two/page.tsx
    fetch CDA entries server-side
    render NextjsOptimizationState with server Optimization data

  app/layout.tsx
    owns one OptimizationRoot for browser takeover and route tracking

Browser runtime
  NextjsOptimizationState hydrates Optimization data into the nearest runtime
  NextAppAutoPageTracker emits route page events
  OptimizedEntry resolves entries from current selectedOptimizations
  LiveUpdatesProvider controls reactive re-resolution
```

## CDA locale handling

The implementation defines one locale at `appConfig.locale`, passes it to the Next.js SDK server
helpers, uses it for event context, and passes it directly to Contentful CDA fetches. Browser client
resolution reuses the single-locale entries supplied by the server. Do not use `contentful.js`
`withAllLocales` or raw CDA `locale=*`; SDK entry resolution expects direct single-locale fields
such as `fields.nt_experiences` and `fields.nt_variants`.

See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

This reference demonstrates the supported manual SSR path: Server Components fetch single-locale
Contentful entries, then pass them to SDK entry resolution. For Next.js integrations with an
application-owned `contentful.js` client, we recommend configuring `createNextjsOptimization()` with
`contentful: { client: contentfulClient }` and using `requestOptimization.fetchOptimizedEntry()`
unless the route must own Contentful fetching, caching, or response shaping.

## Route strategy

Use Server Components for routes that fetch Contentful entries and request Optimization state, and
Client Components for entry surfaces that resolve and react after browser startup. This
implementation demonstrates both:

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

The preview panel attaches when `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` is `true`. The default
`.env.example` keeps it disabled for mock-safe local runs; enable the flag only for development,
preview, or staging builds where editor tooling is intended.

## Running E2E tests

Run the full E2E setup and test suite from the monorepo root:

```sh
pnpm setup:e2e:nextjs-sdk_hybrid
pnpm test:e2e:nextjs-sdk_hybrid
```

The E2E suite reuses the shared `lib/e2e-web` browser scenarios for CSR and hydration behavior under
the hybrid app configuration. It covers shared variant resolution, tracking, navigation, live
updates, offline queue recovery, and the hybrid-specific hydration check that a consented server
handoff does not issue a duplicate client Experience request. Package unit tests cover lower-level
Next.js adapter request-context, `ServerOptimizedEntry`, and initial page-event helper behavior.

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
