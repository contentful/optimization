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

Reference implementation for `@contentful/optimization-nextjs` in a Next.js Pages Router
application. Pages call `createRequestHandoff()` from `getServerSideProps`, pass the returned
browser handoff through `pageProps`, and mount the bound Pages Router root once in `pages/_app.tsx`.
That callback-enabled root owns its initial and later browser page events. The public permutation
route uses `createPublicPermutationHandoff()` from `getStaticProps` with ISR.

The implementation binds `OptimizationRoot` and `OptimizedEntry` once in `@/lib/optimization` with
`bindNextjsPagesRouterOptimization()`. Browser runtime imports use Next.js SDK package subpaths. The
package root is not imported:

- `@contentful/optimization-nextjs/pages-router` in `@/lib/optimization` for the bound component
  binding and browser readiness callback
- `@contentful/optimization-nextjs/pages-router/server` in `@/lib/optimization-server` for
  `getServerSideProps` request handoff
- `@contentful/optimization-nextjs/client` for browser hooks and providers
- `@contentful/optimization-nextjs/api-schemas` in components that need SDK schema guards

## What this covers

Use this implementation when you need a Pages Router example where `getServerSideProps` fetches
Contentful entries, prepares Optimization state, and lets the browser SDK continue from that state
after hydration. It covers:

- App-local bound components from `bindNextjsPagesRouterOptimization()`
- Request handoff from `createRequestHandoff()` through `pageProps`
- Public permutation handoff from `getStaticProps` with `fallback: false` and `revalidate: 60`
- Query-controlled before-initial-page work in the root-owned browser page flow
- Root-owned initial and later route tracking without a separate router tracker
- Browser-side entry resolution with the app-local `OptimizedEntry`
- Private request preview with browser replay of the ordered initial event batch
- Live re-resolution after consent, identify, reset, and client-side route changes
- Preview panel attachment behind `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`

## CDA locale handling

The implementation defines one locale at `appConfig.locale`, passes it to the Next.js SDK server
helper, uses it for event context, and passes it directly to Contentful CDA fetches. Do not use
`contentful.js` `withAllLocales` or raw CDA `locale=*`; SDK entry resolution expects direct
single-locale fields such as `fields.nt_experiences` and `fields.nt_variants`.

## Route strategy

Use `getServerSideProps` for server-personalized first paint. It fetches entries, calls the Pages Router helper, and returns both through `props`. `pages/_app.tsx` passes `pageProps.contentfulOptimization.handoff`, `routeKey`, and `buildPagePayload` to the bound root. The helper previews one ordered Personalization batch. The root hydrates preview state in memory and owns the initial replay/page decision while rendering proceeds.

The server request helper configures `?beforeInitialPage=readiness` as the maintained
identify-before-page preview prefix. The root's next ordinary current-page call delivers that
continuation when it can; otherwise it follows the normal current-page path. Later route changes use
the emitter's normal path. Do not mount `NextPagesAutoPageTracker` beside this root; that would
introduce a second page owner.

Routes without a private request handoff still use the client binding's `beforeInitialPage`
callback. The callback identifies only for `?beforeInitialPage=readiness`; ordinary routes return
immediately. A matching private replay bypasses that callback because the previewed batch already
owns the initial route.

Use `getStaticProps` and `getStaticPaths` for finite public personalization permutations. The
`/selection-handoff/[segment]` route builds a public-permutation handoff with the SDK helper,
renders resolved entries into raw HTML with tracking attributes, and revalidates every 60 seconds.

The `/ssg-client-personalization` route uses `getStaticProps` for shared static output without a
visitor-specific handoff. It keeps the raw entry region hidden and displays an accessible loading
status until the browser resolves the current `OptimizedEntry` presentation.

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
`PUBLIC_OPTIMIZATION_STATIC_HANDOFF_MISSING_ENTRY` controls static public handoff routes when a
required Contentful entry is missing: keep the default `throw` to fail the route, or use `not-found`
when you intentionally want those routes to return a 404.

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

Run the focused readiness scenarios to verify the shared SSG route's raw HTML and reveal behavior:

```sh
pnpm test:e2e:nextjs-sdk_pages-router -- --grep readiness
```

Run the focused initial-batch scenarios to verify preview ordering, replay hydration, preserved
content, and later-route emission:

```sh
pnpm test:e2e:nextjs-sdk_pages-router -- --grep "before initial page"
```

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
- [Mock server](../../lib/mock-server/README.md) - HTTP composition for local development and
  reference implementations
- [Mocks package](../../lib/mocks/README.md) - Shared handlers and fixtures
