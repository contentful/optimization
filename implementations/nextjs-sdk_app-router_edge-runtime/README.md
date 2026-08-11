<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Next.js SDK App Router Edge Runtime Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

Reference implementation for actual Edge runtime handoff routes in
`@contentful/optimization-nextjs`. Routes export `runtime = 'edge'`, avoid Node-only APIs, and use
`@contentful/optimization-nextjs/edge` from `@/lib/edge-optimization`.

This implementation is separate from the App Router Cache Components reference implementation. It
does not cover ISR, route-level `revalidate`, or Cache Components.

## What this covers

- Request-personalized Edge runtime handoff from `app/edge-request/route.ts`
- Public permutation Edge runtime handoff from `app/edge-selection/[segment]/route.ts`
- Edge runtime assertion with `globalThis.EdgeRuntime === 'edge-runtime'`
- Browser handoff state created without Node-only APIs

## Prerequisites

- Node.js >= 20.19.0 (24.15.0 recommended to match `.nvmrc`)
- pnpm

## Setup

Run these commands from the monorepo root:

```sh
pnpm install
pnpm build:pkgs
pnpm implementation:run -- nextjs-sdk_app-router_edge-runtime implementation:install
```

## Running locally

Run these commands from the monorepo root:

```sh
pnpm implementation:run -- nextjs-sdk_app-router_edge-runtime dev
pnpm implementation:run -- nextjs-sdk_app-router_edge-runtime build
pnpm implementation:run -- nextjs-sdk_app-router_edge-runtime typecheck
pnpm implementation:run -- nextjs-sdk_app-router_edge-runtime lint
```

The development server runs on `http://localhost:3003`.

## Running E2E tests

Run the run-only Playwright wrapper from the monorepo root. Pass a test file or filter for routine
validation; omit it only when the full suite is warranted:

```sh
pnpm test:e2e:nextjs-sdk_app-router_edge-runtime <file-or-filter>
```

If consumed SDK packages changed or installed artifacts are stale, first run `pnpm build:pkgs` and
`pnpm implementation:run -- nextjs-sdk_app-router_edge-runtime implementation:install`. Run
`pnpm setup:e2e:nextjs-sdk_app-router_edge-runtime` only when the Playwright browser executable is
missing.

The E2E suite uses the shared `lib/e2e-web` Edge runtime scenarios with `E2E_FLAGS=EDGE`.

## Related

- [Next.js SDK App Router](../nextjs-sdk_app-router/README.md) - Cache Components App Router
  reference implementation
- [Next.js SDK Pages Router](../nextjs-sdk_pages-router/README.md) - Pages Router ISR reference
  implementation
- [@contentful/optimization-nextjs](../../packages/web/frameworks/nextjs-sdk/README.md) - Next.js
  SDK package
