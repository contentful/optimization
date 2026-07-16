<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Next.js SDK Pages Router Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

Reference implementation demonstrating `@contentful/optimization-nextjs` in a Next.js Pages Router
application. Pages call `createRequestHandoff()` from `getServerSideProps`, pass the returned
browser handoff through `pageProps`, and mount the bound Pages Router root and route tracker once in
`pages/_app.tsx`.

The implementation binds `OptimizationRoot`, `OptimizedEntry`, and `NextPagesAutoPageTracker` once
in `@/lib/optimization` with `bindNextjsPagesRouterOptimization()`. Browser runtime imports use
Next.js SDK package subpaths. The package root is not imported:

- `@contentful/optimization-nextjs/pages-router` in `@/lib/optimization` for the bound component
  binding and route tracker
- `@contentful/optimization-nextjs/pages-router/server` in `@/lib/optimization-server` for
  `getServerSideProps` request handoff
- `@contentful/optimization-nextjs/client` for browser hooks and providers
- `@contentful/optimization-nextjs/api-schemas` in components that need SDK schema guards

## What this demonstrates

Use this implementation when you need a Pages Router example where `getServerSideProps` fetches
Contentful entries, prepares Optimization state, and lets the browser SDK continue from that state
after hydration. It demonstrates:

- App-local bound components from `bindNextjsPagesRouterOptimization()`
- Request handoff from `createRequestHandoff()` through `pageProps`
- Pages Router route tracking with `NextPagesAutoPageTracker`
- Browser-side entry resolution with the app-local `OptimizedEntry`
- `initialPageEvent` ownership from the handoff so the browser skips only when the server request
  accepted the first page event
- Live re-resolution after consent, identify, reset, and client-side route changes
- Preview panel attachment behind `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`

## CDA locale handling

The implementation defines one locale at `appConfig.locale`, passes it to the Next.js SDK server
helper, uses it for event context, and passes it directly to Contentful CDA fetches. Do not use
`contentful.js` `withAllLocales` or raw CDA `locale=*`; SDK entry resolution expects direct
single-locale fields such as `fields.nt_experiences` and `fields.nt_variants`.

## Route strategy

Use `getServerSideProps` for pages that need server-personalized first paint. It fetches entries,
calls the Pages Router Optimization helper, and returns both through `props`. `pages/_app.tsx`
passes `pageProps.contentfulOptimization.handoff` to the bound `OptimizationRoot` with the current
`routeKey` and `buildPagePayload`; the handoff carries the first-page-event decision so the browser
does not duplicate an accepted server page event.

## Prerequisites

- Node.js >= 20.19.0 (24.15.0 recommended to match `.nvmrc`)
- pnpm

## Setup

Run these commands from the monorepo root:

```sh
pnpm install
pnpm build:pkgs
pnpm implementation:run -- nextjs-sdk_pages-router implementation:install
test -f implementations/nextjs-sdk_pages-router/.env || cp implementations/nextjs-sdk_pages-router/.env.example implementations/nextjs-sdk_pages-router/.env
```

The `.env.example` values are mock-safe defaults for the shared local mock API. Provide live
Contentful and Optimization values only when testing against real services.

## Running locally

Run these commands from the monorepo root:

```sh
pnpm implementation:run -- nextjs-sdk_pages-router dev
pnpm implementation:run -- nextjs-sdk_pages-router build
pnpm implementation:run -- nextjs-sdk_pages-router typecheck
pnpm implementation:run -- nextjs-sdk_pages-router lint
```

The development server runs on `http://localhost:3001`.

For production-style local serving with PM2-managed mock and app processes:

```sh
pnpm implementation:run -- nextjs-sdk_pages-router serve
pnpm implementation:run -- nextjs-sdk_pages-router serve:stop
```

## Running E2E tests

Run the full E2E setup and test suite from the monorepo root:

```sh
pnpm setup:e2e:nextjs-sdk_pages-router
pnpm test:e2e:nextjs-sdk_pages-router
```

The E2E suite reuses the shared `lib/e2e-web` browser scenarios for CSR, hydration, and SSR
first-paint behavior under the Pages Router configuration.

Use Playwright UI or codegen when needed:

```sh
pnpm implementation:run -- nextjs-sdk_pages-router test:e2e:ui
pnpm implementation:run -- nextjs-sdk_pages-router test:e2e:codegen
```

## Related

- [Next.js SDK App Router](../nextjs-sdk_app-router/README.md) - App Router reference implementation
  using bound Server and Client Component exports
- [React Web SDK reference implementation](../react-web-sdk/README.md) - Browser-side React
  integration using the React Web SDK
- [@contentful/optimization-nextjs](../../packages/web/frameworks/nextjs-sdk/README.md) - Next.js
  SDK package
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
