<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Next.js SDK SSR Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

Reference implementation demonstrating `@contentful/optimization-nextjs` in a Next.js App Router
application with server-rendered personalization and browser-side tracking. The application imports
public Next.js SDK subpaths for SDK-owned behavior:

- `@contentful/optimization-nextjs/server` in Server Components and server-only modules
- `@contentful/optimization-nextjs/client` in Client Components
- `@contentful/optimization-nextjs/api-schemas` for shared schema guards
- `@contentful/optimization-nextjs/request-handler` in proxy

The Next.js SDK adapter owns its lower-level server/client composition internally, so this
implementation does not import, configure, or externalize lower-level Node, Web, or React SDK
packages directly. The optional preview panel package is the exception: when enabled, the app
dynamically loads `@contentful/optimization-web-preview-panel`.

## What this demonstrates

Use this implementation when you need a server-rendered Next.js example where personalized content
is resolved before browser startup. It demonstrates:

- Server-rendered personalized first paint with `getNextjsServerOptimizationData()`, deduplicated
  per request with a React `cache()` helper (`getServerOptimizationData` in `lib/optimization.ts`)
- Seeding `OptimizationRoot` with `serverOptimizationState` in the layout so the provider renders
  identified and personalized state on the server, correct even with JavaScript disabled
- Server-rendered entries through the isomorphic `OptimizedEntry`
- Request URL capture through `createNextjsOptimizationContextHandler()`
- Browser-side page, view, click, and hover tracking through the adapter client entry
- `initialPageEvent="skip"` when the server already resolved the same initial page

In this SSR pattern, `OptimizedEntry` renders the server-resolved variant and holds it after
hydration. Client actions such as consent, identify, and reset update browser SDK state and
analytics, but server-rendered content changes only on the next server request. The live updates
section opts specific entries into `liveUpdates` to demonstrate browser-side re-resolution.

## Architecture

```text
Request
  proxy.ts
    createNextjsOptimizationContextHandler()
      forwards sanitized request URL context for Server Components

  lib/optimization.ts
    getServerOptimizationData() — React cache()
      calls getNextjsServerOptimizationData() with cookies() and headers()
      one Experience page() call per request, shared by layout and pages

  app/layout.tsx (Server Component)
    mounts OptimizationRoot from @contentful/optimization-nextjs/client
    passes serverOptimizationState={await getServerOptimizationData()}
      provider renders personalized state on the server and hydrates the live SDK
    passes initialPageEvent="skip" only after consented server page resolution

  app/page.tsx
    fetches CDA entries
    reads the same getServerOptimizationData() (deduplicated)
    renders entries through the isomorphic OptimizedEntry

Browser startup
  provider swaps the snapshot runtime for the live browser SDK
  NextAppAutoPageTracker handles route page events
  default interaction observers read data-ctfl-* attributes
  entries opted into liveUpdates re-resolve in the browser
```

## CDA locale handling

The implementation defines one `appConfig.locale`, passes it to the Next.js SDK server helpers, uses
it for event context, and passes it directly to Contentful CDA fetches. The browser provider
receives the same locale value. Do not use `contentful.js` `withAllLocales` or raw CDA `locale=*`;
SDK entry resolution expects direct single-locale fields such as `fields.nt_experiences` and
`fields.nt_variants`.

See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).

## Prerequisites

- Node.js >= 20.19.0 (24.15.0 recommended to match `.nvmrc`)
- pnpm

## Setup

Run these commands from the monorepo root:

```sh
pnpm install
pnpm build:pkgs
pnpm implementation:run -- nextjs-sdk_ssr implementation:install
test -f implementations/nextjs-sdk_ssr/.env || cp implementations/nextjs-sdk_ssr/.env.example implementations/nextjs-sdk_ssr/.env
```

The `.env.example` values are mock-safe defaults for the shared local mock API. Provide live
Contentful and Optimization values only when testing against real services.

## Running locally

Run these commands from the monorepo root:

```sh
pnpm implementation:run -- nextjs-sdk_ssr dev
pnpm implementation:run -- nextjs-sdk_ssr build
pnpm implementation:run -- nextjs-sdk_ssr typecheck
pnpm implementation:run -- nextjs-sdk_ssr lint
```

The development server runs on `http://localhost:3001`.

For production-style local serving with PM2-managed mock and app processes:

```sh
pnpm implementation:run -- nextjs-sdk_ssr serve
pnpm implementation:run -- nextjs-sdk_ssr serve:stop
```

## Running E2E tests

Run the full E2E setup and test suite from the monorepo root:

```sh
pnpm setup:e2e:nextjs-sdk_ssr
pnpm test:e2e:nextjs-sdk_ssr
```

The SSR E2E run uses `E2E_FLAGS=SSR` from `.env.example`. It runs the shared navigation, tracking,
and live updates specs against SSR-rendered markup, plus the SSR first-paint and JavaScript-disabled
variant-resolution blocks — the provider renders personalized state on the server, so those pass
without JavaScript. Hydration-only no-client-Experience-request checks remain behind `HYDRATION`,
and request URL forwarding plus tracking-attribute mapping are covered by
`@contentful/optimization-nextjs` package unit tests.

Use Playwright UI or codegen when needed:

```sh
pnpm implementation:run -- nextjs-sdk_ssr test:e2e:ui
APP_PORT=3001 pnpm implementation:run -- nextjs-sdk_ssr test:e2e:codegen
```

## Related

- [Next.js SDK hybrid](../nextjs-sdk_hybrid/README.md) - Hybrid SSR and browser takeover reference
  implementation
- [React Web SDK reference implementation](../react-web-sdk/README.md) - Browser-side React
  integration using the React Web SDK
- [@contentful/optimization-nextjs](../../packages/web/frameworks/nextjs-sdk/README.md) - Next.js
  SDK package
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
