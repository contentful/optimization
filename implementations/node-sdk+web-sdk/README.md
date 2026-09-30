<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Node SDK SSR + Web SDK Vanilla JS Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

This is a reference implementation using both the
[Optimization Node SDK](../../packages/node/node-sdk/README.md) and
[Optimization Web SDK](../../packages/web/web-sdk/README.md), and is part of the
[Contentful Optimization SDK Suite](../../README.md).

## What this demonstrates

Use this implementation when you need a hybrid SSR/browser example. It demonstrates a stateless Node
SDK preview flow, a stateful Web SDK browser continuation, consent-aware application cookies, and
local mock API usage for end-to-end validation.

The stateless Node SDK is created once at module load. Each consented request calls `previewInitialExperience()` once for `[page]`, `[identify, page]`, or `[track, page]`, then creates a private handoff. The server neither persists preview identity nor writes its anonymous-ID cookie. Web calls `hydrateAndTrackCurrentPage()` to apply state in memory and deliver one browser batch or ordinary fallback. Rendering does not await delivery. A successful live response can persist continuity, and later navigation uses ordinary tracking. Missing or denied app consent skips preview and renders baseline entries.

The SSR page transfers one canonical `optimizationHandoff` object to the browser. The browser uses
that object for both initial state hydration and its possible private replay; it does not reconstruct
or combine a second replay payload. A replay is one-shot, so a route mismatch or delivery failure
falls through to ordinary current-page tracking.

The goal of this reference implementation is to illustrate the usage of cookie-based communication
in both the Node and Web SDKs, which is an important component of many server-side/client-side
hybrid SSR and ESR solutions.

> [!NOTE]
>
> This hybrid architecture allows more cache flexibility when personalization is deferred to browser
> code. If the server embeds personalized output or profile-derived values, treat that response as
> personalized and avoid shared caching unless you vary on all relevant inputs.

## CDA locale handling

The server and browser share one `APP_LOCALE`. Server code passes it to the Node SDK request context
with `sdk.forRequest({ locale: APP_LOCALE })` and uses it when building event context. Browser code
passes the same value as the Web SDK top-level `locale` and directly to Contentful CDA entry
fetches. Do not use `contentful.js` `withAllLocales` or raw CDA `locale=*` for entries passed to SDK
resolution; the resolver expects direct single-locale fields such as `fields.nt_experiences` and
`fields.nt_variants`. See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md)
for the broader locale model and
[Entry personalization and variant resolution](../../documentation/concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract)
for the entry contract.

This reference uses the supported manual path: application code fetches single-locale Contentful
entries and passes them to SDK entry resolution. For JavaScript integrations with an
application-owned `contentful.js` client, we recommend configuring the SDK with
`contentful: { client: contentfulClient }` and using managed fetching (`fetchOptimizedEntry()`,
`entryId`, and optional `entryQuery` where supported). Keep the manual `baselineEntry` /
`resolveOptimizedEntry()` path when the application must own fetching, caching, or response shaping.

## Prerequisites

- Node.js >= 20.19.0 (24.15.0 recommended to match `.nvmrc`)
- pnpm

## Setup

Run all steps from the monorepo root.

1. Install pnpm packages:

   ```sh
   pnpm install
   ```

2. Build the local package tarballs consumed by implementations:

   ```sh
   pnpm build:pkgs
   ```

3. Install this implementation so its local `@contentful/*` dependencies resolve from `pkgs/`:

   ```sh
   pnpm implementation:run -- node-sdk+web-sdk implementation:install
   ```

4. Create the local `.env` file if it does not already exist:

   ```sh
   test -f implementations/node-sdk+web-sdk/.env || cp implementations/node-sdk+web-sdk/.env.example implementations/node-sdk+web-sdk/.env
   ```

   The `.env.example` values are valid only against the mock server implementation. To test the
   implementation against a live server environment, see the
   [mocks package](../../lib/mocks/README.md) for information on how to set up Contentful space with
   test data.

## Running locally

Run these commands from the monorepo root.

1. Start servers:

   ```sh
   pnpm implementation:run -- node-sdk+web-sdk serve
   ```

2. Stop servers:

   ```sh
   pnpm implementation:run -- node-sdk+web-sdk serve:stop
   ```

3. Run E2E:

   ```sh
   pnpm test:e2e:node-sdk+web-sdk
   ```

The application can be accessed via Web browser at `http://localhost:3000`. See
`implementations/node-sdk+web-sdk/package.json` for lower-level local commands.

## Running E2E tests

E2E tests are run using Playwright.

1. Install implementation dependencies, browser binaries, and system dependencies:

   ```sh
   pnpm setup:e2e:node-sdk+web-sdk
   ```

2. Run the E2E test suite:

   ```sh
   pnpm test:e2e:node-sdk+web-sdk
   ```

   The tests can alternatively be run using Playwright's GUI:

   ```sh
   pnpm implementation:run -- node-sdk+web-sdk test:e2e:ui
   ```

## Related

- [@contentful/optimization-node](../../packages/node/node-sdk/README.md) - Node SDK package
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK package
- [Node SDK reference implementation](../node-sdk/README.md) - Server-only reference implementation
- [Web SDK Vanilla JS reference implementation](../web-sdk/README.md) - Browser-only reference
  implementation
- [Mock server](../../lib/mock-server/README.md) - HTTP composition for local development and
  reference implementations
- [Mocks package](../../lib/mocks/README.md) - Shared handlers and fixtures
