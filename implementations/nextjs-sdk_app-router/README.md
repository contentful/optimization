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

Reference implementation for `@contentful/optimization-nextjs` in a Next.js App Router
application with explicit server/client entrypoints, request-bound components, analytics-only
handoff, public permutation handoff, and Cache Components routes. The implementation binds the
server SDK once in `@/lib/optimization` with `bindNextjsAppRouterServerOptimization()`. Request
routes use app-local `Request*` aliases from `optimization.request`; static public routes use
app-local `Explicit*` aliases from the top-level binding.
Other SDK runtime imports use Next.js SDK package subpaths. The package root is not imported:

- `@contentful/optimization-nextjs/app-router/server` in `@/lib/optimization` for the server binding,
  request component family, route tracker, public permutation handoff, and selection helpers
- `@contentful/optimization-nextjs/client` for browser hooks and providers
- `@contentful/optimization-nextjs/api-schemas` in components that need SDK schema guards

The Next.js SDK adapter delegates server and browser SDK work internally, so this implementation
does not import, configure, or externalize lower-level SDK packages directly for Optimization
runtime work. Actual Edge runtime routes live in the
[Next.js App Router Edge runtime reference implementation](../nextjs-sdk_app-router_edge-runtime/README.md).

## What this covers

Use this implementation when you need a Next.js example where Server Components fetch Contentful
entries, the bound server root prepares Optimization state for handoff, and the browser SDK resolves
live surfaces after startup. It covers:

- App-local bound components from `bindNextjsAppRouterServerOptimization()`
- Request initialization through `optimization.request` without app-owned request plumbing
- Customer-owned public permutation handoff with helper-created public cache metadata
- Cache Components SSG and ISR-style revalidation with `use cache`, `cacheLife()`, and `cacheTag()`
- Analytics-only tracking over server-rendered markup through `OptimizationAnalyticsRoot`
- Client-only hidden-until-ready hydration for static or browser-owned routes
- Server-resolved first paint with `RequestOptimizedEntry` and static public content with
  `ExplicitOptimizedEntry`
- Browser-side entry resolution with the router-neutral `/client` `OptimizedEntry`
- Rich Text merge tags passed from the request entry render-prop `getMergeTagValue` into shared
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
      forwards trusted private request handoff data through the request handler
      keeps public permutation routes on the cache middleware rewrite path

  lib/optimization.ts
    bindNextjsAppRouterServerOptimization()
      configures request hydration and trusted request handoff once
      exports Request* aliases from optimization.request
      exports Explicit* aliases and public/analytics helpers from the top-level binding

  app/(request)/layout.tsx
    calls connection() inside RequestRuntime so the request subtree renders at request time
    wraps that runtime in Suspense for Cache Components and the search-parameter route tracker

  app/(request)/page.tsx and app/(request)/page-two/page.tsx
    fetch CDA entries server-side
    render server first-paint entries through RequestOptimizedEntry

  app/(static)/selection-handoff/[segment]/layout.tsx and page.tsx
    render the customer-owned public permutation selected by the static layout handoff with
    helper-created public cache metadata and Cache Components revalidation

  app/(static)/analytics-only/[segment]/layout.tsx and page.tsx
    render selected content plus data-ctfl-* attributes for the layout analytics root with the same
    public cache metadata

  app/(static)/static-shell-private-slot/page.tsx and PrivateRequestSlot.tsx
    keep the static shell outside Suspense
    call connection() inside the suspended private slot before rendering request-personalized content

  app/layout.tsx
    stays request-neutral so Cache Components route groups can pre-render

Browser runtime
  RequestOptimizationRoot hydrates SDK-owned request handoff state
  ExplicitOptimizationRoot hydrates public permutation handoff state
  OptimizationAnalyticsRoot hydrates analytics-only handoff without content re-resolution
  RequestNextAppAutoPageTracker preserves initial page-event ownership and tracks navigation
  RequestOptimizedEntry resolves request entries from current selectedOptimizations
  LiveUpdatesProvider controls reactive re-resolution
```

`optimization.request` owns one shared SDK initialization for the root, entry, and tracker. The
implementation therefore has no app-owned request cache, request shell, duplicate awaits, or manual
request handoff plumbing. The `connection()` calls and `Suspense` wrappers above are Next.js Cache
Components boundaries, not SDK synchronization workarounds.

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

Use request Server Components for routes that fetch Contentful entries and render personalized first
paint through `RequestOptimizedEntry`. Use the explicit top-level family for static public handoff,
and use Client Components for entry surfaces that resolve and react after browser startup. This
implementation covers:

- The home route fetches entries server-side, renders static first-paint entries on the server, and
  keeps merge-tag and live-update examples on the client
- The page-two route covers client navigation and browser-observable page events
- The selection-handoff route renders a customer-owned segment through
  `createPublicPermutationHandoff()` with cache metadata from the public-permutation helper
- The analytics-only route renders selected markup with tracking attributes and no browser content
  re-resolution
- The hidden-until-ready route covers client-only hidden-until-ready hydration
- The static-shell-private-slot route keeps the shell static and isolates request-personalized
  content under `connection()` in a private slot
- Request routes and static public routes use distinct app-local aliases so static consumers don't
  opt into private request APIs

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
`PUBLIC_OPTIMIZATION_STATIC_HANDOFF_MISSING_ENTRY` controls static public handoff routes when a
required Contentful entry is missing: keep the default `throw` to fail the route, or use `not-found`
when you intentionally want those routes to return a 404.

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
the App Router Cache Components configuration. It covers shared variant resolution, tracking,
navigation with a preserved request layout, page-only request entries, a private request slot, live
updates, offline queue recovery, and trusted handoff without duplicate initial browser work. The
public permutation and analytics-only routes remain explicit top-level flows. JavaScript-disabled
SSR checks are skipped because Cache Components reveal streamed request-personalized content with
Next.js runtime scripts.

Use Playwright UI or codegen when needed:

```sh
pnpm implementation:run -- nextjs-sdk_app-router test:e2e:ui
pnpm implementation:run -- nextjs-sdk_app-router test:e2e:codegen
```

## Related

- [Next.js SDK Pages Router](../nextjs-sdk_pages-router/README.md) - Pages Router reference
  implementation using `getServerSideProps`
- [Next.js SDK App Router Edge runtime](../nextjs-sdk_app-router_edge-runtime/README.md) - Edge
  runtime reference implementation using `runtime = 'edge'` routes
- [React Web SDK reference implementation](../react-web-sdk/README.md) - Browser-side React
  integration using the React Web SDK
- [@contentful/optimization-nextjs](../../packages/web/frameworks/nextjs-sdk/README.md) - Next.js
  SDK package
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
