<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Next.js SDK App Router Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

Reference implementation demonstrating `@contentful/optimization-nextjs` in a Next.js App Router
application with bound server/client components, explicit Optimization handoff, analytics-only
handoff, computed public cache metadata, and Edge runtime handoff examples. The implementation binds `OptimizationRoot`,
`OptimizationAnalyticsRoot`, `OptimizedEntry`, `NextAppAutoPageTracker`, request handoff helpers, and
selection handoff helpers once in `@/lib/optimization` with `bindNextjsAppRouterOptimization()`.
Routes and shared components import those app-local exports for Server Component first paint,
Client Component live-update surfaces, static/ISR selection handoff, and analytics-only routes.
Other SDK runtime imports use Next.js SDK package subpaths. The package root is not imported:

- `@contentful/optimization-nextjs/app-router` in `@/lib/optimization` for the bound component
  binding, route tracker, request handoff, selection handoff, cache middleware, and tracking helpers
- `@contentful/optimization-nextjs/client` for browser hooks and providers
- `@contentful/optimization-nextjs/api-schemas` in components that need SDK schema guards
- `@contentful/optimization-nextjs/edge` in `@/lib/edge-optimization` for Edge runtime handoff
  helpers

The Next.js SDK adapter delegates server and browser SDK work internally, so this implementation
does not import, configure, or externalize lower-level SDK packages directly for Optimization
runtime work.

## What this demonstrates

Use this implementation when you need a Next.js example where Server Components fetch Contentful
entries, the bound server root prepares Optimization state for handoff, and the browser SDK resolves
live surfaces after startup. It demonstrates:

- App-local bound components from `bindNextjsAppRouterOptimization()`
- Request handoff from `createRequestHandoff()` through the bound `OptimizationRoot`
- Customer-owned selection handoff with production-style computed public cache keys
- Edge request handoff, Edge selection handoff, and Edge HTML analytics handoff from app-local Edge
  routes
- Analytics-only tracking over server-rendered markup through `OptimizationAnalyticsRoot`
- Client-only hidden-until-ready hydration for static or browser-owned routes
- Server-resolved first paint and static content with bound `OptimizedEntry`
- Browser-side entry resolution with the same app-local `OptimizedEntry` in Client Components
- Rich Text merge tags passed from the `OptimizedEntry` render-prop `getMergeTagValue` into shared
  render options
- Live re-resolution after consent, identify, reset, and client-side route changes
- `initialPageEvent` ownership from the handoff so the browser skips only when the server or edge
  request accepted the first page event
- Preview panel attachment behind `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`

This App Router pattern keeps server fetching in place, passes explicit handoff state to the
browser, uses Server Components for first paint and static content, and uses Client Components for
live-update surfaces that need browser takeover.

## Architecture

```text
First request
  proxy.ts
    re-exports proxy from lib/optimization.ts and declares the literal Next.js matcher config
      forwards the original request URL and applies customer-owned cache-key rewrites

  lib/optimization.ts
    bindNextjsAppRouterOptimization()
      exports OptimizationRoot, OptimizationAnalyticsRoot, OptimizedEntry, NextAppAutoPageTracker,
      createRequestHandoff, createHandoffFromSelections, createOptimizationCacheKey, cache
      middleware, tracking helpers, and selection resolution helpers

  app/(request)/layout.tsx
    renders the persistent bound OptimizationRoot, preview panel, route tracker, and request route
    shell from the cached current request handoff

  app/(request)/request-handoff.ts
    creates the cached current request handoff from explicit headers/cookies/url request input

  app/(request)/RequestRouteShell.tsx
    creates the current request handoff before returning the route subtree with server entries

  app/(request)/page.tsx and app/(request)/page-two/page.tsx
    fetch CDA entries server-side
    render RequestRouteShell before server first-paint entries through the bound OptimizedEntry

  app/(static)/selection-handoff/[segment]/layout.tsx and page.tsx
    render the customer-owned public permutation selected by the static layout handoff with computed
    public cache metadata

  app/(static)/analytics-only/[segment]/layout.tsx and page.tsx
    render selected content plus data-ctfl-* attributes for the layout analytics root with the same
    computed cache metadata

  app/edge-request/route.ts and app/edge-selection/[segment]/route.ts
    exercise Edge request and public-permutation handoff JSON examples

  app/edge-html/[segment]/page.tsx
    renders selected optimized HTML in the Edge runtime with data-ctfl-* attributes and
    analytics-only browser hydration

  app/layout.tsx
    stays request-neutral so static/ISR handoff route groups can pre-render

Browser runtime
  Bound OptimizationRoot hydrates explicit handoff state
  OptimizationAnalyticsRoot hydrates analytics-only handoff without content re-resolution
  NextAppAutoPageTracker emits route page events
  The same app-local OptimizedEntry resolves entries from current selectedOptimizations
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

## Route strategy

Use Server Components for routes that fetch Contentful entries and render first-paint/static content
through the bound `OptimizedEntry`. Use Client Components for entry surfaces that resolve and react
after browser startup. Pass request, selection, or analytics-only handoff to the bound root instead
of sharing package-internal state objects. This implementation demonstrates:

- The home route fetches entries server-side, renders static first-paint entries on the server, and
  keeps merge-tag and live-update examples on the client
- The page-two route demonstrates client navigation and browser-observable page events
- The selection-handoff route renders a customer-owned segment through `createHandoffFromSelections`
  with cache metadata computed from the segment slug, version, locale, baseline entries, and selected
  optimizations
- The analytics-only route renders selected markup with tracking attributes and no browser content
  re-resolution
- The hidden-until-ready route demonstrates client-only hidden-until-ready hydration
- The Edge routes exercise request-personalized, customer-owned public-permutation, and selected
  Edge HTML handoff
- The same app-local bound `OptimizedEntry` chooses the server or client implementation from the
  component boundary

## Prerequisites

- Node.js >= 20.19.0 (24.15.0 recommended to match `.nvmrc`)
- pnpm

## Setup

Run these commands from the monorepo root:

```sh
pnpm install
pnpm build:pkgs
pnpm implementation:run -- nextjs-sdk_app-router implementation:install
test -f implementations/nextjs-sdk_app-router/.env || cp implementations/nextjs-sdk_app-router/.env.example implementations/nextjs-sdk_app-router/.env
```

The `.env.example` values are mock-safe defaults for the shared local mock API. Provide live
Contentful and Optimization values only when testing against real services.

## Running locally

Run these commands from the monorepo root:

```sh
pnpm implementation:run -- nextjs-sdk_app-router dev
pnpm implementation:run -- nextjs-sdk_app-router build
pnpm implementation:run -- nextjs-sdk_app-router typecheck
pnpm implementation:run -- nextjs-sdk_app-router lint
```

The development server runs on `http://localhost:3002`.

For production-style local serving with PM2-managed mock and app processes:

```sh
pnpm implementation:run -- nextjs-sdk_app-router serve
pnpm implementation:run -- nextjs-sdk_app-router serve:stop
```

The preview panel attaches when `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` is `true`. The default
`.env.example` keeps it disabled for mock-safe local runs; enable the flag only for development,
preview, or staging builds where editor tooling is intended.

## Running E2E tests

Run the full E2E setup and test suite from the monorepo root:

```sh
pnpm setup:e2e:nextjs-sdk_app-router
pnpm test:e2e:nextjs-sdk_app-router
```

The E2E suite reuses the shared `lib/e2e-web` browser scenarios for CSR and hydration behavior under
the App Router configuration. It covers shared variant resolution, tracking, navigation, live
updates, offline queue recovery, and the hydration check that a consented server handoff does not
issue a duplicate client Experience request.

Use Playwright UI or codegen when needed:

```sh
pnpm implementation:run -- nextjs-sdk_app-router test:e2e:ui
pnpm implementation:run -- nextjs-sdk_app-router test:e2e:codegen
```

## Related

- [Next.js SDK Pages Router](../nextjs-sdk_pages-router/README.md) - Pages Router reference
  implementation using `getServerSideProps`
- [React Web SDK reference implementation](../react-web-sdk/README.md) - Browser-side React
  integration using the React Web SDK
- [@contentful/optimization-nextjs](../../packages/web/frameworks/nextjs-sdk/README.md) - Next.js
  SDK package
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
