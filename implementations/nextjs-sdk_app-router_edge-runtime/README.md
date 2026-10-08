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

This implementation covers actual Edge runtime routes. It does not cover ISR, route-level
`revalidate`, or Cache Components; the App Router reference implementation owns static and ISR
routes.

## What this covers

- Request-personalized Edge runtime handoff from `app/edge-request/route.ts`
- Public permutation Edge runtime handoff from `app/edge-selection/[segment]/route.ts`
- Request-selected content rendered on the Edge at `/edge-render/private`, with Experience API
  preview on the server and prepared-event commitment through the browser queue after hydration
- App-owned public selections rendered on the Edge at `/edge-render/public/[segment]`
- Edge runtime assertion with `globalThis.EdgeRuntime === 'edge-runtime'`
- Profile cookie persistence through the response owned by `/edge-request`

For E2E clarity, this reference separates cookie persistence (`/edge-request`, which owns the HTTP
response) from rendered pages (`/edge-render/*`, which exercise visible content and browser
hydration). Applications with an Edge-safe HTML renderer can do both in one Route Handler response.

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
The rendered routes fetch their baseline and variant entries through the Contentful Delivery API.
Set `PUBLIC_CONTENTFUL_CDA_BASE_URL` and `PUBLIC_CONTENTFUL_TOKEN` in the local `.env` for your
content; `.env.example` points them at the local mock CDA.

## Running E2E tests

Run the full E2E setup and test suite from the monorepo root:

```sh
pnpm setup:e2e:nextjs-sdk_app-router_edge-runtime
pnpm test:e2e:nextjs-sdk_app-router_edge-runtime
```

The Edge-specific `lib/e2e-web/e2e/edge-consumer.spec.ts` runs through the shared Playwright runner
with `E2E_FLAGS=EDGE`. It checks visible selected content without JavaScript, browser commitment,
consent and profile-cookie continuity, and navigation across the rendered Edge routes.

## Related

- [Next.js SDK App Router](../nextjs-sdk_app-router/README.md) - App Router reference implementation
  with static and ISR routes
- [Next.js SDK Pages Router](../nextjs-sdk_pages-router/README.md) - Pages Router ISR reference
  implementation
- [@contentful/optimization-nextjs](../../packages/web/frameworks/nextjs-sdk/README.md) - Next.js
  SDK package
