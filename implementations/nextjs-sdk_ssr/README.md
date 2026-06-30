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
only Next.js SDK subpaths:

- `@contentful/optimization-nextjs/server` in Server Components and server-only modules
- `@contentful/optimization-nextjs/client` in Client Components
- `@contentful/optimization-nextjs/request-handler` in proxy

The Next.js SDK adapter owns its lower-level server/client composition internally, so this
implementation does not import, configure, or externalize lower-level SDK packages directly.

## What this demonstrates

Use this implementation when you need a server-rendered Next.js example where personalized content
is resolved before browser startup. It demonstrates:

- Server-rendered personalized first paint with `getNextjsServerOptimizationData()`
- Server-rendered tracking markup with `ServerOptimizedEntry`
- Request URL capture through `createNextjsOptimizationContextHandler()`
- Browser-side page, view, click, and hover tracking through the adapter client entry
- `initialPageEvent="skip"` when the server already resolved the same initial page

In this SSR pattern, content is static after browser startup. Client actions such as consent,
identify, and reset update browser SDK state and analytics, but server-rendered content changes only
on the next server request.

## Architecture

```text
Request
  proxy.ts
    createNextjsOptimizationContextHandler()
      forwards sanitized request URL context for Server Components

  app/page.tsx
    fetches CDA entries
    calls getNextjsServerOptimizationData() with cookies() and headers()
    resolves entries through the request-bound SDK
    renders NextjsOptimizationState near optimized content for server-to-browser state handoff
    renders children through ServerOptimizedEntry

Browser startup
  app/layout.tsx
    mounts OptimizationRoot from @contentful/optimization-nextjs/client
    passes initialPageEvent="skip" only after consented server page resolution

  browser tracking
    NextAppAutoPageTracker handles route page events
    default interaction observers read data-ctfl-* attributes
```

## CDA locale handling

The implementation defines one `APP_LOCALE`, passes it to the Next.js SDK server helpers, uses it
for event context, and passes it directly to Contentful CDA fetches. The browser provider receives
the same locale value. Do not use `contentful.js` `withAllLocales` or raw CDA `locale=*`; SDK entry
resolution expects direct single-locale fields such as `fields.nt_experiences` and
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

The E2E suite mirrors the shared React SDK interaction and navigation tests that apply to
SSR-rendered markup, with additional Next.js SSR checks for server first paint, tracking attributes,
proxy request URL context, and skipped duplicate initial page events.

Use Playwright UI or codegen when needed:

```sh
pnpm implementation:run -- nextjs-sdk_ssr test:e2e:ui
pnpm implementation:run -- nextjs-sdk_ssr test:e2e:codegen
```

## Related

- [Next.js SDK hybrid](../nextjs-sdk_hybrid/README.md) - Hybrid SSR and browser takeover reference
  implementation
- [React Web SDK reference implementation](../react-web-sdk/README.md) - Browser-side React
  integration using the React Web SDK
- [@contentful/optimization-nextjs](../../packages/web/frameworks/nextjs-sdk/README.md) - Next.js
  SDK package
- [Mocks package](../../lib/mocks/README.md) - Shared mock API server and fixtures
